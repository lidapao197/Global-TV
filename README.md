# 全球影视平台 · Global TV

基于 **TMDB** 数据的全球影视聚合浏览站：一个页面纵览 Netflix、HBO、Disney+、腾讯视频、爱奇艺、B站、tvN、ABC 等 24 个国内外平台/电视台与地区的剧集、电影、动漫、综艺榜单，支持关键词搜索与详情跳转。

纯原生 HTML / CSS / JavaScript 实现，**无框架、无构建步骤**；浏览器直接请求 TMDB 官方接口（支持跨域），**API Key 仅保存在用户自己的浏览器**（localStorage），不上传任何服务器。Cloudflare Worker 仅用于托管静态页面，不需要配置任何密钥。

## 功能特性

- **分类切换**：📺 剧集 / 🎬 电影 / 🐰 动漫 / 🎤 综艺
- **四种榜单**：🔥 热度 / 🆕 最新 / 🏆 高分 / ⏳ 即将上映
- **平台筛选**：24 个平台与电视台快捷标签（含中国内地、港台、日韩、美国）
- **全站搜索**：调用 TMDB multi search，自动过滤人物条目，只保留影视结果
- **详情弹窗**：评分、上映日期、类型标签、简介，一键跳转 TMDB 详情页 / JustWatch 找播放源
- **体验细节**：海报懒加载、骨架屏、卡片入场动画、竞态请求防护、分页、响应式布局
- **本地密钥**：右上角常驻设置入口，弹窗输入 TMDB Key 后仅保存在当前浏览器（localStorage）；未配置或 Key 失效时按钮脉冲提醒

## 目录结构

```
Global-TV/
├── index.html       # 页面结构（导航 / 筛选工具栏 / 结果网格 / 分页 / 详情弹窗）
├── index.css        # 全部样式：CSS 变量主题、布局、卡片、弹窗、骨架屏、响应式
├── index.js         # 浏览器前端脚本：平台配置、API 请求、渲染、搜索、事件交互
├── main.js          # Cloudflare Worker 入口：仅托管静态资源（页面/CSS/JS）
├── wrangler.jsonc   # Wrangler 配置：入口 main.js 与 Text 模块打包规则
└── README.md
```

> 注意：Worker 入口文件是 `main.js`（不是 wrangler 默认的 `index.js`），`wrangler.jsonc` 中已显式指定 `main`；前端三件套通过 Text 模块规则在构建时内联进 Worker。

## 架构说明

```
浏览器 (index.html + index.css + index.js)
   │  fetch('https://api.themoviedb.org/3/...?api_key=<本地Key>')
   ▼
TMDB 官方接口（支持浏览器跨域 CORS）

Cloudflare Worker (main.js)：仅托管 index.html / index.css / index.js
```

- API Key 只保存在用户浏览器 localStorage，请求直接发往 TMDB，不经过 Worker 或其他中间服务器。
- 海报与背景图直接使用 `https://image.tmdb.org/t/p/...`，并通过 `IntersectionObserver` 懒加载。
- 不使用 Worker 时，直接双击 `index.html` 或用任意静态服务器打开也能完整运行。

## 使用方法（导入项目部署到 Cloudflare Workers）

通过 **Workers Builds** 连接 Git 仓库部署：Cloudflare 在云端拉取代码、执行构建并发布，全程无需安装本地工具；之后向仓库推送代码会自动重新部署。

### 1. 推送代码到 Git 仓库

将本项目推送到 GitHub 或 GitLab（公开 / 私有仓库均可，私有仓库需在下一步授权 Cloudflare 访问）。仓库根目录需包含 `wrangler.jsonc`，构建入口与文本模块打包规则已在其中配置好。

### 2. 在 Dashboard 导入仓库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Create** → **Workers** → 选择 **Import a repository**（连接 Git）
3. 首次使用按提示授权 GitHub / GitLab，并选中本项目仓库
4. 选择生产分支（如 `main`）

### 3. 配置构建设置

- **Root directory**：留空（配置文件在仓库根目录）
- **Build command**：留空（本项目无构建步骤）
- **Deploy command**：保持默认 `npx wrangler deploy`
- Worker 名称等参数自动读取仓库中的 `wrangler.jsonc`（项目名 `global-tv`，可按需修改）

### 4. 部署

- 无需配置任何环境变量或 Secret（TMDB Key 由访客在自己浏览器中填写）
- 直接点击 **Save and Deploy**，等待云端构建完成

### 5. 访问验证并填写 Key

1. 打开分配的 `https://<worker名>.<子域>.workers.dev` 域名
2. 首次访问列表区会提示配置 Key：点击右上角齿轮（或卡片按钮），在弹窗粘贴 TMDB v3 API Key 并保存
3. 页面自动刷新加载榜单数据即成功。Key 只保存在当前浏览器，换浏览器/设备需重新填写

如需自定义域名，可在 **Settings → Domains & Routes** 中绑定。密钥在 [themoviedb.org](https://www.themoviedb.org/) 注册账号后，于「账户设置 → API」免费申请。

此后每次向生产分支 `git push`，Cloudflare 都会自动构建并发布最新版本。

## API Key 说明

| 项目 | 说明 |
| --- | --- |
| 保存位置 | 当前浏览器 localStorage（键名 `gtv_tmdb_api_key`） |
| 发送方式 | 仅以 `api_key` 查询参数直接请求 `api.themoviedb.org`，不经过本站服务器 |
| 配置入口 | 页面右上角 ⚙ 设置弹窗（可随时修改 / 清除） |

> 注意：浏览器本地保存的 Key 可被该电脑的使用者查看，请勿在公共电脑上保存；Key 泄露后可在 TMDB 后台重置。

## 数据来源

- 列表 / 搜索 / 详情：[TMDB API v3](https://developer.themoviedb.org/docs)
- 播放源查找：[JustWatch](https://www.justwatch.com/cn)（详情弹窗外链）
- 字体：Google Fonts（Noto Sans SC）

## 许可

本项目仅供学习与个人使用。影视数据与图片版权归 TMDB 及相应版权方所有。
