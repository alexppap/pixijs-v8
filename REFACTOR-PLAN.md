# PixiJS v8 地图组件库 —— 架构评估与改造计划

> 评估对象：`Pixi/`（58 文件 / 约 8000 行，含 14 个测试文件）
> 建立日期：2026-08-24
> 行号基准：**P0 修复后**的代码状态。后续代码演进后请按符号名重新定位，勿盲信行号。

---

## 一、现状判断

该目录是从 PixiJS v6 项目（CSS-Web `MapTemplate.vue`）逐块移植到 v8 的地图组件库。

### 做得好的部分（应保留的既有资产）

- **v6 → v8 API 迁移到位**：`beginFill/lineStyle/drawPolygon/endFill` → `poly/fill/stroke`；`interactive/buttonMode` → `eventMode/cursor`；`PIXI.Loader` → `Assets`；`new PIXI.Texture(base, frame)` → `new Texture({ source, frame })`。
- **`core/TextureLoader.js`**：Promise 幂等缓存写得干净，重复调用不产生重复请求。
- **`utils/scaleTransform.js`**：把 `MapInteraction` 与 `CoordinateSystem` 中两份相同实现抽为单一纯函数，是正确的抽取方向。
- **识别并注明源码死代码**（如 `pbs.js` 中被注释的实例复用分支、`camera.js` 的 `getCameraPositionTop` 死分支）并选择不移植，体现了判断力而非机械搬运。

### 核心问题：这是一座「缺顶的塔」

`index.js` 导出 40+ 符号，`core/` `layers/` `state/` `behaviors/` 分层清晰，但**装配层不存在** —— 原 `MapTemplate.vue` 没有被移植。后果：

- 每个 `drawXxx()` 直接接收 Vue 的 `props` 对象（`layer.js` `drawLayer`、`pbs.js` `drawPBSs`、`ship.js` `drawShipSprites`…）
- `createCoordinateSystem` 的 `ctx` 需 7 个必需 ref + 8 个可选 getter
- `createClickHandlers` 的 `ctx` 需 15 个字段

即：**「上帝组件」没有被拆掉，只是被拆成碎片，然后要求调用方重新把它拼回来。** 目录结构像组件库，契约却仍是单个 Vue 组件的内部实现细节。这是根本问题，P1 的多数条目都由它衍生。

### 工程配套缺失

- 根目录无 `package.json`，14 个测试文件在本仓库内**无法运行**
- 测试用别名 `@/components/Pixi`，指向的宿主工程不在此仓库
- 无类型定义（`.d.ts` 或导出的 JSDoc `@typedef`），15 字段的 `ctx` 全靠读注释拼装

---

## 二、已完成：P0 止血（2026-08-24）

以下 6 项已修改并通过静态引用检查。

### P0-1 `reactive([])` 包裹 PIXI 显示对象

**问题**：`state/*.js` 全部用 `reactive([])` 存 PIXI 对象。Vue 3 的 `reactive` 是惰性深层代理，`MapLayer[0]` 返回 Proxy 而非 `Graphics` 本体。于是 `item.destroy()` 时 PIXI 内部 `parent.children.indexOf(proxy)` 返回 **-1** → **对象被销毁却仍留在 `container.children` 中**，下一帧渲染即访问已销毁对象。

**修复**：5 个 state 工厂的 PIXI 对象池改普通数组，并以**只读 getter** 暴露（杜绝引用替换，见 P0-2）。`cameraState.showCameraLst` 保留 `reactive` —— 它是纯数据且被 `CameraPanel.vue` 直接渲染，需要响应式。`dialogState.DialogData` 同理保留。

**旁证**：测试文件中大量 `toRaw(state.MapLayer[0])` 调用正是此问题的症状 —— 作者当初必须解包才能让 `container.children` 断言通过。去 reactive 后 `toRaw(普通对象)` 恒等返回，这些断言依然通过。

涉及：`state/{spriteState,mapLayerState,textState,blockCombState,cameraState}.js`

### P0-2 `state.X = []` 断开 destroy 闭包引用

**问题**：`pbs.js` 与 `material.js` 用 `spriteState.PBSs = []` 清空。state 工厂返回 `{ ...state, destroy }`，赋值后返回对象的 `PBSs` 指向新数组，而 `destroy()` 内 `Object.values(state)` 拿到的仍是闭包中的**旧**数组 → **组件卸载时遍历空数组，新数组里所有图形永不销毁**。

