# TradeGenius AutoPilot 开发指南

## 项目概述

### 项目类型
- UserScript (Tampermonkey/Greasemonkey)
- 自动化交易机器人
- 目标平台: TradeGenius.com

### 技术栈
- JavaScript ES6+
- DOM API
- 异步编程 (async/await)
- CSS-in-JS 样式

## 开发环境设置

### 安装和运行
- **安装**: 通过 Tampermonkey 扩展安装脚本
- **运行**: 在 https://www.tradegenius.com/trade 页面自动加载
- **启动**: Ctrl+Alt+S 或点击右下角控制面板的 Start 按钮
- **停止**: Ctrl+Alt+S 或点击 Stop 按钮

### 开发工具
- **调试**: 浏览器控制台查看日志
- **测试**: 手动在目标网站测试功能
- **部署**: 直接更新 GitHub 仓库的 .user.js 文件

## 代码风格指南

### 命名约定
```javascript
// 常量 - UPPER_SNAKE_CASE
const REFRESH_CONFIG = { ... };
const SWAP_CONFIG = { ... };

// 变量和函数 - camelCase
let isSwapRunning = false;
function mountUI() { ... }
function selectReceiveToken() { ... }

// CSS类名 - kebab-case
const statusDot = 'swap-status-dot';
```

### 代码结构
```javascript
// ========= 分隔注释 =========
const CONFIG = { ... };
const utils = { ... };

function mainFunction() { ... }

// 暴露全局函数
window.globalFunction = () => { ... };
```

### 注释风格
- 使用 `// ========= 标题 =========` 作为主要分隔符
- 中文注释为主，英文为辅
- 函数内使用行内注释说明关键步骤

### 错误处理模式
```javascript
try {
  // 主要逻辑
} catch (e) {
  UI.logSwap("❌ 运行出错（已自动继续）");
  console.error(e);
  await sleep(3000);
}
```

### 异步处理
- 大量使用 `async/await`
- 自定义 `sleep(ms)` 函数进行延迟控制
- Promise 链式处理

## 文件结构

### 单文件架构
- **主文件**: `tradegenius-autopilot.user.js`
- **配置区域**: 文件顶部集中定义
- **工具函数**: 统一管理
- **UI 组件**: 独立封装

### 模块组织
```javascript
// ========= 配置区 =========
const REFRESH_CONFIG = { ... };
const SWAP_CONFIG = { ... };

// ========= 工具函数 =========
const utils = { ... };

// ========= UI 面板 =========
const UI = { ... };

// ========= 核心功能 =========
// 自动刷新逻辑
// 自动交换逻辑
```

## 开发规范

### 必须遵守的规则
```javascript
/* ============================================================
 * Author: 伍壹51 | Hunter Association
 * X (Twitter): https://x.com/0x515151
 *
 * NOTICE:
 * This script is released publicly.
 * Removing or modifying author attribution is NOT permitted.
 * ============================================================ */
```

### 安全检查
```javascript
// 小保護：只在頂層頁面跑（避免 iframe 重複啟動）
if (window.top !== window.self) return;
```

### UI 面板规范
- 固定位置: `position: fixed; right: 16px; bottom: 16px`
- 统一样式: 深色主题，毛玻璃效果
- 状态指示: 绿色(运行)/红色(停止)

## 测试指南

### 测试流程
1. 在 https://www.tradegenius.com/trade 页面测试
2. 验证 UI 面板正常显示
3. 测试自动交换流程
4. 检查错误处理和恢复机制

### 调试技巧
- 使用 `console.log()` 输出调试信息
- 检查 localStorage 中的配置数据
- 监控网络请求和页面变化

## 配置管理

### 配置对象
```javascript
const REFRESH_CONFIG = {
  enabled: false,
  interval: 5000,
  // ...
};

const SWAP_CONFIG = {
  enabled: false,
  fromToken: '',
  toToken: '',
  // ...
};
```

### 持久化存储
- 使用 localStorage 保存用户设置
- 键名前缀统一: `tg_rand_refresh_*`
- 自动加载和保存配置

## 功能扩展指南

### 添加新功能
1. 在对应 CONFIG 对象中添加配置项
2. 实现核心逻辑函数
3. 更新 UI 面板（如需要）
4. 添加错误处理机制
5. 测试功能完整性

### UI 更新原则
- 保持深色主题一致性
- 遵循现有的布局和样式
- 添加状态指示和用户反馈
- 确保响应式设计

### 向后兼容性
- 保持现有配置项不变
- 新增配置项设置默认值
- 避免破坏现有功能

## 常见问题

### 调试问题
- 脚本未加载: 检查 Tampermonkey 设置
- 功能异常: 查看控制台错误信息
- UI 显示问题: 检查 CSS 样式冲突

### 性能优化
- 避免频繁的 DOM 查询
- 合理使用延迟和节流
- 及时清理事件监听器

## 部署流程

### 发布新版本
1. 更新 GitHub 仓库的 .user.js 文件
2. 测试新版本功能
3. 通知用户更新

### 版本管理
- 在文件头部添加版本信息
- 记录重要变更
- 保持更新日志

## 安全注意事项

### 代码安全
- 防止 XSS 攻击
- 输入验证和清理
- 避免全局变量污染

### 用户数据
- 不收集敏感信息
- 本地存储加密
- 透明的数据处理

---

**注意**: 此项目为公开发布的 UserScript，请遵守相关开源协议和使用条款。