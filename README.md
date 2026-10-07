# ruiqiliu.github.io（产物仓库）

本仓库只存 Hexo 渲染后的**生成产物**，外加少量手写静态板块（`games/`），
由 GitHub Pages 直接服务 `master` 分支。

**不要直接手改这里的生成文件** —— 内容源码与构建工作流在
[ruiqiliu/hexo](https://github.com/ruiqiliu/hexo) 工程（文章 / 游戏源码 / 主题配置），
部署方式是在那边的工程里执行 `make build`（hexo generate + rsync）与 `make deploy`。

## 手写板块（不受 Hexo 模板管理）

- `games/children-games/reagan/arcade/` —— 游戏合集（10 个游戏，源码含自检与单文件打包）
- `games/solar-system/` —— 太阳系漫游（Three.js / WebGL）
- `games/happy-games/` —— 静态小游戏页
- `scripts/sync-nav.py` —— 历史遗留的导航同步工具（已被 Hexo 主题菜单取代）

这些目录里的文件可以直接手改，改完正常提交推送即可；其余目录（文章、归档、标签、
首页）下次部署时会被 Hexo 产物覆盖。
