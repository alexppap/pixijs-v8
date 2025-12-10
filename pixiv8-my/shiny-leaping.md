# pixiv8-my 架构优化与重构方案

## 一、总体评估

### 当前架构优点
- ✅ 模块化清晰：core、graphics、controls、utils 职责分离
- ✅ 配置集中：constants.js 统一管理所有配置
- ✅ 工厂模式：createPixiTool() 提供灵活初始化
- ✅ 交互完整：支持缩放、平移、PBS移动等多种交互
- ✅ 坐标系处理正确：canvas → world → local 三层坐标转换

### 主要问题（按优先级）

#### 🔴 高优先级
1. **FactoryRenderer 与 PBSRenderer 强耦合** - FactoryRenderer 直接 new PBSRenderer
2. **ViewportController 硬编码假设** - 假设 `app.stage.children[0]` 是厂区
3. **PBS单元检测不准确** - 通过 instanceof Graphics 判断，可能误触其他 Graphics
4. **状态频繁更新无节流** - pointermove 事件 60Hz+ 频率，每次都触发 setState

#### 🟡 中优先级
5. **订阅机制未充分利用** - StateManager 实现了订阅，但几乎未被使用
6. **扩展性受限** - 仅支持单一厂区，不支持多图形并存
7. **缺少资源清理** - 无 destroy() 方法，可能内存泄漏
8. **坐标计算逻辑重复** - wheel 和 pointerMove 中有相同转换代码

#### 🟢 低优先级
9. **PBS查找 O(n) 复杂度** - 线性遍历，PBS数量多时性能差
10. **缺少错误处理** - 无边界检查和异常捕获

### 重构必要性评估
**建议：渐进式优化重构（非推倒重写）**

理由：
- 代码规模适中（1,604行），基础架构合理
- 主要问题可通过局部重构解决
- 保留现有优势，降低重构风险

---

## 二、渐进式重构方案（3个阶段）

### 阶段 1：解耦与性能优化（高优先级）
**目标**：解决强耦合和性能问题，不改变现有功能

#### 改进点 1.1：解耦渲染器依赖
**当前问题**：
```javascript
// FactoryRenderer.js - 硬编码依赖
const pbsRenderer = new PBSRenderer();
```

**优化方案**：依赖注入模式
```javascript
// FactoryRenderer 构造函数接收 pbsRenderer
constructor(app, pbsRenderer = null) {
  this.pbsRenderer = pbsRenderer || new PBSRenderer();
}
```

**收益**：
- 降低耦合度，便于单元测试
- 支持自定义 PBS 渲染器

**修改文件**：
- `graphics/FactoryRenderer.js`
- `index.js`（初始化逻辑）

---

#### 改进点 1.2：消除硬编码假设
**当前问题**：
```javascript
// ViewportController.js:getPBSAtPoint()
const factory = this.app.stage.children[0];  // 假设第一个子元素是厂区
```

**优化方案**：通过 StateManager 获取图形引用
```javascript
// StateManager 添加方法
setFactoryGraphic(graphic) {
  this.setState({ factoryGraphic: graphic });
}

// ViewportController 改为
const factory = this.stateManager.get('factoryGraphic');
```

**收益**：
- 消除硬编码假设
- 支持动态切换图形
- 提高代码健壮性

**修改文件**：
- `core/StateManager.js`（添加 factoryGraphic 状态）
- `controls/ViewportController.js`（修改 getPBSAtPoint）
- `index.js`（初始化时设置 factoryGraphic）

---

#### 改进点 1.3：PBS单元精准识别
**当前问题**：
```javascript
// 通过 instanceof 判断，可能误触其他 Graphics
if (child instanceof Graphics) { ... }
```

**优化方案**：为 PBS 单元添加标识属性
```javascript
// PBSRenderer.createUnit() 添加
graphic.isPBS = true;
graphic.pbsId = generateId();  // 可选：唯一ID

// ViewportController 判断改为
if (child.isPBS) { ... }
```

