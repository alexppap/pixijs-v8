/**
 * FileName: index.js（state）
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 绘制状态一次性装配入口。对应源项目 CSS-Web MapTemplate.vue
 *              中五个 createXxxState 实例的创建（432–436 行）+ DialogData。
 *              createAllStates(emit) 将 dialogState.closeDialog 内的
 *              emit("changeShowTransitRecords") 改为经 emit 派生的回调注入。
 * Version: 1.0.0
 */
import { createDialogState } from "./dialogState";
import { createSpriteState } from "./spriteState";
import { createCameraLstState } from "./cameraState";
import { createTextState } from "./textState";
import { createBlockCombState } from "./blockCombState";
import { createMapLayerState } from "./mapLayerState";

export {
  createDialogState,
  createSpriteState,
  createCameraLstState,
  createTextState,
  createBlockCombState,
  createMapLayerState,
};

/**
 * 一次性装配全部绘制状态（实例间隔离）
 * @param {Function} [emit] 组件 emit 函数（可空；用于派生弹窗关闭回调）
 * @param {object} [options] 附加注入
 * @param {Function} [options.onRender] 关闭弹窗后触发渲染（pixiMap.render）
 * @param {Function} [options.disposeCamera] video.js 播放器销毁回调（预留）
 * @returns {object} { dialogState, spriteState, cameraLstState, textState,
 *                     blockCombState, mapLayerState, destroy }
 */
export function createAllStates(emit, options = {}) {
  const { onRender, disposeCamera } = options;

  const dialogState = createDialogState({
    onChangeShowTransitRecords: emit
      ? () => emit("changeShowTransitRecords")
      : undefined,
    onRender,
  });
  const spriteState = createSpriteState();
  const cameraLstState = createCameraLstState();
  const textState = createTextState();
  const blockCombState = createBlockCombState();
  const mapLayerState = createMapLayerState();

  return {
    dialogState,
    spriteState,
    cameraLstState,
    textState,
    blockCombState,
    mapLayerState,

    /**
     * 逐层销毁全部状态（对齐源 onBeforeUnmount 清理链 3–4 步）
     */
    destroy() {
      mapLayerState.destroy();
      blockCombState.destroy();
      spriteState.destroy();
      textState.destroy();
      cameraLstState.destroy({ disposeCamera });
      dialogState.destroy();
    },
  };
}