**修复**：改 `.length = 0`（`camera.js` 原本已是此写法，同库两种风格并存）。配合 P0-1 的只读 getter，此写法今后会直接抛 `TypeError` 而非静默泄漏。

### P0-3 `RenderTexture` 缓存跨 `app` 生命周期悬空

**问题**：`pbs.js` 的 `gridTextureCache` 是模块级 `Map`，存 `RenderTexture`（绑定在特定 renderer 上的 GPU 资源）。`app.destroy()` 后纹理失效但缓存仍在；SPA 路由切走再回来（新建 app）会命中死纹理 → PBS 填充异常。原 `resetGridTextureCache()` 注释写"仅供测试使用"，实际是 `destroy()` 必须调用的。

**修复**：抽出 `core/RenderTextureCache.js`，以 `WeakMap<renderer, Map>` 分桶；接入 `PixiMap.destroy()`，且**必须早于 `app.destroy()`**（之后 renderer 已失效，取不到桶）。纹理生成失败时降级为纯色填充，避免 `fill(undefined)`。

**为何抽到 `core/`**：若 `core/PixiMap` 直接 import `layers/sprites/pbs` 会造成反向依赖。RenderTexture 缓存本质是 renderer 资源管理，归 `core/` 后依赖方向回到正确的 `layers → core`。

### P0-4 裸 `Origin?.X` 产生 NaN 坐标

**问题**：`picCenter[0] - mapInfo.Origin?.X` 在 `Origin` 缺失时得 `NaN`。**PIXI 对 NaN 坐标既不报错也不渲染，元素静默消失**，是最难排查的一类缺陷。同库中 `mapUtils.js` 已做 `|| 0` 防护，`pbs.js`/`text.js`/`ship.js`/`car.js` 却是裸写 —— 防护标准不一致。

**修复**：新增 `mapUtils.lngLatToMapPixel()` 统一防护，并合并 `router.js`/`ship.js`/`car.js` 三份完全相同的 `convertLngLatToMapPixel` 实现。

**注意**：`router.js` 原将 offset 加在 Origin 外侧 `-(y+Origin)+offset`，ship/car 加在内侧 `-(y+Origin+offset)`。统一为内侧；因 `routerOffsetY` 恒为 0/未配置，输出不变。

### P0-5 抛错与泄漏点

| 位置 | 问题 | 修复 |
|---|---|---|
| `text.js` `adjustDialogVerticalPosition` | `items[0]?.DialogData.length \|\| Object.keys(items[0]?.DialogData).length` —— 两个分支在 `DialogData` 缺失时都抛错（`?.` 断链后仍访问 `.length`；`Object.keys(undefined)` 亦抛） | 显式取值 + 类型判断 + 兜底 0 |
| `layer.js` `recolor` | `getHighContrastRGBA` 对非法颜色 `throw`（测试明确断言此行为），无 try/catch → 单个坏颜色中断整轮重绘，底图停留在半新半旧状态 | 逐项 try/catch 隔离 |
| `ship.js` `createAndAddShipPositionMarkers` | `addSpriteHoverEffect()` 返回的 destroy 句柄被丢弃 → `mouseover/mouseout` 监听与运行中的 rAF 循环随容器销毁而悬空 | 句柄挂 `__hoverEffect`，由 `clearSprites` 与 `spriteState.destroy` 在销毁前调用 |

### P0-6 hover 命中检测无节流

**问题**：`clickHandlers.js` 的 `mousemove` 每次触发 `clickThroughTest(MapLayer, point)` —— 对**全部**多边形做 `containsPoint`。底图上千个多边形 × 每秒上百次 mousemove。库内已有 `utils/debounce.js` 但未用于此处。

**修复**：在 `bindMouseMoveEvent` 的监听器内用 rAF 合并，每帧最多检测一次，只保留最新坐标。`handleFieldMouseMove` 本身**保持同步**（现有测试直接调用它并同步断言）。`destroy` 中取消挂起的 rAF。

### ⚠ P0 的验证状态（未完成）

**上述修复仅通过 Grep 静态引用检查**（import/调用全部闭合，无未定义引用、无未用 import），**未经运行验证**：

- 语法检查与测试执行均未能进行 —— 工具在该时段持续报 `claude-opus-5 temporarily unavailable`
- 根目录无 `package.json`，测试在本仓库内本就无法运行

**下一步必做**：在宿主工程内执行 `vitest`，重点核对
`state.test.js`、`layer.test.js`、`text.test.js`、`clickHandlers.test.js`。

### 附：P0 过程中的三处自我修正（留档以免重犯）