**收益**：
- 精准识别 PBS 单元
- 避免误触其他 Graphics
- 支持 PBS 单元追踪

**修改文件**：
- `graphics/PBSRenderer.js`
- `controls/ViewportController.js`

---

#### 改进点 1.4：添加节流优化
**当前问题**：
```javascript
// pointermove 事件频率 60Hz+，频繁触发 setState
handlePointerMove(event) {
  // ... 每次移动都更新状态
  this.stateManager.updateViewport(newViewport);
  this.stateManager.setDragging(true, { x, y });
}
```

**优化方案**：添加节流机制
```javascript
// ViewportController 添加节流标志
constructor(app, stateManager) {
  this.throttleTimer = null;
  this.pendingUpdate = null;
}

handlePointerMove(event) {
  // 立即更新视图
  this.app.stage.position.set(newX, newY);
  if (!this.app.autoStart) this.app.render();

  // 节流更新状态（16ms = 60fps）
  this.pendingUpdate = { viewport: newViewport, position: { x, y } };
  if (!this.throttleTimer) {
    this.throttleTimer = setTimeout(() => {
      if (this.pendingUpdate) {
        this.stateManager.updateViewport(this.pendingUpdate.viewport);
        this.stateManager.setDragging(true, this.pendingUpdate.position);
      }
      this.throttleTimer = null;
    }, 16);
  }
}
```

**收益**：
- 减少状态更新频率（60Hz → 60fps）
- 降低订阅者回调开销
- 保持视觉流畅度

**修改文件**：
- `controls/ViewportController.js`

---

#### 改进点 1.5：提取坐标转换工具
**当前问题**：wheel 和 pointerMove 中重复坐标转换代码

**优化方案**：提取为工具方法
```javascript
// ViewportController 添加私有方法
_canvasToWorld(canvasX, canvasY) {
  const { x, y, scale } = this.stateManager.get('viewport');
  return {
    x: (canvasX - x) / scale,
    y: (canvasY - y) / scale
  };
}

_worldToCanvas(worldX, worldY) {
  const { x, y, scale } = this.stateManager.get('viewport');
  return {
    x: worldX * scale + x,
    y: worldY * scale + y
  };
}
```

**收益**：
- 消除代码重复
- 提高可维护性
- 便于单元测试

**修改文件**：
- `controls/ViewportController.js`

---

### 阶段 2：功能增强与架构优化（中优先级）
**目标**：充分利用订阅机制，增强扩展性

#### 改进点 2.1：激活订阅机制
**当前问题**：StateManager 实现了订阅，但几乎未被使用

**优化方案**：建立响应式更新机制
```javascript
// ViewportController 订阅视窗变化
constructor(app, stateManager) {
  // ...
  this.unsubscribe = stateManager.subscribe((newState, oldState) => {
    if (newState.viewport !== oldState.viewport) {
      this._updateStageTransform(newState.viewport);
    }
    if (newState.pbsMoveable !== oldState.pbsMoveable) {
      this._updateCursor();
    }
  });
}

_updateStageTransform(viewport) {
  this.app.stage.position.set(viewport.x, viewport.y);
  this.app.stage.scale.set(viewport.scale);
  if (!this.app.autoStart) this.app.render();
}
```

**收益**：
- 实现真正的状态驱动
- 状态与视图自动同步
- 便于调试和状态回溯

**修改文件**：
- `controls/ViewportController.js`
- 可选：添加 UI 订阅器（未来扩展）

---

#### 改进点 2.2：支持多图形管理
**当前问题**：StateManager 仅支持单一 currentGraphic

