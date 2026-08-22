/**
 * FileName: scaleTransform.js
 * Author: alexppap
 * Date: 2026-08-22
 * Description: 缩放变换共享纯函数。原先 MapInteraction.js（滚轮/捏合缩放）
 *              与 CoordinateSystem.js（PBS 定位放大）各自实现了一份完全相同
 *              的 calculateScaleTransform（以某点为缩放中心并保持该点在画布
 *              上不动），现抽取为单一实现，两处以 container 入参复用。
 * Version: 1.0.0
 */

/**
 * 计算缩放中心点和位置（缩放后保持 centerPos 在画布上不动）
 * @param {Object} container 地图容器（读取实时 position/scale，
 *   外部逻辑可能直接修改容器变换，故不缓存）
 * @param {Object} centerPos 缩放中心（画布本地坐标 {x, y}）
 * @returns {Object} { tempX, tempY, getNewPosition(newScale) }
 *   tempX/tempY - 缩放中心在容器局部坐标系下的坐标
 *   getNewPosition(newScale) - 缩放至 newScale 后容器应处的位置
 */
export function calculateScaleTransform(container, centerPos) {
  const curScale = container.scale.x || 1;
  const tempX = (-container.position.x + centerPos.x) / curScale;
  const tempY = (-container.position.y + centerPos.y) / curScale;

  return {
    tempX,
    tempY,
    getNewPosition(newScale) {
      return {
        x: -(tempX * newScale - centerPos.x),
        y: -(tempY * newScale - centerPos.y),
      };
    },
  };
}

export default calculateScaleTransform;