1. 曾将 `resolveRenderer` 形参命名为 `Map` —— 会 shadow 全局 `Map` 构造器，使内部 `new Map()` 崩溃。已改名 `pixiMap` 并留注释。
2. 曾让 `core/PixiMap` 直接 import `layers/sprites/pbs` —— 反向依赖。已改为抽 `core/RenderTextureCache`。
3. 曾将 `lngLatToMapPixel` 内部写成 `lngLatToMercator(lng, lat)`，而三份原实现均为 `(lat, lng)` —— 会让全部坐标 x/y 互换。已修正，并注释说明这个"形参名与实参顺序倒置"的既有约定，防止后人"顺手修正"。

### 附：一条已撤回的结论

初评曾判定 `lngLatToMercator` 的参数反转是"接入 proj4 即全线错乱的定时炸弹"。**追查全部调用链后撤回**：所有调用点一致遵循同一套（反直觉但自洽的）字段约定 —— 数据中 `CenterY`/点位 `Y` 装经度、`CenterX`/`X` 装纬度，净行为正确。

这是**命名混乱，不是待爆的 bug**。已降级至 P2，仅补警示注释。

---

## 三、已完成：P1 阶段（2026-08-25）

范围：**P1-1 ~ P1-7**。P1-8（装配层 `MapScene`）按计划延后 —— 它改对外契约，需前面各项把内部行为理顺后再动。

### P1-1 渲染模式统一为常驻渲染（方案 A）

`autoStart: true` 保留，**删除全库 17 处 `Map.render?.()`**，两套渲染机制叠加的问题消除。

- 动画从 `requestAnimationFrame` 迁到 `app.ticker.add`：`animation.js` 箭头动画、`ship.js` hover 跳动。原本 rAF 里手动 `render()` + ticker 自身渲染 = 每帧两次，现在只剩 ticker 一次。
- 删除 `WebGLGuard` 的 keepAlive 定时渲染（连同 `KEEP_ALIVE_INTERVAL` 常量与 `clearInterval` 清理）。
- 删除 `dialogState` 的 `onRender` 注入点与 `createAllStates(emit, { onRender })` 参数 —— 这是 render 的间接注入通道，留着等于留了个双渲染后门。
- `PixiMap.render()` **保留**但注释改正（原注释说"应用以 autoStart: false 创建"，与实际配置矛盾）。它现在只服务 `exportAsPNG` 这类"需要此刻落帧"的同步场景，业务代码不该调用。

删除 `render()` 后有 5 个函数的 `Map` 形参变成完全未使用，一并从签名和 JSDoc 中移除（调用方多传无害）：
`drawCamera`、`drawFieldTexts`、`drawFieldText`、`drawCarSprites`、`drawMaterials`、`fitPathToView`。
`drawPBSs` / `drawShipSprites` / `drawRouterSprites` 的 `Map` **保留** —— 分别用于网格纹理生成、hover ticker、动画 ticker。

### P1-2 `resolution` 跟随 DPR

`Math.min(window.devicePixelRatio || 1, 2)`。

### P1-3 `animationController` 工厂化

模块级单例 → `createAnimationController()`。控制器内部改为持有 `tickFn` + `boundTicker`，`stopAnimation` 从**同一个** ticker 摘除回调。

实例隔离的落点选在 `router.js`：以 `WeakMap<pixiMap, controller>` 分桶，惰性创建。

**为何不放进 `spriteState`**：那会造成 `state/` → `layers/` 的反向依赖，与 P0-3 里 `core` 不得 import `layers` 是同一类错误。放在 router.js 内既隔离了实例，又不动对外签名。

副带修正：`drawRouterSprites` 开头先 `stopAnimation()` 再 `clearSprites` —— 否则 ticker 回调会操作已销毁的车辆精灵。

**API 变更**：`index.js` 不再导出 `startArrowAnimation` / `stopAnimation`，改为导出 `createAnimationController` 与 `stopRouterAnimation(pixiMap)`（供宿主停某张图的路线动画）。

### P1-4 统一 Pointer Events

mouse 一套 + touch 一套 → `pointerdown/move/up/cancel` 一套。捏合改为按「活跃指针表」（`Map<pointerId, {x,y}>`）计算，不再依赖 `event.touches`。

两个具体缺陷同时修掉：

- `button !== 0` 直接 return —— 右键/中键不再拖动地图
- `setPointerCapture` 承接后续事件 —— 拖出画布不再中断（原实现把 move/up 绑在 canvas 上）