**优化方案**：改为图形集合管理
```javascript
// StateManager 状态结构调整
this.state = {
  // 改为数组或 Map
  graphics: [],  // [{ id, type, graphic, layer }]
  activeGraphicId: null,

  // 或使用 Map（更高效）
  graphicsMap: new Map(),  // id -> { type, graphic, layer }
  activeGraphicId: null,
}

// 添加图形管理方法
addGraphic(id, type, graphic, layer = 0) {
  this.graphicsMap.set(id, { type, graphic, layer });
}

removeGraphic(id) {
  this.graphicsMap.delete(id);
}

getGraphic(id) {
  return this.graphicsMap.get(id);
}

setActiveGraphic(id) {
  this.setState({ activeGraphicId: id });
}
```

**收益**：
- 支持多个图形并存
- 支持图形分层管理
- 为复杂场景打基础

**修改文件**：
- `core/StateManager.js`
- `index.js`（适配新的图形管理）
- `controls/ViewportController.js`（适配获取图形逻辑）

---

#### 改进点 2.3：添加资源清理
**当前问题**：无 destroy() 方法，长期运行可能内存泄漏

**优化方案**：为所有模块添加 destroy() 方法
```javascript
// PixiApplication.destroy()
destroy() {
  if (this.app) {
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
    this.app = null;
  }
}

// StateManager.destroy()
destroy() {
  this.subscribers = [];
  this.state = null;
}

// ViewportController.destroy()
destroy() {
  if (this.unsubscribe) this.unsubscribe();
  this.removeEventListeners();
  this.app = null;
  this.stateManager = null;
}

// FactoryRenderer.destroy()
destroy() {
  if (this.pbsRenderer) {
    this.pbsRenderer.destroy();
  }
  if (this.factory) {
    this.factory.destroy({ children: true });
  }
}

// PixiTool.destroy()
destroy() {
  this.viewportController.destroy();
  this.graphicsFactory.destroy();
  this.stateManager.destroy();
  this.pixiApp.destroy();
}
```

**收益**：
- 防止内存泄漏
- 支持多实例场景
- 提高应用健壮性

**修改文件**：
- `core/PixiApplication.js`
- `core/StateManager.js`
- `graphics/FactoryRenderer.js`
- `graphics/PBSRenderer.js`
- `controls/ViewportController.js`
- `index.js`（PixiTool 类）

---

#### 改进点 2.4：批量状态更新
**当前问题**：
```javascript
// 多次状态更新导致多次订阅者通知
this.stateManager.updateViewport(newViewport);
this.stateManager.setDragging(true, { x, y });  // 两次通知
```

**优化方案**：添加批量更新 API
```javascript
// StateManager 添加
batchUpdate(callback) {
  this.isBatching = true;
  const oldState = { ...this.state };

  callback();

  this.isBatching = false;
  this.notifySubscribers(this.state, oldState);
}

// setState 改为
setState(newState) {
  const oldState = { ...this.state };
  this.state = { ...this.state, ...newState };

  if (!this.isBatching) {
    this.notifySubscribers(this.state, oldState);
  }
}

// ViewportController 使用
this.stateManager.batchUpdate(() => {
  this.stateManager.updateViewport(newViewport);
  this.stateManager.setDragging(true, { x, y });
});
```

**收益**：
- 减少订阅者通知次数
- 提高性能
- 保证状态更新原子性

**修改文件**：
- `core/StateManager.js`
- `controls/ViewportController.js`

---

### 阶段 3：高级优化（低优先级）
**目标**：针对大规模场景的性能优化

#### 改进点 3.1：PBS单元空间索引
**适用场景**：PBS单元数量 > 100 时

**优化方案**：使用空间哈希或四叉树
```javascript
// 新增 utils/SpatialIndex.js
class SpatialHash {
  constructor(cellSize = 50) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  insert(pbs, x, y) {
    const key = this._getCellKey(x, y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(pbs);
  }

  query(x, y, radius = 10) {
    const results = [];
    // 查询周围9个格子
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = this._getCellKey(x + dx * this.cellSize, y + dy * this.cellSize);
        if (this.grid.has(key)) {
          results.push(...this.grid.get(key));
        }
      }
    }
    return results;
  }

  _getCellKey(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  clear() {
    this.grid.clear();
  }
}
```

