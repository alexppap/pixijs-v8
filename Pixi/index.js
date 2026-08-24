/**
 * FileName: index.js（Pixi 组件库）
 * Author: alexppap
 * Date: 2026-08-22
 * Description: Pixi 地图组件库统一导出入口（barrel）。调用方统一从
 *              "@/components/Pixi" 导入，不再感知内部目录结构；未来抽离
 *              为独立包/monorepo 时仅需调整本文件，调用方零改动。
 *              测试文件（__tests__/）仍走模块深路径导入，保持测试隔离。
 * Version: 1.0.0
 */

// ------------------------------
// core — 应用生命周期与基础能力
// ------------------------------
export { default as PixiMap } from "./core/PixiMap";
export { createMapInteraction } from "./core/MapInteraction";
export { createCoordinateSystem } from "./core/CoordinateSystem";
export { createWebGLGuard } from "./core/WebGLGuard";
export {
  getOrCreateRenderTexture,
  releaseRenderTextures,
} from "./core/RenderTextureCache";
export {
  loadAllTextures,
  initPositionSpritesheet,
  getTexture,
  getPositionFrames,
  resetTextureCache,
} from "./core/TextureLoader";

// ------------------------------
// api — 数据接口层
// ------------------------------
export { default as mapApi } from "./api/mapApi";

// ------------------------------
// layers — 绘制层
// ------------------------------
export { drawLayer, clearMapLayers, recolor } from "./layers/layer";
export { drawFieldTexts, drawFieldText } from "./layers/text";
export { drawBlockAndCombLines } from "./layers/block";
export { drawCamera, deleteCameraLst } from "./layers/camera";

// layers/sprites — 精灵层
export { drawPBSs, resetGridTextureCache } from "./layers/sprites/pbs";
export {
  drawMaterials,
  resetMaterialTextureCache,
} from "./layers/sprites/material";
export {
  drawShipSprites,
  resetShipTextureCache,
} from "./layers/sprites/ship";
export { drawCarSprites } from "./layers/sprites/car";
export {
  drawRouterSprites,
  fitPathToView,
  generateArrowPathLst,
} from "./layers/sprites/router";
export {
  ANIMATION_SPEED,
  startArrowAnimation,
  stopAnimation,
  clearSprites,
} from "./layers/sprites/animation";

// ------------------------------
// state — 绘制状态与元素池
// ------------------------------
export {
  createAllStates,
  createDialogState,
  createSpriteState,
  createCameraLstState,
  createTextState,
  createBlockCombState,
  createMapLayerState,
} from "./state";

// ------------------------------
// behaviors — 交互行为
// ------------------------------
export { createClickHandlers } from "./behaviors/clickHandlers";
export {
  createDialogPosition,
  CLICK_CONFIG,
} from "./behaviors/dialogPosition";

// ------------------------------
// utils — 纯工具函数
// ------------------------------
export { calculateScaleTransform } from "./utils/scaleTransform";
export { debounce } from "./utils/debounce";
export { isEqual } from "./utils/isEqual";
export {
  handleDrag,
  touchstartDragAble,
  dragAble,
  changePlace,
} from "./utils/domDrag";
export * from "./utils/mapUtils";

// ------------------------------
// components — Vue 子组件
// ------------------------------
export { default as MapDialog } from "./components/MapDialog.vue";
export { default as CameraPanel } from "./components/CameraPanel.vue";
export { default as ResetMapButton } from "./components/ResetMapButton.vue";