配套：`canvas.style.touchAction = "none"`（替代原 `touchmove` 里的 `preventDefault`，Pointer Events 下后者对 pointermove 无效），`destroy` 中还原。

新增能力：捏合中抬起一根手指时，剩下那根接续拖拽（原实现会让地图卡住）。

**行为收敛（有意为之）**：源码 mouse 路径在 `mousedown` 触发 `onInteractionStart`，touch 路径却延到 `touchmove`。统一后触摸单指拖拽也在按下时触发，弹窗关得更早。捏合仍在 move 时持续触发。

顺带暴露只读 `interaction.interactionState`（`isDragging`/`isPinching`），`ship.js` hover 效果需要它，此前要求调用方自己再维护一份同名状态。

### P1-5 数据层副作用

- 删除 `drawHullLayer` 的 `JSON.parse(JSON.stringify(props.mapLayerInfos))`。依据：该函数只读 `element` 字段、从不回写，且同库 `drawClickableLayer` / `drawMergedLayer` 本来就直接遍历原数据 —— 移除后三分支行为一致。
- 两处 `mapInfo.LayerInfos.sort(...)` → `[...mapInfo.LayerInfos].sort(...)`，不再原地打乱调用方数据。

### P1-6 重复实现与命名冲突

| 项 | 处理 |
|---|---|
| 两个同名 `processPolygonVertices` | **不合并**（语义不同：一个输出世界坐标+收集边界，一个输出局部坐标）。`layer.js` 的局部函数改名 `collectPolygonVertices`，两边互加交叉注释 |
| 两个 `calculateDialogPosition` | **不合并**（一个读 `event.nativeEvent` + 设计稿固定边界，一个读 clickPoint + 实测 DOM）。`text.js` 的改名 `calculateFieldDialogPosition` |
| `mapUtils.js` 顶点去重用 `JSON.stringify` | 改为直接比 X/Y。原写法每点两次序列化，且对属性顺序/无关字段敏感（同坐标可能被判为不同点） |
| `block.js` 文本长度用 `JSON.stringify(text)` | 改为直接用 `text`（原写法多算两个引号致字号偏小）。同时补 `textLength === 0` 兜底 —— 原写法 `8 / 0` 得 `Infinity` |

### P1-7 `recolor` 按 FieldID 匹配

**关键约束**：现有测试传的 `colorList` 项只有 `fillColor`、不带 `FieldID`，`colorList` 形状由宿主决定。若无条件改成按 FieldID 匹配，宿主不带该字段时会全部匹配不上 → 重绘静默失效。

故实现为：`colorList` 各项带 `FieldID`（兼容 `fieldID`/`fieldId`）时按 FieldID 精确匹配，否则回退数组下标（源码行为）。

配套：`drawHullLayer` 给文本元素回填 `FieldID`。文本与图形本来就无法靠下标对应 —— 只有 `name` 非空的元素才入 `fieldTextLst`，与 `MapLayer` 天然错位。

新增测试：`colorList` 带 FieldID 时顺序无关地正确匹配（首项故意放匹配不上的 ID，确认不是靠下标 0 命中）。

### 同步修改的测试

删除 render 后有 5 处断言必然失败，已同步：

| 文件 | 处理 |
|---|---|
| `camera.test.js` | 移除 `buildDeps` 的 `Map` 与各调用点 `Map: deps.Map`；`toHaveBeenCalled` 断言删除；`not.toHaveBeenCalled` 改为断言"容器无子元素"（原意是验证提前返回） |
| `clickHandlers.test.js` | mock PixiMap 去掉 `render` spy，2 处断言删除 |
| `text.test.js` | 去掉 `Map` 传参与断言 |
| `state.test.js` | 去掉 `onRender` mock 与断言 |
| `layer.test.js` | **新增** FieldID 匹配用例 |

### ⚠ P1 的验证状态（未完成，与 P0 相同）

**本轮同样只做了静态引用检查**（Grep 核对：删除/重命名的符号无残留引用、import 全部闭合、无未定义引用）：

- `node --check` 语法检查与 `vitest` 均未能执行 —— 工具在该时段反复报 `claude-opus-5 temporarily unavailable`
- 根目录仍无 `package.json`，测试在本仓库内本就跑不起来

**下一步必做**：
1. 在宿主工程执行 `vitest`，重点核对 `camera.test.js`、`clickHandlers.test.js`、`text.test.js`、`state.test.js`、`layer.test.js`（这 5 个本轮被改过）
2. **手测交互**（P1-4 改动无自动化覆盖）：拖拽（含拖出画布）、右键不拖动、滚轮缩放、双指捏合、捏合中抬一指、PBS 点击弹窗、hover 场地弹窗、重置视角
3. DevTools Performance 面板确认每帧只渲染一次（P1-1 的客观验收指标）
4. 宿主若调用过 `startArrowAnimation` / `stopAnimation` / `createAllStates(emit, { onRender })`，需按上述 API 变更改写