**修改文件**：
- 新增 `utils/SpatialIndex.js`
- `controls/ViewportController.js`（使用空间索引查询）

---

#### 改进点 3.2：对象池
**适用场景**：频繁创建/销毁 PBS 单元时

**优化方案**：
```javascript
// 新增 utils/ObjectPool.js
class GraphicsPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = new Set();

    // 预创建对象
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  acquire() {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.createFn();
    }
    this.active.add(obj);
    return obj;
  }

  release(obj) {
    this.active.delete(obj);
    this.resetFn(obj);
    this.pool.push(obj);
  }

  clear() {
    this.pool = [];
    this.active.clear();
  }
}
```

**修改文件**：
- 新增 `utils/ObjectPool.js`
- `graphics/PBSRenderer.js`（使用对象池）

---

#### 改进点 3.3：错误边界与日志
**优化方案**：添加错误处理和日志系统
```javascript
// 新增 utils/Logger.js
class Logger {
  static ERROR = 'ERROR';
  static WARN = 'WARN';
  static INFO = 'INFO';

  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    console[level.toLowerCase()](`[${timestamp}] [${level}] ${message}`, data);
  }

  static error(message, error) {
    this.log(this.ERROR, message, error);
  }

  static warn(message, data) {
    this.log(this.WARN, message, data);
  }

  static info(message, data) {
    this.log(this.INFO, message, data);
  }
}

// 在关键位置添加错误处理
try {
  // 风险操作
} catch (error) {
  Logger.error('操作失败', error);
  // 降级处理
}
```

**修改文件**：
- 新增 `utils/Logger.js`
- 所有模块添加错误处理

---

## 三、关键文件修改清单

### 阶段 1 修改（必须）
| 文件 | 修改类型 | 改进点 |
|------|---------|--------|
| `graphics/FactoryRenderer.js` | 修改 | 1.1 依赖注入 |
| `graphics/PBSRenderer.js` | 修改 | 1.3 添加 isPBS 标识 |
| `core/StateManager.js` | 新增 | 1.2 添加 factoryGraphic 状态 |
| `controls/ViewportController.js` | 重构 | 1.2, 1.3, 1.4, 1.5 综合修改 |
| `index.js` | 修改 | 1.1, 1.2 初始化逻辑调整 |

### 阶段 2 修改（推荐）
| 文件 | 修改类型 | 改进点 |
|------|---------|--------|
| `core/StateManager.js` | 重构 | 2.1, 2.2, 2.4 状态管理增强 |
| `core/PixiApplication.js` | 新增 | 2.3 添加 destroy() |
| `graphics/FactoryRenderer.js` | 新增 | 2.3 添加 destroy() |
| `graphics/PBSRenderer.js` | 新增 | 2.3 添加 destroy() |
| `controls/ViewportController.js` | 修改 | 2.1 订阅机制，2.4 批量更新 |
| `index.js` | 新增 | 2.3 添加 destroy() |

### 阶段 3 修改（可选）
| 文件 | 修改类型 | 改进点 |
|------|---------|--------|
| `utils/SpatialIndex.js` | 新增 | 3.1 空间索引 |
| `utils/ObjectPool.js` | 新增 | 3.2 对象池 |
| `utils/Logger.js` | 新增 | 3.3 日志系统 |
| `controls/ViewportController.js` | 修改 | 3.1 使用空间索引 |
| `graphics/PBSRenderer.js` | 修改 | 3.2 使用对象池 |

---

## 四、实施顺序与依赖关系

