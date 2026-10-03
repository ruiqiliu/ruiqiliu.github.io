# scripts/

这个仓库只存 hexo 渲染后的产物 —— **没有 `_config.yml` / `source/` / `themes/`**。
所以 `hexo generate` 用不了，任何「全站统一」的改动（页头导航、footer、SEO 元信息）
都得手动改 36 个 `index.html`。脚本目录就是为了收掉这类重复劳动。

## sync-nav.py

同步页头的两个导航块（桌面 `#main-nav` + 移动端 `#mobile-nav`）到全部 36 个页面。

```bash
python3 scripts/sync-nav.py            # 写入
python3 scripts/sync-nav.py --check    # 只校验，不写入；一致则退出码 0
```

**改导航的正确流程**：编辑脚本顶部的 `NAV_ITEMS` → 跑一次 → `--check` 确认 → 提交。
不要手改任何单个 `index.html`，下次同步会被覆盖。

### 范围

只处理仓库内的 `index.html`，**排除** `games/` 和 `fancybox/`。
这两块是手写的独立页面（各有自己的导航结构，不吃 hexo next 主题模板），
`games/children-games/reagan/arcade/` 更是完全独立的应用。

### 实现要点

- **幂等**：插入的 `<a>` 带 `data-nav="main"` / `data-nav="mobile"` 标记，
  重跑时先按标记清除旧块再重新插入，跑 N 次结果相同。
- **兼容手工插入**：早于本脚本手工加的链接没有 `data-nav` 标记。清理逻辑会额外
  识别「无标记但 class + href 都命中 `NAV_ITEMS`」的行并一并清掉，否则首页会出现
  两条重复链接。
- **锚点带容器作用域**：每条锚点是 `(nav 容器标签, Archives 行片段)` 二元组，
  且搜索范围不越过 `</nav>`。否则 `#mobile-nav` 里的 Archives 行会被误当成
  `#main-nav` 的锚点，把移动端链接插进桌面导航块 —— 这个 bug 踩过一次。
- **验证不能只看计数**：第一版脚本 bug 发生后，幂等校验和「每页 2 条」计数校验
  全绿（因为 `data-nav` 标记确实打对了）。是靠「按容器切块后检查标记归属」
  才查出来。校验必须断言**内容落在正确容器内**。
- **保留 hexo 原版节奏**：沿用主题「一项 + 一空行」的排版，diff 只有新增、无重排。
  唯一例外是首页，因为要清掉历史手工插入的行。

## 已知的历史遗留（未处理）

这些是产物落库的固有代价，改动前先确认是否还要动：

- **36 个页面的 `og:url` 仍是 `http://yoursite.com/...`**，hexo 主题出厂默认值，
  源丢了就再也没机会重新渲染。要修只能全量替换。
- **`archives/index.html` 只收录 10 篇文章，磁盘上有 15 个文章页**。5 个孤儿页出不了归档：
  `2018/05/06/t-io-start`、`2018/05/13/Java-简史`、`2018/05/13/element`、
  `2018/05/13/t-io-start`、`2018/05/13/vue-demo`。
- **hexo 区域已冻结**（`archives/`、`tags/` 最后改动 2020-08-04），
  而 `games/` 还在活跃开发（2026-09）。同仓库里是两套维护模式，别用同一套心智对待。
