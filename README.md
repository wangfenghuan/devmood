# DevMood 🎯

A sleek, intelligent developer productivity & state monitoring tool built with Electron, React, and Vite.
DevMood tracks your keyboard and mouse activity locally to analyze your working condition (Focused, Fatigued, Stuck, Frustrated, or Slacking) and sends you humorous AI-generated reminders to take breaks or stay focused.

## ✨ Features
- **Real-time Activity Detection**: Leverages `uiohook-napi` to natively monitor keystrokes, mouse events, and scrolls entirely offline.
- **Smart State Analysis**: Employs rule-based and trend-analysis systems to confidently classify your current working state with an overall efficiency score.
- **App Usage Analytics**: Automatically captures cross-platform active window titles (using `active-win`) to calculate exactly which applications dominate your time.
- **AI Reminders**: Connects to any OpenAI-compatible LLM endpoint to act as your personalized "supervisor," delivering hilariously toxic or encouraging reminders based on your live state context.
- **Historical Analytics**: Gorgeous data visualization charts displaying your flow progression, efficiency scores, and app usage leaderboards over 7 or 30 days.
- **Absolute Data Privacy**: All telemetry and user preferences are safely locked inside a local `SQLite` database, supporting simple JSON backups and full restores.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- (macOS only) System Accessibility Permissions (needed by `uiohook-napi` and `active-win` to track inputs safely globally)

### Installation
```bash
npm install
```

### Local Development
```bash
npm run electron:dev
```

### Build & Package Native Application
```bash
npm run electron:build
```

## 🛠 Tech Stack
- **Desktop Framework**: [Electron](https://www.electronjs.org/)
- **Frontend**: React 19 + Vite + TypeScript
- **UI Library**: [Ant Design (Dark Theme)](https://ant.design/) + [Recharts](https://recharts.org/)
- **Data Persistence**: `sqlite3` via `sql.js` (WebAssembly SQLite)
- **Native Bridges**: `uiohook-napi` (Global Input Tracking) & `active-win` (Active Process Radar)