```
阶段 1（1-2天）
├─ 1.1 依赖注入 ← 独立
├─ 1.2 消除硬编码 ← 独立
├─ 1.3 PBS识别 ← 独立
├─ 1.4 节流优化 ← 独立
└─ 1.5 坐标工具 ← 独立

阶段 2（2-3天）
├─ 2.3 资源清理 ← 独立（优先）
├─ 2.4 批量更新 ← 依赖 StateManager
├─ 2.1 订阅机制 ← 依赖 2.4
└─ 2.2 多图形管理 ← 依赖 2.1（可选）

阶段 3（按需）
├─ 3.3 日志系统 ← 独立（优先）
├─ 3.1 空间索引 ← 仅 PBS 数量 > 100 时
└─ 3.2 对象池 ← 仅频繁创建/销毁时
```

---

## 五、验证标准

### 阶段 1 验证
- [ ] FactoryRenderer 可通过构造函数注入 PBSRenderer
- [ ] ViewportController 不再假设 children[0] 是厂区
- [ ] PBS 单元点击检测无误触其他 Graphics
- [ ] pointermove 事件状态更新频率 ≤ 60fps
- [ ] 无坐标转换代码重复

### 阶段 2 验证
- [ ] 所有模块有 destroy() 方法且正常工作
- [ ] 状态变化能正确触发订阅者回调
- [ ] 批量更新减少订阅者通知次数
- [ ] 支持添加/移除多个图形（如果实施 2.2）

### 阶段 3 验证
- [ ] PBS 数量 > 100 时，点击检测性能提升
- [ ] 频繁创建/销毁 PBS 时无内存波动
- [ ] 错误能被正确捕获和记录

---

## 六、风险评估与缓解

### 风险 1：重构破坏现有功能
**风险等级**：中
**缓解措施**：
- 每个改进点独立实施，逐一验证
- 保留原有代码注释作为参考
- 实施前备份代码（git commit）

### 风险 2：性能优化效果不明显
**风险等级**：低
**缓解措施**：
- 使用 Chrome DevTools Performance 分析
- 对比优化前后的帧率和内存使用
- PBS 数量 < 50 时，阶段3优化可跳过

### 风险 3：订阅机制增加复杂度
**风险等级**：低
**缓解措施**：
- 仅在需要响应式更新的地方使用
- 提供清晰的订阅/取消订阅模板代码
- 添加调试日志追踪订阅者

### 风险 4：多图形管理改动较大
**风险等级**：中
**缓解措施**：
- 此项为可选优化（改进点 2.2）
- 如无多图形需求可暂缓实施
- 实施时保持向后兼容（通过适配器）

---

## 七、向后兼容性保证

### 兼容策略
1. **API 兼容**：保留所有现有公共方法
2. **渐进增强**：新功能作为可选参数
3. **软过渡**：旧代码路径保留，添加弃用警告

### 示例：多图形管理的向后兼容
```javascript
// StateManager 兼容旧API
get(key) {
  // 兼容旧的 currentGraphic
  if (key === 'currentGraphic') {
    const activeId = this.state.activeGraphicId;
    return activeId ? this.state.graphicsMap.get(activeId)?.graphic : null;
  }
  return this.state[key];
}

set(key, value) {
  // 兼容旧的 currentGraphic
  if (key === 'currentGraphic') {
    console.warn('currentGraphic is deprecated, use setActiveGraphic() instead');
    // 自动转换为新API
    const id = 'legacy';
    this.addGraphic(id, 'factory', value);
    this.setActiveGraphic(id);
    return;
  }
  this.setState({ [key]: value });
}
```

---

## 八、代码示例（关键改进点）

### 示例 1：依赖注入改造（改进点 1.1）

**修改前**：
```javascript
// graphics/FactoryRenderer.js
class FactoryRenderer {
  constructor(app) {
    this.app = app;
    this.pbsRenderer = new PBSRenderer();  // 硬编码依赖
  }
}
```

**修改后**：
```javascript
// graphics/FactoryRenderer.js
class FactoryRenderer {
  constructor(app, pbsRenderer = null) {
    this.app = app;
    // 支持依赖注入，提供默认值
    this.pbsRenderer = pbsRenderer || new PBSRenderer();
  }
}

// index.js - 使用默认
const graphicsFactory = new FactoryRenderer(app);

// index.js - 自定义注入
const customPBSRenderer = new PBSRenderer();
const graphicsFactory = new FactoryRenderer(app, customPBSRenderer);
```

