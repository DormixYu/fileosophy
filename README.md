<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/DormixYu/Fileosophy/main/assets/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/DormixYu/Fileosophy/main/assets/logo-light.svg">
    <img alt="飞序 · Fileosophy" src="https://raw.githubusercontent.com/DormixYu/Fileosophy/main/assets/logo-dark.svg" width="140">
  </picture>
</p>

<h1 align="center" style="font-weight:300; letter-spacing:0.35em;">飞序 · Fileosophy</h1>

<p align="center" style="font-weight:300; letter-spacing:0.4em; color:#b8b2a6; margin-top:4px;">在有序的体系中迸发思想的自由</p>

<p align="center" style="color:#7a7368; font-size:14px; margin-top:12px;">
  轻量级桌面项目管理工具 — 看板 · 甘特图 · 文件共享 · 局域网协作
</p>

<p align="center" style="margin-top:16px;">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/Tauri-2.x-orange?style=flat-square" alt="tauri" />
  <img src="https://img.shields.io/badge/Rust-2021-dea584?style=flat-square" alt="rust" />
  <img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square" alt="react" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license" />
</p>

---

## 为什么选择飞序？

传统项目管理软件要么臃肿沉重、要么依赖云端——飞序选择另一条路：

- **纯本地运行**，所有数据存储在本机 SQLite，无需账号、无需联网
- **Tauri + Rust 后端**，安装包 < 10MB，冷启动 < 1.5s，空闲内存 < 50MB
- **局域网直连协作**，mDNS 自动发现同网段实例，TCP 文件直传，不经过任何服务器
- **品牌化视觉体验**，羊皮纸质感双主题，不是冰冷的工业界面

## 功能

| 功能 | 描述 |
|------|------|
| **看板管理** | 拖拽式卡片流转，列间自由排序，标签分类、截止日期、描述 |
| **甘特图** | 时间线视图，任务依赖可视化，进度追踪，跨项目总览 |
| **看板-甘特联动** | 卡片与甘特任务双向关联，名称/日期属性自动同步 |
| **文件管理** | 双模式并存：本地文件夹树浏览 + 应用内上传管理，支持文本/图片/Markdown 预览 |
| **局域网协作** | mDNS 自动发现 → TCP 文件直传 → 文件夹加密共享，零服务器依赖 |
| **项目追踪** | 状态变更历史、里程碑管理、数据导入导出（JSON 完整数据 / CSV 摘要） |
| **全局搜索** | `Ctrl+Shift+F` 跨项目全文检索 |
| **通知系统** | Toast 即时弹窗 + 通知历史面板，支持路由跳转链接 |
| **双主题** | 墨渊暗色 / 羊皮纸亮色，噪点纹理 + 鎏金点缀 |

<!-- 截图区域，添加后取消注释
---

## 截图

<p align="center">
  <img src="screenshots/dashboard-dark.png" width="45%" alt="Dashboard 暗色" />
  <img src="screenshots/dashboard-light.png" width="45%" alt="Dashboard 亮色" />
</p>
-->

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | **Tauri 2.x** — Rust 安全沙箱，极小安装包 |
| 前端 | **React 18** · TypeScript（严格模式） · **Vite** |
| 样式 | **Tailwind CSS** — 暖色调品牌设计系统 |
| 状态 | **Zustand** — 按领域拆分 store |
| 拖拽 | **@dnd-kit/core** + @dnd-kit/sortable |
| 后端 | **Rust 2021 edition** |
| 数据库 | **SQLite**（rusqlite bundled，零外部依赖） |
| 局网发现 | **mdns-sd**（mDNS `_fileosophy._tcp.local.`） |
| 文件传输 | TCP 直连 — 4B 长度前缀 + JSON header |
| 快捷键 | tauri-plugin-global-shortcut |

## 通信架构

