# DevMood 🎯

> [English](#english) | [中文](#chinese)

<a name="english"></a>
## English

A sleek, intelligent developer productivity & state monitoring tool built with Electron, React, and Vite.
DevMood tracks your keyboard and mouse activity locally to analyze your working condition (Focused, Fatigued, Stuck, Frustrated, or Slacking) and sends you humorous AI-generated reminders to take breaks or stay focused.

### ✨ Features
- **Real-time Activity Detection**: Leverages `uiohook-napi` to natively monitor keystrokes, mouse events, and scrolls entirely offline.
- **Smart State Analysis**: Employs rule-based and trend-analysis systems to confidently classify your current working state with an overall efficiency score.
- **App Usage Analytics**: Automatically captures cross-platform active window titles (using `active-win`) to calculate exactly which applications dominate your time.
- **AI Reminders**: Connects to any OpenAI-compatible LLM endpoint to act as your personalized "supervisor," delivering hilariously toxic or encouraging reminders based on your live state context.
- **Historical Analytics**: Gorgeous data visualization charts displaying your flow progression, efficiency scores, and app usage leaderboards over 7 or 30 days.
- **Absolute Data Privacy**: All telemetry and user preferences are safely locked inside a local `SQLite` database, supporting simple JSON backups and full restores.

### 🚀 Getting Started

#### Prerequisites
- Node.js (v18+)
- (macOS only) System Accessibility Permissions (needed by `uiohook-napi` and `active-win` to track inputs safely globally)

#### Installation
```bash
npm install
```

#### Local Development
```bash
npm run electron:dev
```

#### Build & Package Native Application
```bash
npm run electron:build
```

### 🛠 Tech Stack
- **Desktop Framework**: [Electron](https://www.electronjs.org/)
- **Frontend**: React 19 + Vite + TypeScript
- **UI Library**: [Ant Design (Dark Theme)](https://ant.design/) + [Recharts](https://recharts.org/)
- **Data Persistence**: `sqlite3` via `sql.js` (WebAssembly SQLite)
- **Native Bridges**: `uiohook-napi` (Global Input Tracking) & `active-win` (Active Process Radar)

---

<a name="chinese"></a>
## 中文

一款极简、高颜值的全平台前端开发者状态监测与效率提升助手。基于 Electron + React + Vite 构建。
它能在本地后台静默分析您的原生键鼠操作习惯（高频敲击、鼠标漫游、长时间停滞等），智能推算出您此刻是处于“心流专注”、“代码写累了”、“卡主思考”、“烦躁”还是在“偷偷摸摸”的状态，并在效率跌入谷底的时候，奉上 AI 生成的专属吐槽与鼓励。

### ✨ 核心亮点
- **全局环境监测**：深度集成 `uiohook-napi` 获取真实的系统级键盘和鼠标输入事件；自带原生 `active-win` 支持，实时获取您当前正在使用的最顶层软件（自动识别 IDE 或 浏览器环境），Mac/Win 双端通吃。
- **智能效率推断**：内置基于统计学的时间切片规则，能精准推算出你的当前连续 0~100 工作效率评分。
- **软件使用排行榜**：支持日/周/月度的时间去向溯源，精准展示“浏览器”或者“代码编辑器”在今天占用了你多少时间。
- **AI 毒舌监工**：支持无感配置所有满足 OpenAI 接口标准的大语言模型（如 DeepSeek, GPT-4, 豆包, 千问等），通过发送运行时特有上下文，将冷冰冰的定时弹窗提醒变成独具灵魂的打工人伴侣。
- **数据全景分析**：集成 Recharts 自定义无损仪表盘，帮你全景复盘近 7 天或 30 天的生产力波动点。
- **数据隐私至上**：您的所有敲击隐私均完全离线。所有结构化状态都落在底层被 WebAssembly 解析的 `SQLite` 中，您可以随时点击一键备份或进行恢复导入，拒绝数据绑架。

### 🚀 运行指南

#### 环境准备
- Node.js (v18+)
- 如果在 macOS 上运行，首次打开应用后需要前往 `系统设置 -> 隐私与安全性 -> 辅助功能` 中勾选终端(或应用本身)的权限以允许全局输入拦截。

#### 依赖安装
```bash
npm install
```

#### 本地开发 (热更新)
```bash
npm run electron:dev
```

#### 构建独立安装包 (.dmg / .exe)
```bash
npm run electron:build
```

### 🛠 技术栈概览
- **跨端底层**: Electron
- **前端页面**: React 19 + Vite 开发服务器 + TypeScript
- **组件及图表**: Ant Design (深度定制暗黑主题) + Recharts
- **微型数据库**: `sql.js` (WebAssembly 版 SQLite)
- **原生能力桥接**: `uiohook-napi` (底层键鼠埋点) & `active-win` (顶层进程雷达)
