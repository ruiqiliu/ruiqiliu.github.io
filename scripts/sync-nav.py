#!/usr/bin/env python3
"""同步站点页头的两个导航块（桌面 + 移动端）到全部 hexo 产物页面。

背景：这个仓库只存 hexo 渲染后的产物，没有 _config.yml / source/，
没法靠 `hexo generate` 重新生成。改一次导航就得手动改 N 个页面。
本脚本把 nav 当模板覆盖，保证全站一致。

用法：
    python3 scripts/sync-nav.py            # 按 NAV_ITEMS 写入
    python3 scripts/sync-nav.py --check    # 只检查不一致，不写文件

范围：只处理仓库内的 index.html，排除 games/ 和 fancybox/
      （这两块是手写的，有自己的导航结构，不吃 hexo 主题模板）。

改完导航后跑一次 --check 应当返回 0，可以挂进 CI 或提交前自查。
"""

import argparse
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
EXCLUDED_DIRS = {"games", "fancybox", ".git", ".workbuddy"}

# 全站导航项。要改导航，只改这里，然后跑本脚本。
NAV_ITEMS = [
    ("/", "Home"),
    ("/archives", "Archives"),
    ("https://ruiqiliu.github.io/games/children-games/reagan/arcade/", "Reagan's games"),
    ("https://ruiqiliu.github.io/games/solar-system/", "太阳系"),
]

# 标记属性：写进 HTML，用来识别「这一段是本脚本插入的」。
MARK_MAIN = "data-nav=\"main\""
MARK_MOBILE = "data-nav=\"mobile\""

# 锚点：Archives 那一行 + 其后的空行，插入点就在这之后。
# 每条锚点都绑定到具体的 nav 容器标签，防止 mobile 行被当成 main 的锚点。
ANCHOR_MAIN = (
    '<nav id="main-nav">',
    '<a class="main-nav-link" href="/archives">Archives</a>',
)
ANCHOR_MOBILE = (
    '<nav id="mobile-nav">',
    '<a href="/archives" class="mobile-nav-link">Archives</a>',
)

CLASS_MAIN = "main-nav-link"
CLASS_MOBILE = "mobile-nav-link"


def target_pages():
    pages = []
    for p in REPO.rglob("index.html"):
        rel = p.relative_to(REPO)
        if any(part in EXCLUDED_DIRS for part in rel.parts[:-1]):
            continue
        pages.append(p)
    return sorted(pages)


def indent_of(line):
    return line[: len(line) - len(line.lstrip())]


def patch_nav(lines, anchor, cls, mark):
    """先删掉本脚本之前插入的项，再在 Archives 之后插入 NAV_ITEMS 的尾部。

    anchor 是 (nav 容器标签, Archives 行片段) 二元组。只有同时命中这两个才
    算定位成功，避免把 mobile-nav 里的 Archives 误当成 main-nav 的锚点。

    清理时除了认 data-nav 标记，还要认「无标记但 href 命中 NAV_ITEMS」的遗留行
    —— 早于本脚本手工插入的链接没有标记，若不清掉会出现重复条目。

    返回 (新行列表, 是否成功定位)。
    """
    managed_hrefs = {href for href, _ in NAV_ITEMS[2:]}

    def is_managed(line):
        if mark in line:
            return True
        # 遗留手工插入：没有任何 data-nav 标记，但 class + href 都对得上
        if "data-nav" not in line and "nav-link" in line:
            return any(f'href="{href}"' in line for href in managed_hrefs)
        return False

    # 1) 幂等 + 去重：清掉所有本脚本或手工插入的项，以及紧随其后的空行
    cleaned, skip_blank_next = [], False
    for line in lines:
        if is_managed(line):
            skip_blank_next = True
            continue
        if skip_blank_next and not line.strip():
            skip_blank_next = False
            continue
        skip_blank_next = False
        cleaned.append(line)

    # 2) 定位锚点：必须在 nav 容器之后、且不越过 </nav>
    try:
        start = next(i for i, l in enumerate(cleaned) if anchor[0] in l)
        i = next(
            i
            for i, l in enumerate(cleaned)
            if i > start and anchor[1] in l and "</nav>" not in l
        )
    except StopIteration:
        return cleaned, False

    ind = indent_of(cleaned[i])

    new_lines = []
    for href, name in NAV_ITEMS[2:]:  # 前两项 hexo 原本就有
        esc = name.replace("'", "&#39;")
        new_lines.append(f'{ind}<a class="{cls}" href="{href}" {mark}>{esc}</a>')
        new_lines.append("")  # 空行分隔，跟主题风格一致

    return cleaned[: i + 1] + new_lines + cleaned[i + 1 :], True


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="只报告不一致，不写入")
    args = ap.parse_args()

    pages = target_pages()
    changed, failed = [], []

    for p in pages:
        rel = p.relative_to(REPO)
        orig = p.read_text(encoding="utf-8")
        lines = orig.splitlines()

        lines, ok1 = patch_nav(lines, ANCHOR_MAIN, CLASS_MAIN, MARK_MAIN)
        lines, ok2 = patch_nav(lines, ANCHOR_MOBILE, CLASS_MOBILE, MARK_MOBILE)
        if not (ok1 and ok2):
            failed.append(f"{rel}  main={ok1} mobile={ok2}")

        new = "\n".join(lines) + ("\n" if orig.endswith("\n") else "")
        if new != orig:
            changed.append(rel)
            if not args.check:
                p.write_text(new, encoding="utf-8")

    print(f"扫描 {len(pages)} 个页面")

    if failed:
        print("\n定位失败：")
        for x in failed:
            print("  -", x)
        return 2

    if args.check:
        if changed:
            print(f"\n✗ {len(changed)} 个页面导航不一致，请跑 python3 scripts/sync-nav.py")
            for c in changed:
                print("   ", c)
            return 1
        print("\n✓ 全站导航一致")
        return 0

    if changed:
        print(f"✓ 已同步 {len(changed)} 个页面：")
        for c in changed:
            print("   ", c)
    else:
        print("✓ 本来就一致，无需改动")
    return 0


if __name__ == "__main__":
    sys.exit(main())