---

## 四、待做：P1-8 补上装配层 【最有价值的一步】

新建 `core/MapScene.js`，把散落在调用方的 15 字段 `ctx` 拼装收归库内，对外只暴露：

```js
const scene = createMapScene({ containerId, mapData, options });
scene.setPBSs(list);
scene.highlight(ids);
scene.on('pbsClick', fn);
scene.destroy();
```

同时把所有 `drawXxx(props)` 的 `props` 换成显式数据契约（`drawPBSs({ pbsList, highlightIds, clickable })`），切断对 Vue props 形状的依赖。

**这一步做完，该库才真正与那个 Vue 组件解耦，才是「组件库」而非「某组件的碎片」。**

P1-1~P1-7 已为它铺路：`Map` 形参收窄、动画控制器可注入、`interactionState` 可直接取用，装配层不必再替调用方拼这些。

---

## 四、待做：P2（可维护性）

- **注释体积失控**：每个文件头都是"由源项目 XXX 第 N–M 行移植，差异①②③"。迁移期有价值，但作为长期维护的库是噪音，且会随代码演进变成谎言。建议整体挪入 `MIGRATION.md`，代码内只留"为什么这么写"（如 `pbs.js` 解释缓存动机那段应保留）。
- **`lngLatToMercator` 命名混乱**（P0 降级项）：字段约定反直觉（Y 装经度）、形参名与实参顺序倒置。当前已加警示注释；彻底治理需连同数据层字段一起改名，独立排期。
- 生产路径 `console.log`：`camera.js:269`、`camera.js:279`。
- 魔法延时：`clickHandlers.js` `onHullFieldClick` 内 `setTimeout(..., 100)` —— 用延时等时机很脆弱。
- `WebGLGuard`：用 `location.reload()` 处理上下文恢复过于粗暴；`setInterval` 写在函数体顶层而非返回前，构造期即产生副作用。
- `PixiMap.destroy()`：先销毁 `mapContainer` 再 `app.destroy(true, ...)`，后者已会销毁 stage children（v8 幂等，无害但冗余）。
- `/* global proj4 */` 依赖全局变量，应改为显式注入投影函数。
- 补 `package.json` + 类型定义，让测试可运行、`ctx` 契约可被 IDE 检查。

---

## 五、执行顺序

| 阶段 | 内容 | 预估 | 状态 / 风险 |
|---|---|---|---|
| ~~0~~ | ~~P0 止血~~ | ~~已完成~~ | **待运行验证** |
| 1 | 在宿主工程跑 `vitest` 验证 P0 + P1 | 0.5h | **未做**（本仓库无 package.json） |
| ~~2~~ | ~~P1-1 渲染模式定调 + P1-2 DPR~~ | ~~1d~~ | ~~已完成~~ · **待运行验证** |
| ~~3~~ | ~~P1-3 动画控制器实例化 + P1-4 Pointer Events 统一~~ | ~~1d~~ | ~~已完成~~ · **待手测交互** |
| ~~4~~ | ~~P1-5 数据副作用 + P1-6 重复实现 + P1-7 索引契约~~ | ~~1d~~ | ~~已完成~~ · **待运行验证** |
| 5 | **P1-8 装配层 `MapScene`** | 2–3d | 高（改对外契约，但收益最大） |
| 6 | P2 清理 + `package.json` + 类型定义 | 1d | 低 |

**下一步建议**：阶段 1（补 `package.json` 并跑测试）优先级已升至最高 —— P0 与 P1 两轮改动都只过了静态检查，累积的未验证改动量已经不小，继续往前做（尤其 P1-8 那种高风险改动）之前应先把验证补上。

---

## 六、验证方式

每个阶段完成后至少满足：

1. `vitest` 全绿（14 个测试文件）
2. 阶段 2/3 需**实际驱动应用**手测：拖拽（含拖出画布）、右键不拖动、滚轮缩放、双指捏合、捏合中抬起一指、PBS 点击弹窗、hover 场地弹窗、重置视角
3. 阶段 2 需用 DevTools Performance 面板确认每帧只渲染一次
4. 阶段 5 完成后，调用方代码行数应显著下降 —— 这是装配层是否真正生效的客观指标