---

### 示例 2：PBS 精准识别（改进点 1.3）

**修改前**：
```javascript
// controls/ViewportController.js
getPBSAtPoint(x, y) {
  const factory = this.app.stage.children[0];
  for (const child of factory.children) {
    if (child instanceof Graphics) {  // 可能误触其他 Graphics
      const bounds = child.getBounds();
      if (bounds.contains(x, y)) {
        return child;
      }
    }
  }
  return null;
}
```

**修改后**：
```javascript
// graphics/PBSRenderer.js
createUnit(pbsData) {
  const { x, y, color, shape = 'circle', size = 5 } = pbsData;
  const graphic = new Graphics();

  // 添加标识属性
  graphic.isPBS = true;
  graphic.pbsData = { color, shape, size };  // 保存元数据

  // ... 绘制逻辑
  return graphic;
}

// controls/ViewportController.js
getPBSAtPoint(x, y) {
  const factory = this.stateManager.get('factoryGraphic');
  if (!factory) return null;

  for (const child of factory.children) {
    if (child.isPBS) {  // 精准识别 PBS
      const bounds = child.getBounds();
      if (bounds.contains(x, y)) {
        return child;
      }
    }
  }
  return null;
}
```

---

### 示例 3：节流优化（改进点 1.4）

**修改前**：
```javascript
// controls/ViewportController.js
handlePointerMove(event) {
  if (!this.stateManager.get('isDragging')) return;

  // ... 计算新位置

  // 频繁更新状态（60Hz+）
  this.stateManager.updateViewport({ x: newX, y: newY });
  this.stateManager.setDragging(true, { x, y });
}
```

**修改后**：
```javascript
// controls/ViewportController.js
constructor(app, stateManager) {
  this.app = app;
  this.stateManager = stateManager;
  this.throttleTimer = null;
  this.pendingStateUpdate = null;
}

handlePointerMove(event) {
  if (!this.stateManager.get('isDragging')) return;

  // ... 计算新位置

  // 立即更新视图（保持流畅）
  this.app.stage.position.set(newX, newY);
  if (!this.app.autoStart) {
    this.app.render();
  }

  // 节流更新状态（16ms = 60fps）
  this.pendingStateUpdate = {
    viewport: { x: newX, y: newY, scale: viewport.scale },
    position: { x, y }
  };

  if (!this.throttleTimer) {
    this.throttleTimer = setTimeout(() => {
      if (this.pendingStateUpdate) {
        this.stateManager.batchUpdate(() => {
          this.stateManager.updateViewport(this.pendingStateUpdate.viewport);
          this.stateManager.setDragging(true, this.pendingStateUpdate.position);
        });
        this.pendingStateUpdate = null;
      }
      this.throttleTimer = null;
    }, 16);
  }
}
```

---

### 示例 4：资源清理（改进点 2.3）

