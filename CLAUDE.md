# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 运行和测试

### 启动项目
- 在浏览器中直接打开 `index.html` 文件
- 确保网络连接正常（用于加载PixiJS v8 CDN）
- 或使用本地HTTP服务器：`python -m http.server 8000` 或 `npx serve .`

### 浏览器兼容性检查
项目需要现代浏览器支持：Chrome 80+, Firefox 78+, Safari 13+, Edge 80+

## 代码架构

### 项目结构
该项目是一个基于 PixiJS v8 的模块化图形工具，包含两个版本：
- `pixiv8-1/` - 完整版本（包含动画控制器等）
- `pixiv8-my/` - 简化版本（当前活跃使用）

### 核心架构模式
采用模块化架构，遵循单一职责原则：

1. **核心模块 (core/)**
   - `PixiApplication.js` - PixiJS应用初始化和配置
   - `StateManager.js` - 统一状态管理（发布订阅模式）

2. **图形渲染 (graphics/)**  
   - `FactoryRenderer.js` - 厂区图形渲染器
   - `PBSRenderer.js` - PBS单元渲染器

3. **控制器 (controls/)**
   - `ViewportController.js` - 视窗拖拽、缩放、平移控制

4. **工具模块 (utils/)**
   - `constants.js` - 所有配置常量
   - `geometry.js` - 几何计算工具

### 初始化流程
```javascript
// 工厂函数初始化顺序：
// 1. PixiApplication 初始化
// 2. StateManager 创建
// 3. FactoryRenderer 创建并添加到舞台
// 4. ViewportController 设置事件监听
```

### 状态管理
使用集中式状态管理器：
- 所有状态变化通过 `StateManager` 管理
- 支持状态订阅和响应式更新
- 包含图形、动画、视窗、交互等状态

### 事件系统
- 使用现代 Pointer Events API（`pointerdown/move/up`）
- 支持鼠标和触摸设备
- 快捷键支持（重置视窗等）

### 模块通信
- 通过状态管理器进行模块间通信
- 工厂函数模式创建和配置实例
- 全局暴露 `window.pixiTool` 便于调试

## 开发约定

### 添加新功能
1. 在相应模块目录下创建新文件
2. 在 `constants.js` 中添加配置项
3. 通过 `StateManager` 管理状态
4. 在主入口文件中集成

### 图形渲染
- 所有图形通过专门的渲染器类创建
- 使用 PixiJS v8 的新Graphics API语法
- 支持响应式设计和高DPI显示

### 浏览器运行
项目设计为纯前端运行，无需构建工具：
- 使用ES6模块 (`type="module"`)
- 通过CDN加载PixiJS
- 自动初始化和错误处理