```
┌──────────────┐   invoke()    ┌──────────────┐
│   React 18   │ ──────────→   │  Rust 后端    │
│   前端       │               │  commands/    │
│              │ ←───────────  │              │
└──────────────┘   emit()     └──────────────┘
                                      │
                               ┌──────┴──────┐
                               │  SQLite DB   │
                               │  mDNS 发现    │
                               │  TCP 传输     │
                               └──────────────┘
```

纯 Tauri IPC，**禁止** HTTP / WebSocket / localhost fetch。

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://www.rust-lang.org/) ≥ 1.70（通过 [rustup](https://rustup.rs/) 安装）

### 开发模式

```bash
# 克隆仓库
git clone https://github.com/DormixYu/Fileosophy.git
cd Fileosophy

# 安装前端依赖
npm install

# 仅启动前端开发服务器（端口 1420）
npm run dev

# 启动完整 Tauri 桌面应用（开发模式）
npm run tauri dev
```

### 构建 & 检查

```bash
# 前端类型检查
npx tsc --noEmit

# Lint & 格式化
npm run lint
npm run format

# Rust 编译
cd src-tauri && cargo build

# Rust 测试
cd src-tauri && cargo test

# 生产构建
npm run tauri build
# 产物位于 src-tauri/target/release/bundle/
```

应用首次启动时自动在 `$APPDATA/fileosophy.db` 创建 SQLite 数据库，无需手动配置。

## 项目结构

```
fileosophy/
├── src/                        # 前端 (React + TypeScript)
│   ├── App.tsx                 #   路由入口
│   ├── components/
│   │   ├── kanban/             #   看板 (Board / Column / Card)
│   │   ├── gantt/              #   甘特图
│   │   ├── files/              #   文件管理 & 预览
│   │   ├── notifications/      #   通知中心 & Toast
│   │   ├── sharing/            #   局域网共享
│   │   └── common/             #   通用组件
│   ├── stores/                 #   Zustand 状态管理（按领域拆分）
│   ├── lib/tauri-api.ts        #   IPC 调用封装（唯一 invoke 入口）
│   └── types/index.ts          #   TypeScript 类型（与 Rust 模型一一对应）
│
├── src-tauri/                  # 后端 (Rust)
│   ├── src/
│   │   ├── commands/           #   IPC 命令（projects · kanban · gantt · files · settings · user）
│   │   ├── db/                 #   连接 · 增量迁移 · 模型
│   │   ├── events/             #   事件常量 + emit_notification()
│   │   ├── mdns/               #   mDNS 服务发现
│   │   ├── sharing/            #   TCP 文件传输协议
│   │   ├── main.rs             #   入口
│   │   └── lib.rs              #   应用启动 & 插件注册
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── assets/                     # 品牌 Logo SVG
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

## 数据库

SQLite 8 张表 + 索引，外键 `ON DELETE CASCADE`：

`projects` · `kanban_columns` · `kanban_cards` · `gantt_tasks` · `project_files` · `settings` · `users` · `project_status_history` · `project_milestones`

- `tags` / `dependencies` 以 JSON 字符串存储
- `kanban_cards.gantt_task_id` 关联甘特任务（看板-甘特联动）
- 增量迁移通过 `column_exists()` 检查，避免 `ALTER TABLE` 重复执行

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+N` | 快速新建项目 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Ctrl+Shift+S` | 显示/隐藏窗口 |

## 品牌设计

飞序的品牌标识将**文档的秩序结构**与一道**流动的思绪曲线**融为一体——飞鸟般的笔触划过严谨的文件轮廓，寓意在有序的体系中迸发思想的自由。

```
墨渊   #16120E    古卷   #221D17    墨渍   #7A7368
羊皮纸 #F6F1E6    鎏金   #C49B51    暗鎏金 #9B7428
```

字体：Cormorant Garamond Light（标题）+ DM Mono Light（正文）

## 协议

MIT License

---

<p align="center" style="color:#4a4540; font-size:11px; letter-spacing:0.2em;">
  飞序 · Fileosophy — 秩序的哲学
</p>