```javascript
// index.js
export class PixiTool {
  constructor(components) {
    this.pixiApp = components.pixiApp;
    this.stateManager = components.stateManager;
    this.graphicsFactory = components.graphicsFactory;
    this.viewportController = components.viewportController;
  }

  // 新增销毁方法
  destroy() {
    console.log('Destroying PixiTool...');

    // 按依赖顺序反向销毁
    if (this.viewportController) {
      this.viewportController.destroy();
      this.viewportController = null;
    }

    if (this.graphicsFactory) {
      this.graphicsFactory.destroy();
      this.graphicsFactory = null;
    }

    if (this.stateManager) {
      this.stateManager.destroy();
      this.stateManager = null;
    }

    if (this.pixiApp) {
      this.pixiApp.destroy();
      this.pixiApp = null;
    }

    console.log('PixiTool destroyed');
  }
}

// controls/ViewportController.js
destroy() {
  console.log('Destroying ViewportController...');

  // 取消订阅
  if (this.unsubscribe) {
    this.unsubscribe();
    this.unsubscribe = null;
  }

  // 移除事件监听
  this.removeEventListeners();

  // 清除定时器
  if (this.throttleTimer) {
    clearTimeout(this.throttleTimer);
    this.throttleTimer = null;
  }

  // 清除引用
  this.app = null;
  this.stateManager = null;
  this.pendingStateUpdate = null;
}

removeEventListeners() {
  const canvas = this.app?.canvas;
  if (!canvas) return;

  canvas.removeEventListener('wheel', this.boundHandleWheel);
  canvas.removeEventListener('pointerdown', this.boundHandlePointerDown);
  window.removeEventListener('pointermove', this.boundHandlePointerMove);
  window.removeEventListener('pointerup', this.boundHandlePointerUp);
  // ... 移除其他监听器
}
```

---

### 示例 5：批量状态更新（改进点 2.4）

```javascript
// core/StateManager.js
class StateManager {
  constructor() {
    this.state = { /* ... */ };
    this.subscribers = [];
    this.isBatching = false;
    this.batchedOldState = null;
  }

  // 新增批量更新方法
  batchUpdate(updateFn) {
    if (this.isBatching) {
      // 已在批量模式，直接执行
      updateFn();
      return;
    }

    this.isBatching = true;
    this.batchedOldState = { ...this.state };

    try {
      updateFn();
    } finally {
      this.isBatching = false;
      // 批量结束，统一通知
      this.notifySubscribers(this.state, this.batchedOldState);
      this.batchedOldState = null;
    }
  }

  setState(newState) {
    const oldState = this.isBatching ? this.batchedOldState : { ...this.state };
    this.state = { ...this.state, ...newState };

    // 批量模式下不立即通知
    if (!this.isBatching) {
      this.notifySubscribers(this.state, oldState);
    }
  }
}

// 使用示例
stateManager.batchUpdate(() => {
  stateManager.updateViewport({ x: 100, y: 100 });
  stateManager.setDragging(true, { x: 50, y: 50 });
  stateManager.set('pbsMoveable', true);
  // 以上三次更新只触发一次订阅者通知
});
```

---

## 九、测试建议

### 单元测试示例

```javascript
// tests/StateManager.test.js
describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  afterEach(() => {
    stateManager.destroy();
  });

  test('批量更新只通知一次', () => {
    const callback = jest.fn();
    stateManager.subscribe(callback);

    stateManager.batchUpdate(() => {
      stateManager.set('isDragging', true);
      stateManager.updateViewport({ x: 100 });
      stateManager.set('pbsMoveable', false);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('destroy 清除所有订阅者', () => {
    stateManager.subscribe(() => {});
    stateManager.subscribe(() => {});

    expect(stateManager.subscribers.length).toBe(2);

    stateManager.destroy();

    expect(stateManager.subscribers.length).toBe(0);
  });
});

// tests/ViewportController.test.js
describe('ViewportController', () => {
  test('节流减少状态更新频率', async () => {
    const stateManager = new StateManager();
    const updateSpy = jest.spyOn(stateManager, 'updateViewport');

    const controller = new ViewportController(mockApp, stateManager);

    // 模拟快速移动（10次）
    for (let i = 0; i < 10; i++) {
      controller.handlePointerMove(mockEvent);
    }

    // 等待节流结束
    await new Promise(resolve => setTimeout(resolve, 20));

    // 应该少于10次调用
    expect(updateSpy.mock.calls.length).toBeLessThan(10);
  });
});
```

### 手动测试清单

