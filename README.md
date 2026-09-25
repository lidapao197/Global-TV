# 全球影视平台 · Global TV

基于 **TMDB** 数据的全球影视聚合浏览站：一个页面纵览 Netflix、HBO、Disney+、腾讯视频、爱奇艺、B站、tvN、ABC 等 24 个国内外平台/电视台与地区的剧集、电影、动漫、综艺榜单，支持关键词搜索与详情跳转。

纯原生 HTML / CSS / JavaScript 实现，**无框架、无构建步骤**；Cloudflare Worker 托管静态页面并代理 TMDB 接口。密钥采用**服务端优先、本地兜底**策略：站点配置了 `TMDB_API_KEY` 时访客无需任何输入；未配置时才弹窗让用户填写自己的 Key（仅保存在浏览器 localStorage，直连 TMDB，不上传站点）。

## 功能特性

- **分类切换**：📺 剧集 / 🎬 电影 / 🐰 动漫 / 🎤 综艺
- **四种榜单**：🔥 热度 / 🆕 最新 / 🏆 高分 / ⏳ 即将上映
- **平台筛选**：24 个平台与电视台快捷标签（含中国内地、港台、日韩、美国）
- **全站搜索**：调用 TMDB multi search，自动过滤人物条目，只保留影视结果
- **详情弹窗**：评分、上映日期、集数/季数、播放平台、类型标签、简介，一键跳转 TMDB 详情页 / JustWatch 找播放源
- **体验细节**：海报懒加载、骨架屏、卡片入场动画、竞态请求防护、分页、响应式布局
- **双模式密钥**：启动先探测服务端 `TMDB_API_KEY`，已配置则走 Worker 代理（访客无感知、密钥不下发）；未配置/失效时右上角齿轮脉冲提醒，弹窗输入的 Key 仅保存在当前浏览器（localStorage）直连 TMDB

## 目录结构

```
Global-TV/
├── index.html       # 页面结构（导航 / 筛选工具栏 / 结果网格 / 分页 / 详情弹窗）
├── index.css        # 全部样式：CSS 变量主题、布局、卡片、弹窗、骨架屏、响应式
├── index.js         # 浏览器前端脚本：平台配置、API 请求、渲染、搜索、事件交互
├── main.js          # Cloudflare Worker 入口：静态托管 + /api/config 密钥探测 + /api/3 TMDB 代理
├── wrangler.jsonc   # Wrangler 配置：入口 main.js 与 Text 模块打包规则
└── README.md
```

> 注意：Worker 入口文件是 `main.js`（不是 wrangler 默认的 `index.js`），`wrangler.jsonc` 中已显式指定 `main`；前端三件套通过 Text 模块规则在构建时内联进 Worker。

## 架构说明

```
                    ┌─ GET /api/config：服务端已配置 Key？
浏览器启动 ─────────┤
                    └─ 是 → 请求 /api/3/*（Worker 注入密钥，边缘缓存 1 小时）
                       否 → 弹窗收集本地 Key → 直连 api.themoviedb.org（?api_key=）
Cloudflare Worker (main.js)：静态托管 + /api/config + /api/3 反向代理 TMDB
```

- **proxy 模式**：环境变量 `TMDB_API_KEY` 存在，浏览器只请求同源 `/api/3`，密钥永不下发；GET 榜单边缘缓存 1 小时。
- **direct 模式**：服务端无 Key（或直接双击 `index.html` 本地打开）时，用户在弹窗输入 Key，仅存 localStorage 并直连 TMDB，请求不经过 Worker、不会写入任何服务端配置。
- 服务端 Key 意外失效（TMDB 401）时，页面允许访客用自己的 Key 临时兜底。
- 海报与背景图直接使用 `https://image.tmdb.org/t/p/...`，并通过 `IntersectionObserver` 懒加载。

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

### 4.（推荐）配置服务端密钥

- 在向导的环境变量步骤添加 Secret：名称 `TMDB_API_KEY`，值填入 TMDB v3 API Key（也可部署后在 Worker 的 **Settings → Variables and Secrets** 补充）
- 配置后所有访客开箱即用，浏览器接触不到密钥；**不配置也能部署**，访客首次访问时自行在页面填写本地 Key

### 5. 部署并访问验证

- 点击 **Save and Deploy**，等待云端构建完成
- 打开分配的 `https://<worker名>.<子域>.workers.dev` 域名：
  - 已配置服务端 Secret → 榜单直接加载，页面无密钥入口
  - 未配置 → 列表区提示配置 Key，点击右上角齿轮（或卡片按钮）粘贴本地 Key，保存后自动加载
- 如需自定义域名，可在 **Settings → Domains & Routes** 中绑定

密钥在 [themoviedb.org](https://www.themoviedb.org/) 注册账号后，于「账户设置 → API」免费申请。

此后每次向生产分支 `git push`，Cloudflare 都会自动构建并发布最新版本。

## API Key 说明

| 模式 | 触发条件 | Key 存放 | 请求路径 |
| --- | --- | --- | --- |
| proxy（推荐） | Worker 配置了 Secret `TMDB_API_KEY` | Cloudflare 服务端 | 浏览器 → `/api/3` → TMDB（Worker 注入） |
| direct（兜底） | 未配置 Secret / Secret 失效 / 本地打开页面 | 用户浏览器 localStorage（`gtv_tmdb_api_key`） | 浏览器直连 `api.themoviedb.org?api_key=` |

- 本地填写的 Key **只保存在浏览器**，不会上传或写入 Cloudflare 变量，可在右上角 ⚙ 弹窗中随时修改 / 清除。
- 注意：浏览器本地保存的 Key 可被该电脑的使用者查看，请勿在公共电脑上保存；Key 泄露后可在 TMDB 后台重置。

## 数据来源

- 列表 / 搜索 / 详情：[TMDB API v3](https://developer.themoviedb.org/docs)
- 播放源查找：[JustWatch](https://www.justwatch.com/cn)（详情弹窗外链）
- 字体：Google Fonts（Noto Sans SC）

## 许可

本项目仅供学习与个人使用。影视数据与图片版权归 TMDB 及相应版权方所有。
