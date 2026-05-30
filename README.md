# Git-Desktop-GUI

轻量级 Windows Git 桌面管理工具，提供简洁直观的操作界面，覆盖日常 Git 工作流。

## 功能

- **暂存提交** — 查看文件变更、暂存/取消暂存、提交、查看差异
- **历史回滚** — 支持软回滚、混合回滚、硬回滚，撤销单个提交
- **分支管理** — 创建、切换、删除本地分支
- **远程同步** — Pull / Push 远程仓库，管理远程地址
- **Stash 管理** — 暂存工作区、恢复、删除 Stash
- **标签管理** — 创建、删除本地标签
- **快捷操作** — Git GC 清理、Clean 清理未跟踪文件、丢弃修改
- **安全认证** — AES-256-GCM 加密存储 GitHub Token，PIN 码保护
- **最近项目** — 自动记录最近打开的仓库，快速切换

## 技术栈

- **前端**：Vue 3 (Composition API) + Pinia + Vite 6
- **桌面壳**：Tauri 2 (Rust)
- **Git 操作**：直接调用系统 Git CLI

## 项目结构

```
src/
├── components/          # Vue 组件
├── composables/         # 组合式函数
│   └── useGitActions.js # Git 操作逻辑
├── stores/              # Pinia 状态管理
│   └── git.js           # Git 仓库状态
├── utils/               # 工具函数
│   └── retry.js         # 网络请求重试
├── api.js               # Tauri API 封装
└── assets/              # 静态资源
```

## 环境要求

- Node.js 18+
- Rust 1.70+
- [Tauri 依赖](https://v2.tauri.app/start/prerequisites/)（Windows 需要 Visual Studio Build Tools）

## 启动

```bash
npm install
npm run dev
```

## 构建安装包

```bash
npm run build
```

打包后的安装包在 `src-tauri/target/release/bundle/` 目录。

## 安全说明

- GitHub Token 使用 AES-256-GCM 加密存储，密钥由用户 PIN 码通过 PBKDF2-SHA512 派生
- 加密文件 `.git-auth` 仅在本地存储，不会被提交到仓库
- 加密文件 `.git-auth` 仅在应用启动时加载，后续操作从内存中读取
- 最近项目记录存储在 `%APPDATA%\git-desktop-gui\recent-projects.json`

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
