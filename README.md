<div align="center">

# TradeGenius AutoPilot

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-green.svg)](https://github.com/0xLukin/TradeGenius)
[![Userscript](https://img.shields.io/badge/Userscript-Tampermonkey-orange.svg)](https://www.tampermonkey.net/)

**🤖 智能自动化交易机器人**  
专为 TradeGenius 平台设计的 UI 自动化交互脚本

[⚡ 一键安装](#-安装) • [📖 使用指南](#-使用指南) • [🔧 配置选项](#-功能特色) • [🛡️ 安全说明](#-安全与免责)

*原项目作者：[51 | Hunter Association](https://x.com/0x515151) • Fork by [0xLukin](https://github.com/0xLukin)*

</div>

---

## ✨ 核心功能

| 功能 | 描述 |
|------|------|
| 🎯 | **智能代币选择** - 自动选择 USDT/USDC 中余额最大的代币 |
| 🔄 | **自动交易循环** - 智能执行 MAX/Confirm 操作流程 |
| ⏱️ | **随机延迟机制** - 模拟真实用户行为，避免检测 |
| 🎛️ | **可视化控制面板** - 右下角实时状态显示与控制 |
| ⌨️ | **快捷键支持** - `Ctrl+Alt+S` 快速启停 |
| 🔄 | **自动页面刷新** - 20-40分钟随机间隔刷新 |
| 📊 | **详细日志记录** - 实时显示操作状态和错误信息 |

---

## 🚀 快速开始

### 📋 前置要求

- 浏览器：Chrome / Edge / Firefox / Safari
- 扩展：[Tampermonkey](https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- 平台：[TradeGenius](https://www.tradegenius.com) 账户

### 🔧 安装步骤

<details>
<summary><strong>📦 详细安装指南</strong></summary>

#### 第一步：安装 Tampermonkey 扩展

**Chrome / Edge 用户：**
- 访问 Chrome Web Store：[Tampermonkey 扩展](https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- 点击 "添加到浏览器" 并完成安装

**Firefox 用户：**
- 访问 Firefox Add-ons：[Tampermonkey 扩展](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- 点击 "添加到 Firefox" 并完成安装

**Safari 用户：**
- 需要先安装 [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) 扩展
- 再安装 [Tampermonkey](https://www.tampermonkey.net/?browser=safari) (仅 macOS)

#### 第二步：安装用户脚本

**方法一：GitHub Raw 链接安装（推荐）**
1. 点击以下链接直接访问脚本文件：
   ```bash
   https://raw.githubusercontent.com/0xLukin/TradeGenius/main/tradegenius-autopilot.user.js
   ```
2. 浏览器会显示脚本代码，按 `Ctrl+A` 全选代码
3. 复制所有代码 (`Ctrl+C`)
4. 点击 Tampermonkey 图标 → "创建新脚本"
5. 粘贴代码 (`Ctrl+V`) 并按 `Ctrl+S` 保存

**方法二：GitHub 页面安装**
1. 访问项目仓库：[https://github.com/0xLukin/TradeGenius](https://github.com/0xLukin/TradeGenius)
2. 点击 `tradegenius-autopilot.user.js` 文件
3. 点击文件右上角的 "Copy" 或 "Raw" 按钮
4. 如果点击 "Raw"，复制显示的代码
5. 在 Tampermonkey 中创建新脚本并粘贴代码
6. 按 `Ctrl+S` 保存脚本

**方法三：直接文件下载**
1. 右键点击此链接：[下载 tradegenius-autopilot.user.js](https://raw.githubusercontent.com/0xLukin/TradeGenius/main/tradegenius-autopilot.user.js)
2. 选择 "链接另存为..." 保存文件到本地
3. 打开 Tampermonkey → "实用工具" → "从文件安装"
4. 选择下载的文件并安装

#### 第三步：验证安装

1. **检查脚本状态**
   - 点击 Tampermonkey 图标
   - 确认 "TradeGenius AutoPilot" 脚本已启用

2. **访问交易平台**
   ```
   https://www.tradegenius.com/trade
   ```
   - 正常情况下，页面右下角会显示控制面板
   - 如果没有显示，检查脚本是否启用

#### 第四步：开始使用

1. **启动机器人**
   - 点击右下角控制面板的 "Start" 按钮
   - 或使用快捷键 `Ctrl+Alt+S`

2. **检查状态**
   - 状态指示器变为绿色表示正在运行
   - 日志窗口会显示操作记录

</details>

<details>
<summary><strong>🔍 故障排除</strong></summary>

#### 脚本未加载
- 检查 Tampermonkey 是否启用
- 确认脚本在正确的网站运行（tradegenius.com）
- 刷新页面后重试

#### 控制面板不显示
- 按 `Ctrl+Alt+S` 强制显示
- 检查浏览器控制台是否有错误
- 确认页面加载完成后再尝试

#### 功能异常
- 查看控制面板日志窗口的错误信息
- 确认网络连接正常
- 重新启动脚本

#### 权限问题
- 确保脚本有 "GM_setValue" 和 "GM_getValue" 权限
- 在 Tampermonkey 设置中允许访问页面数据

</details>

---

## 🎮 使用指南

### 基本操作流程

```mermaid
graph LR
    A[访问交易页面] --> B[检查页面状态]
    B --> C[启动机器人]
    C --> D[自动选择代币]
    D --> E[执行交易循环]
    E --> F[监控运行状态]
    F --> G[随时停止/启动]
```

### ⚙️ 配置说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 刷新间隔 | 20-40分钟 | 随机刷新时间范围 |
| 交易延迟 | 12-25秒 | 交易间的随机等待时间 |
| 最大重试 | 20次 | Confirm 按钮点击重试次数 |
| 快捷键 | `Ctrl+Alt+S` | 启停快捷键 |

### 🎛️ 控制面板功能

- **状态指示器**：实时显示运行状态（绿色/红色）
- **操作按钮**：Start/Stop 控制
- **日志窗口**：详细操作记录和错误信息
- **刷新控制**：手动/自动页面刷新
- **快捷方式**：快速访问平台功能

---

## 🛡️ 安全与免责

> ⚠️ **重要提示**

- 本脚本仅用于 **UI 自动化** 和 **技术研究**
- 不收集、传输或存储任何用户数据
- 所有操作都在浏览器本地执行
- 使用者需自行承担所有交易风险

<details>
<summary><strong>🔒 安全特性</strong></summary>

- ✅ 无外部网络请求
- ✅ 无数据收集功能  
- ✅ 无敏感信息传输
- ✅ 开源透明代码
- ✅ 本地执行机制

</details>

<details>
<summary><strong>📜 使用协议</strong></summary>

- 本脚本为 **公开释出版本（Public Edition）**
- 严禁移除、修改或隐藏原作者署名信息
- 二次分享时请保留完整的来源与作者标示
- 使用者需遵守相关法律法规和平台规则

</details>

---

## 🤝 贡献与支持

### 📧 联系方式

| 维护者 | 联系方式 |
|--------|----------|
| 原作者 | [51 | Hunter Association](https://x.com/0x515151) |
| Fork维护 | [0xLukin](https://github.com/0xLukin) |

### 🎁 支持项目

获取 500GP 奖励：  
**[🔗 TradeGenius 推荐链接](https://www.tradegenius.com/ref/NA4QVP)**

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) - 详见 LICENSE 文件

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！**

Made with ❤️ by [TradeGenius AutoPilot Community](https://github.com/0xLukin/TradeGenius-AutoPilot)

</div>