**阶段1验证**：
- [ ] 创建 FactoryRenderer 时传入自定义 PBSRenderer，验证正常工作
- [ ] 在没有图形时点击画布，验证不报错
- [ ] 点击 PBS 单元，验证不会误触厂区边界
- [ ] 快速拖拽画布，使用 Performance 监控，验证状态更新频率 ≤ 60fps
- [ ] 使用 wheel 和 pan 功能，验证坐标转换正确

**阶段2验证**：
- [ ] 调用 `pixiTool.destroy()`，验证无内存泄漏（Chrome Memory Profiler）
- [ ] 订阅状态变化，验证回调正确触发
- [ ] 批量更新状态，验证订阅者只通知一次
- [ ] 添加多个图形（如果实施 2.2），验证可正确切换

**性能基准测试**：
```javascript
// 测试 PBS 点检测性能
console.time('PBS Detection');
for (let i = 0; i < 1000; i++) {
  viewportController.getPBSAtPoint(100, 100);
}
console.timeEnd('PBS Detection');

// 测试状态更新性能
console.time('State Update');
for (let i = 0; i < 1000; i++) {
  stateManager.updateViewport({ x: i, y: i });
}
console.timeEnd('State Update');
```

---

## 十、总结与建议

### 推荐实施路径
1. **必做**：阶段1全部（解决核心问题，收益最大）
2. **强烈推荐**：阶段2的 2.3 资源清理（防止内存泄漏）
3. **推荐**：阶段2的 2.1、2.4（提升架构质量）
4. **可选**：阶段2的 2.2 多图形管理（仅在有需求时）
5. **按需**：阶段3全部（仅在遇到性能瓶颈时）

### 不建议的做法
- ❌ 推倒重写：现有架构基础良好，重写风险高
- ❌ 引入TypeScript：增加复杂度，与项目规模不匹配
- ❌ 使用第三方状态管理库：当前 StateManager 已足够
- ❌ 过早优化：阶段3仅在遇到实际性能问题时实施

### 预期收益
- **性能提升**：30-50%（节流优化 + 批量更新）
- **代码质量**：解耦后可测试性提升，维护成本降低 20-30%
- **扩展性**：支持多图形、自定义渲染器等扩展
- **健壮性**：资源清理 + 错误处理提升稳定性

### 工作量估算
- 阶段1：1-2天（5个改进点，独立实施）
- 阶段2：2-3天（4个改进点，有依赖关系）
- 阶段3：1-2天（按需实施）
- **总计**：4-7天（取决于实施范围）

### 快速开始
如果时间有限，建议优先实施以下3个改进点（1天内完成）：
1. **1.3 PBS精准识别**（30分钟）- 立即见效，避免误触
2. **1.4 节流优化**（1小时）- 明显性能提升
3. **2.3 资源清理**（2-3小时）- 防止内存泄漏

---

## 附录：配置参考

### 推荐的 constants.js 补充

```javascript
// utils/constants.js

// 性能配置
export const PERFORMANCE_CONFIG = {
  // 节流间隔（毫秒）
  THROTTLE_INTERVAL: 16,  // 60fps

  // 空间索引网格大小
  SPATIAL_HASH_CELL_SIZE: 50,

  // 对象池初始大小
  OBJECT_POOL_INITIAL_SIZE: 20,

  // PBS数量阈值（超过此值启用空间索引）
  PBS_SPATIAL_INDEX_THRESHOLD: 100,
};

// 调试配置
export const DEBUG_CONFIG = {
  ENABLE_LOGGING: true,
  LOG_LEVEL: 'INFO',  // 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
  SHOW_FPS: false,
  SHOW_BOUNDS: false,
};

// 验证配置有效性
export function validateConfig() {
  const { MIN_SCALE, MAX_SCALE } = VIEWPORT_CONFIG;
  if (MIN_SCALE >= MAX_SCALE) {
    throw new Error('MIN_SCALE must be less than MAX_SCALE');
  }
  // ... 其他验证
}
```

---

**文档版本**: v1.0
**创建日期**: 2025-12-10
**适用项目**: pixiv8-my
**维护者**: 开发团队
