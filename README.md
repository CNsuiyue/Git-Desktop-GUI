<div align="center">

# Git-Desktop-GUI

**轻量级 Windows Git 桌面管理工具**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange.svg)](https://tauri.app)
[![Vue.js](https://img.shields.io/badge/Vue.js-3-green.svg)](https://vuejs.org)
[![Rust](https://img.shields.io/badge/Rust-1.70+-red.svg)](https://www.rust-lang.org)

简洁直观的 Git 图形界面，覆盖日常 Git 工作流，让版本管理更高效。

</div>

<img width="1102" height="632" alt="image" src="https://github.com/user-attachments/assets/c97792b3-1ba6-4198-920c-198a28dbd8f2" />
<img width="1102" height="632" alt="image" src="https://github.com/user-attachments/assets/d1ba70ea-87bd-489b-867e-66db2e1015e9" />


## 功能特性

| 功能 | 说明 |
|------|------|
| 📋 **暂存提交** | 查看文件变更、暂存/取消暂存、提交、查看差异 |
| 📜 **历史回滚** | 支持软回滚、混合回滚、硬回滚，撤销单个提交 |
| 🔀 **分支管理** | 创建、切换、删除本地分支 |
| 🔄 **远程同步** | Pull / Push 远程仓库，管理远程地址 |
| 📦 **Stash 管理** | 暂存工作区、恢复、删除 Stash |
| 🏷️ **标签管理** | 创建、删除本地标签 |
| ⚡ **快捷操作** | Git GC 清理、Clean 清理未跟踪文件、丢弃修改 |
| 🔐 **安全认证** | AES-256-GCM 加密存储 GitHub Token，PIN 码保护 |
| 📁 **最近项目** | 自动记录最近打开的仓库，快速切换 |
| 🧹 **缓存清理** | 一键清除应用缓存，支持选择性清理 |

## 技术栈

- **前端**：Vue 3 (Composition API) + Pinia + Vite 6
- **桌面壳**：Tauri 2 (Rust)
- **Git 操作**：直接调用系统 Git CLI

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) 1.70+
- [Tauri 依赖](https://v2.tauri.app/start/prerequisites/)（Windows 需要 Visual Studio Build Tools）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/CNsuiyue/Git-Desktop-GUI.git
cd Git-Desktop-GUI

# 安装依赖
npm install

# 开发模式运行
npm run dev
```

### 构建安装包

```bash
# 构建生产版本
npm run build
```

构建完成后，安装包位于 `src-tauri/target/release/bundle/` 目录。

## 项目结构

```
Git-Desktop-GUI/
├── src/                        # 前端源码
│   ├── components/             # Vue 组件
│   │   ├── ActionsPanel.vue    # 快捷操作面板
│   │   ├── BranchPanel.vue     # 分支管理
│   │   ├── HistoryPanel.vue    # 提交历史
│   │   ├── StatusPanel.vue     # 文件状态
│   │   └── ...                 # 其他组件
│   ├── composables/            # 组合式函数
│   │   └── useGitActions.js    # Git 操作逻辑
│   ├── stores/                 # Pinia 状态管理
│   │   └── git.js              # Git 仓库状态
│   ├── utils/                  # 工具函数
│   │   └── retry.js            # 网络请求重试
│   ├── api.js                  # Tauri API 封装
│   └── assets/                 # 静态资源
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── lib.rs              # 核心逻辑
│   │   └── main.rs             # 入口文件
│   ├── Cargo.toml              # Rust 依赖配置
│   └── tauri.conf.json         # Tauri 配置
├── package.json                # Node.js 依赖配置
└── README.md                   # 项目说明
```

## 安全说明

- **Token 加密**：使用 AES-256-GCM 加密存储，密钥由用户 PIN 码通过 PBKDF2-SHA512 派生
- **本地存储**：加密文件 `.git-auth` 仅在本地存储，不会被提交到仓库
- **内存保护**：Token 仅在应用启动时加载，后续操作从内存中读取
- **路径规范化**：自动处理 Windows 长路径（`\\?\` 前缀）
- **进程隐藏**：Git 命令执行时不再闪现 CMD 窗口

## 优化特性

- **内存优化**：限制历史记录（200条）、最近项目（10个）、Diff 内容（50KB）
- **网络重试**：关键操作自动重试，支持指数退避
- **资源清理**：组件卸载时自动清理定时器和事件监听
- **缓存优化**：Computed 属性缓存，避免重复计算
- **一键清理**：支持选择性清除历史记录、最近仓库、差异缓存

## 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<div align="center">

**如果觉得有用，请给个 ⭐ Star 支持一下！**

</div>
