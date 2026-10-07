## 新增「太阳系漫游」板块（Three.js / WebGL）

### 定位与入口
- 独立页面 `/games/solar-system/`，源码放 `~/Documents/hexo/source/games/solar-system/`（`skip_render: games/**` 已覆盖，Hexo 原样拷贝）
- **导航入口**：`themes/landscape/_config.yml` 的 `menu:` 里，在 `Reagan's games` 之后加 `太阳系: /games/solar-system/`
- 部署仓库的 `scripts/sync-nav.py` 的 `NAV_ITEMS` 同步加同一项（保持退役脚本与主题配置一致）
- 页面内含返回导航（← 博客 / 🎮 游戏合集）+ 51LA 统计（同 ID 手动嵌入，与 arcade 一致）

### 文件结构
```
source/games/solar-system/
├── index.html                  页面外壳（深空主题、UI 面板、51LA）
├── main.js                     场景 / 交互 / 信息面板（ES module）
├── lib/three.module.min.js     vendored three.js（本地化，不走 CDN——国内可达性）
├── tex/earth.jpg  tex/moon.jpg NASA 公有领域贴图（约 500KB）
└── tools/build-solar.mjs       打包单文件 dist/solar-system.html（双击即玩，同 arcade 约定）
dist/solar-system.html          自包含单文件（three + main.js + 贴图内联为 data URL）
```
Three.js 版本固定（如 0.170.0）：`npm install three` 后拷贝 `build/three.module.min.js`；`main.js` 用相对路径直接 import，不需要 import map。贴图从 three.js 官方仓库 examples 拉取（公有领域；若网络受限退回程序化月球）。

### 场景内容
- 太阳：自发光球体 + 光晕；八大行星：**程序化 canvas 纹理**（木星条纹、大红斑、火星锈色、天王/海王冰蓝）+ 土星环
- 地球/月球：真实贴图；**月球绕地球公转**，选中地球后相机抵近可看地月旋转
- 轨道线（淡色圆环）、小行星带（THREE.Points）、星空背景（Points）
- 行星标签 sprite（中文 + 英文名，可开关）
- 公转/自转速度按相对比例压缩（水星最快），页面打开就在转

### 交互
- **星球胶囊按钮**：☀️太阳 🌍地球（中文+英文），点选后相机平滑飞近该天体
- **视角按钮**：全景 / 俯瞰 / 侧视 / 跟随地球 —— 平滑过渡；任意时刻可拖拽旋转、滚轮/双指缩放（自写轻量轨道控制 ~60 行，不引 OrbitControls 附件）
- **速度按钮**：⏸ / 1× / 5× / 20×（看"整个太阳系的旋转"）
- 点击 3D 里的星球（射线拾取）同样可选中
- **信息卡（中英双语）**：名称（中/英）+ 直径 / 一年多长 / 一天多长 + 一句趣味知识，中文在上英文在下；覆盖太阳、八大行星、月球共 10 个天体（例：金星——最热的行星，465°C，自转方向和别的行星相反 / Venus — the hottest planet, 465°C, spins backwards）

### 页面 UI
深空黑背景；顶栏：标题「太阳系漫游 · Solar System」+ ← 博客 / 🎮 游戏 链接；底部：星球胶囊行 + 视角/速度按钮；右侧悬浮信息卡（手机端变底部抽屉）。WebGL 不可用时显示提示文案。

### 验证与部署
1. 本地 `python3 -m http.server` 预览
2. 无头 Chrome 截图三种状态：全景旋转 / 抵近地月 / 信息卡展开（WebGL 用 swiftshader 渲染）
3. 部署：hexo generate → rsync public/ → 博客仓库 commit/push；hexo 工程 commit/push
4. 线上 curl 验证 `/games/solar-system/` 与 three 模块可访问；51LA beacon 在页面中

### 顺带
- 更新部署仓库 `scripts/sync-nav.py` 的 NAV_ITEMS（加太阳系入口）
- arcade README 不动（本板块独立于游戏合集）