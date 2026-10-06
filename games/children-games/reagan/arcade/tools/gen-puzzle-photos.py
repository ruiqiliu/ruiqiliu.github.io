#!/usr/bin/env python3
""" =====================================================================
   tools/gen-puzzle-photos.py — 裁「拼图原图」并重新生成内联数据模块

   和 gen-avatars.py 的区别：头像只要一张脸，拼图要的是一张完整的
   画面 —— 所以按**所有人脸的并集**取景（合影里全家都留在画面里），
   边长取照片短边（能装多少装多少），框心对齐人脸并集的中心。

   流程：
     1. 调 tools/face-detect.swift 检出**全部**人脸框
     2. 以人脸并集为中心裁正方形（短边为边长，越界自动贴边）
     3. 缩到 SIZE 见方，存 assets/puzzle/photo-N.jpg
     4. 把六张 data URL 追加进 js/core/puzzle-data.js
        （前 5 张头像复用 avatar-data.js，不重复内联）

   用法（不需要 pillow，裁图缩放用 macOS 自带的 sips）：
     python3 tools/gen-puzzle-photos.py 照片1.jpg 照片2.jpg ...

   注意：照片按参数顺序编号 photo-1 ~ photo-N；没检出人脸时退回
   居中裁剪。生成的 puzzle-data.js 不要手改，重跑会覆盖。
   ===================================================================== """
import base64
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "puzzle")
DATA_JS = os.path.join(ROOT, "js", "core", "puzzle-data.js")
SIZE = 360          # 拼图原图比 192px 的头像大一号，3×3 时也够清晰
JPEG_Q = 85


def detect_faces(paths):
    """返回每张照片的全部人脸框 [(cx, cy, W, H), ...]（像素坐标，框心）"""
    exe = os.path.join(tempfile.gettempdir(), "arcade-face-detect")
    src = os.path.join(ROOT, "tools", "face-detect.swift")
    if not os.path.exists(exe) or os.path.getmtime(src) > os.path.getmtime(exe):
        subprocess.run(["swiftc", "-O", src, "-o", exe], check=True)

    out = subprocess.run([exe] + paths, capture_output=True, text=True, check=True).stdout
    all_faces = []
    for line in out.strip().split("\n"):
        _, dim, faces = line.split("\t")
        W, H = map(int, dim.split("x"))
        boxes = []
        for f in (faces.split(" | ") if faces and faces != " " else []):
            fx, fy, fw, fh = map(float, f.split(","))
            # Vision 原点在左下，翻转到左上，换成框心坐标
            boxes.append(((fx + fw / 2) * W, (1 - fy - fh / 2) * H))
        all_faces.append((boxes, W, H))
    return all_faces


def square(centers, W, H):
    """以人脸并集为中心取正方形（边长 = 短边），越界贴边"""
    if centers:
        cx = sum(c[0] for c in centers) / len(centers)
        cy = sum(c[1] for c in centers) / len(centers)
    else:
        cx, cy = W / 2, H / 2
    side = min(W, H)
    left = max(0, min(cx - side / 2, W - side))
    top = max(0, min(cy - side / 2, H - side))
    return (int(left), int(top), int(side))


def sips_crop_resize(src, rect, out):
    """sips 裁剪 + 缩放。-c 和 -z 混在一条命令里顺序不可靠，分两步走"""
    left, top, side = rect
    tmp = tempfile.mktemp(suffix=".jpg")
    subprocess.run(["sips", "-c", str(side), str(side),
                    "--cropOffset", str(top), str(left), src, "--out", tmp],
                   check=True, capture_output=True)
    subprocess.run(["sips", "-z", str(SIZE), str(SIZE), "-s", "format", "jpeg",
                    "-s", "formatOptions", str(JPEG_Q), tmp, "--out", out],
                   check=True, capture_output=True)
    os.remove(tmp)


def write_data_js(files):
    header = """/* =====================================================================
   core/puzzle-data.js — 拼图原图池（内联为 data URL，自动生成，勿手改）

   前 5 张直接复用 avatar-data.js 的儿童头像 —— 数组顺序保持一致，
   「头像拼图」进游戏时默认用本局主角那张脸。后面追加的是家庭照片
   （裁图存放在 assets/puzzle/photo-N.jpg），只作为拼图原图，
   不会出现在首页卡片 / 顶栏。

   想增减拼图照片：
     python3 tools/gen-puzzle-photos.py <原始照片...>
   裁图按「所有人脸的并集」取景，合影不会被裁掉人。内联原因同
   avatar-data.js：dist 单文件要能双击就玩。
   ===================================================================== */
import { AVATAR_URLS } from './avatar-data.js';

export const PUZZLE_URLS = AVATAR_URLS.concat(["""

    lines = [header]
    for i, f in enumerate(files):
        b64 = base64.b64encode(open(f, "rb").read()).decode()
        lines.append("  'data:image/jpeg;base64,%s'%s" % (b64, "," if i < len(files) - 1 else ""))
    lines.append("]);")
    with open(DATA_JS, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def main():
    paths = sys.argv[1:]
    if not paths:
        raise SystemExit(__doc__)

    os.makedirs(OUT_DIR, exist_ok=True)
    written = []
    for i, (p, (faces, W, H)) in enumerate(zip(paths, detect_faces(paths))):
        rect = square(faces, W, H)
        out = os.path.join(OUT_DIR, "photo-%d.jpg" % (i + 1))
        sips_crop_resize(p, rect, out)
        written.append(out)
        n = len(faces)
        where = "居中裁剪（没检出人脸）" if n == 0 else "%d 张脸并集取景" % n
        print("photo-%d.jpg  ←  %s  (%s, %d KB)"
              % (i + 1, os.path.basename(p), where, os.path.getsize(out) // 1024))

    write_data_js(written)
    print("\n%s  (%d KB)" % (os.path.relpath(DATA_JS, ROOT), os.path.getsize(DATA_JS) // 1024))
    print("接着跑：node tools/build.mjs && node tools/selftest.mjs")


if __name__ == "__main__":
    main()
