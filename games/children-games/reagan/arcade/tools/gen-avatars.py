#!/usr/bin/env python3
""" =====================================================================
   tools/gen-avatars.py — 从原始照片裁头像，并重新生成内联数据模块

   流程：
     1. 调 tools/face-detect.swift 检出人脸框（人脸框比手估准得多）
     2. 按框裁正方形、缩到 192px、存成 assets/avatars/avatar-N.jpg
     3. 把五张 jpg 转base64，写进 js/core/avatar-data.js

   用法（需要 pillow：pip install pillow）：
     python3 tools/gen-avatars.py 原始照片1.jpg 原始照片2.jpg ...

   注意：
     - 照片按参数顺序编号avatar-1 ~ avatar-N，**游戏里的分配是按序号轮转的**
       （第 i 个游戏用第 i % 5 张），所以调整照片顺序就等于调整哪个游戏用哪张脸。
     - 头顶被帽子/刘海压住时，把 SCALE 调小、OFFSET 调大，让取景框收紧到脸。
     - 生成的 js/core/avatar-data.js 不要手改，下次跑这个脚本会覆盖。
   ===================================================================== """
import base64
import os
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "avatars")
DATA_JS = os.path.join(ROOT, "js", "core", "avatar-data.js")
SIZE = 192
JPEG_Q = 88

# 每张照片的取景系数：边长 = 人脸宽 × SCALE，框心上移 OFFSET × 边长。
# 默认值适合「脸占画面一小部分」的照片；戴帽子/脸小的照片要单独调小 SCALE。
SCALE = [4.2, 2.2, 3.4, 4.6, 1.16]
OFFSET = [0.46, 0.52, 0.46, 0.46, 0.46]


def detect(paths):
    """返回每张照片的最大人脸框（像素坐标，左上原点）"""
    exe = os.path.join(tempfile.gettempdir(), "arcade-face-detect")
    src = os.path.join(ROOT, "tools", "face-detect.swift")
    if not os.path.exists(exe) or os.path.getmtime(src) > os.path.getmtime(exe):
        subprocess.run(["swiftc", "-O", src, "-o", exe], check=True)

    out = subprocess.run([exe] + paths, capture_output=True, text=True, check=True).stdout
    boxes = []
    for line in out.strip().split("\n"):
        _, dim, faces = line.split("\t")
        W, H = map(int, dim.split("x"))
        if not faces or faces == " ":
            raise SystemExit("没检出人脸： " + line)
        fx, fy, fw, fh = map(float, faces.split(" | ")[0].split(","))
        # Vision 原点在左下，翻转到左上
        cx = (fx + fw / 2) * W
        cy = (1 - fy - fh / 2) * H
        boxes.append((cx, cy, fw * W, fh * H, W, H))
    return boxes


def crop(box, scale, offset):
    cx, cy, fw, fh, W, H = box
    side = min(max(fw, fh) * scale, min(W, H) * 0.98)
    left = max(0, min(cx - side / 2, W - side))
    top = max(0, min(cy - side * offset, H - side))
    return (int(left), int(top), int(left + side), int(top + side))


def write_data_js(files):
    header = """/* =====================================================================
   core/avatar-data.js — 儿童头像（内联为 data URL，自动生成，勿手改）

   为什么内联：dist/arcade.html 要求是「双击就能玩」的自包含单文件，
   不能依赖旁边的图片文件；而且 file:// 下外链图片在部分浏览器里
   还会被拦。改成 data URL 之后源码版和打包版表现完全一致。

   想换头像：改 assets/avatars/avatar-N.jpg，然后跑
     python3 tools/gen-avatars.py <原始照片...>
   裁脸不要手估坐标 —— 脚本会先调tools/face-detect.swift（macOS Vision）
   检出人脸框再裁。

   ⚠ 数组顺序就是「游戏序号→头像」的轮转顺序：第 i 个游戏用第 i % N 张。
      调整这里的顺序，等于调整哪个游戏用哪个小朋友的脸。
   ===================================================================== */

export const AVATAR_URLS = ["""

    lines = [header]
    for i, f in enumerate(files):
        b64 = base64.b64encode(open(f, "rb").read()).decode()
        lines.append("  'data:image/jpeg;base64,%s'%s" % (b64, "," if i < len(files) - 1 else ""))
    lines.append("];")
    with open(DATA_JS, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def main():
    paths = sys.argv[1:]
    if not paths:
        raise SystemExit(__doc__)

    os.makedirs(OUT_DIR, exist_ok=True)
    boxes = detect(paths)

    while len(SCALE) < len(paths):
        SCALE.append(SCALE[-1])
        OFFSET.append(OFFSET[-1])

    written = []
    for i, (p, box) in enumerate(zip(paths, boxes)):
        im = Image.open(p).convert("RGB")
        out = os.path.join(OUT_DIR, "avatar-%d.jpg" % (i + 1))
        im.crop(crop(box, SCALE[i], OFFSET[i])).resize((SIZE, SIZE), Image.LANCZOS)\
         .save(out, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
        written.append(out)
        print("avatar-%d.jpg  ←  %s  (%d KB)" % (i + 1, os.path.basename(p), os.path.getsize(out) // 1024))

    write_data_js(written)
    print("\n%s  (%d KB)" % (os.path.relpath(DATA_JS, ROOT), os.path.getsize(DATA_JS) // 1024))
    print("接着跑：node tools/build.mjs && node tools/selftest.mjs --shots")


if __name__ == "__main__":
    main()