# PixiJS 工具重构说明

## 🎯 重构概述

原来的 `main.js` 文件（954行）已经被重构为模块化的架构，提供更好的代码组织、可维护性和可扩展性。

## 📁 新的目录结构

```
项目根目录/
├── index.html              # 主页面（已更新）
├── index.js                # 新的主入口文件
├── main.js.backup          # 原main.js的备份文件
├── style.css               # 样式文件（无变化）
├── pixi-init.js            # 初始化文件（无变化）
├── utils/                  # 工具模块
│   ├── geometry.js         # 几何计算（已存在）
│   └── constants.js        # 常量配置（新增）
├── core/                   # 核心模块
│   ├── PixiApplication.js  # PixiJS应用核心
│   └── StateManager.js     # 状态管理器
├── graphics/               # 图形模块
│   ├── GraphicsFactory.js  # 图形工厂
│   ├── PolygonRenderer.js  # 多边形渲染器
│   ├── FactoryRenderer.js  # 厂区渲染器
│   └── PBSRenderer.js      # PBS单元渲染器
├── controls/               # 控制模块
│   ├── AnimationController.js # 动画控制器
│   └── ViewportController.js  # 视窗控制器
├── events/                 # 事件模块
│   └── KeyboardHandler.js  # 键盘事件处理器
└── ui/                     # UI模块
    └── UIController.js     # UI控制器
```

## ⚡ 主要改进

### 1. 模块化架构
- **单一职责**: 每个模块只负责特定功能
- **低耦合**: 模块之间通过清晰的接口通信
- **高内聚**: 相关功能集中在同一模块中

### 2. 状态管理
- 统一的状态管理器，避免状态分散
- 响应式状态更新机制
- 状态变化的订阅通知系统

### 3. 配置管理
- 所有常量和配置项集中管理
- 便于修改和维护配置
- 避免硬编码数值

### 4. 错误处理
- 完善的错误检查和处理
- 友好的错误提示信息
- 优雅的降级处理

## 🚀 使用方法

### 基本使用

```javascript
// 自动初始化（推荐）
// 工具会自动初始化并挂载到 window.pixiTool

// 手动初始化
import PixiTool from './index.js';

const pixiTool = new PixiTool('pixi-container');
await pixiTool.init();
```

### API 使用示例

```javascript
// 获取当前状态
const status = pixiTool.getStatus();

// 创建自定义图形
const customShape = pixiTool.addCustomShape((graphics) => {
    graphics.rect(0, 0, 100, 100);
    graphics.fill(0xff0000);
});

// 订阅状态变化
const unsubscribe = pixiTool.onStateChange((newState, oldState) => {
    console.log('状态已变化:', newState);
});

// 添加自定义快捷键
pixiTool.addShortcut('g', () => {
    console.log('按下了G键');
}, { ctrl: true });

// 控制视窗
pixiTool.pan(10, 10);           // 平移
pixiTool.zoom(1.2);             // 缩放
pixiTool.resetViewport();       // 重置视窗

// 控制动画
pixiTool.toggleRotation();      // 切换旋转

// 适应内容
const bounds = { x: 0, y: 0, width: 200, height: 200 };
pixiTool.fitToContent(bounds, 0.1);
```

## 🎮 快捷键

| 按键 | 功能 |
|------|------|
| `Space` | 切换旋转动画 |
| `0` | 重置视窗 |
| `Ctrl+R` | 重置视窗 |
| `+/-` | 缩放视窗 |
| `C` | 切换中心点显示 |
| `F` | 切换厂区显示 |
| `Esc` | 重置所有 |
| `方向键` | 平移视窗 |
| `Shift+方向键` | 快速平移 |

## 🔧 模块详解

### 核心模块 (core/)

#### PixiApplication.js
- PixiJS应用的初始化和配置
- Canvas样式设置
- 窗口大小调整处理

#### StateManager.js
- 应用状态的统一管理
- 状态变化的通知机制
- 状态持久化支持

### 图形模块 (graphics/)

#### GraphicsFactory.js
- 统一的图形创建接口
- 管理所有图形渲染器
- 提供批量创建功能

#### PolygonRenderer.js
- 多边形的创建和渲染
- 颜色更新功能
- 缩放和居中处理

#### FactoryRenderer.js
- 厂区图形的创建
- 复杂形状的绘制
- 内部细节渲染

#### PBSRenderer.js
- PBS单元的创建和管理
- 批量创建功能
- 形状类型支持

### 控制模块 (controls/)

#### AnimationController.js
- 动画的统一管理
- 多种动画效果支持
- 动画生命周期控制

#### ViewportController.js
- 视窗的拖拽、缩放、平移
- 鼠标和触摸事件处理
- 视窗边界控制

### 事件模块 (events/)

#### KeyboardHandler.js
- 键盘快捷键处理
- 自定义快捷键支持
- 输入框焦点检测

### UI模块 (ui/)

#### UIController.js
- UI交互的统一管理
- 业务逻辑协调
- 按钮状态同步

## 🔄 迁移指南

### 从原版本迁移

1. **无需代码修改**: 原有的HTML结构和按钮ID保持不变
2. **功能兼容**: 所有原有功能都已迁移
3. **性能提升**: 更好的代码组织和优化

### 回退到原版本

如果需要回退：

1. 删除新的模块文件夹（`core/`, `graphics/`, `controls/`, `events/`, `ui/`）
2. 恢复原来的 `main.js` 文件
3. 修改 `index.html` 中的 script src 为 `"main.js"`

## 🛠 扩展开发

### 添加新的图形类型

1. 在 `graphics/` 下创建新的渲染器
2. 在 `GraphicsFactory.js` 中注册新类型
3. 在 `constants.js` 中添加相关配置

### 添加新的控制器

1. 在 `controls/` 下创建新控制器
2. 在主入口文件中初始化
3. 在 UI 控制器中集成

### 添加新的事件处理

1. 在 `events/` 下创建新的处理器
2. 在主入口文件中注册
3. 在相关控制器中使用

## 📈 性能优化

- 模块按需加载
- 状态更新优化
- 事件监听器管理
- 内存泄漏防护

## 🐛 调试支持

- 完善的控制台日志
- 状态变化追踪
- 错误边界处理
- 开发者工具集成

## 📝 版本信息

- **重构版本**: 1.0.0
- **PixiJS版本**: 8.0.0
- **模块标准**: ES6 Modules
- **浏览器支持**: 现代浏览器（支持ES6+）

## 🤝 贡献指南

1. 保持模块职责单一
2. 使用统一的代码风格
3. 添加完善的JSDoc注释
4. 遵循现有的错误处理模式
5. 更新相关文档

---

**注意**: 这个重构保持了所有原有功能的完整性，同时提供了更好的代码组织和扩展能力。如有任何问题，请参考控制台输出或查看相关模块的源代码。 