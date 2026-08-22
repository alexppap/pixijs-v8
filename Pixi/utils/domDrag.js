/**
 * FileName: domDrag.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 摄像头浮窗 DOM 拖拽工具。由源项目 CSS-Web MapTemplate.vue
 *              的 handleDrag/dragAble/touchstartDragAble/changePlace 移植。
 *              差异：不再通过 document.getElementById 查找元素，由调用方
 *              直接传入 el（组件 ref）；changePlace 的浮窗列表由参数注入
 *              （原闭包引用 cameraLstState.showCameraLst）。
 *              边界 clamp（0 ≤ left ≤ innerWidth-offsetWidth）逻辑保留。
 *              差异：dragAble/touchstartDragAble 返回 cleanup 函数，拖拽中
 *              组件卸载时可由调用方（onBeforeUnmount）移除 document 监听，
 *              防止泄漏（源码仅在 mouseup/touchend 时移除）。
 * Version: 1.0.0
 */

/**
 * 生成拖拽移动处理函数（含视口边界 clamp）
 * @param {object} params 参数对象
 * @param {HTMLElement} params.element 拖拽的 DOM 元素（调用方传入）
 * @param {object} params.index 浮窗状态对象（left/top 写回此对象）
 * @param {number} params.startX 拖拽起始 clientX
 * @param {number} params.startY 拖拽起始 clientY
 * @param {Function} [params.onMove] 移动回调 (left, top) => void
 * @returns {Function} 移动处理函数 (clientX, clientY) => void
 */
export function handleDrag({ element, index, startX, startY, onMove }) {
  const diffX = startX - element.offsetLeft;
  const diffY = startY - element.offsetTop;

  return (clientX, clientY) => {
    let left = clientX - diffX;
    let top = clientY - diffY;

    // 提前计算边界值，减少重复计算
    const maxLeft = window.innerWidth - element.offsetWidth;
    const maxTop = window.innerHeight - element.offsetHeight;
    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));

    index.left = left;
    index.top = top;
    onMove?.(left, top);
  };
}

/**
 * 触摸拖动事件处理
 * @param {object} params 参数对象
 * @param {HTMLElement} params.el 拖拽的 DOM 元素（调用方传入）
 * @param {object} params.index 浮窗状态对象
 * @param {Event} params.e 触摸事件
 * @param {object[]} params.showCameraLst 浮窗列表（changePlace 层级置顶用）
 * @returns {Function} cleanup 清理函数（组件卸载时调用，移除 document 监听）
 */
export function touchstartDragAble({ el, index, e, showCameraLst }) {
  if (!el) return () => {};

  changePlace(showCameraLst, index);
  e = e || window.event;

  const startX = e.touches[0].clientX;
  const startY = e.touches[0].clientY;
  const handleMove = handleDrag({ element: el, index, startX, startY });

  const touchmoveHandler = (ev) => {
    handleMove(ev.touches[0].clientX, ev.touches[0].clientY);
  };

  /** 移除 document 监听（touchend 或外部 cleanup 时调用） */
  const cleanup = () => {
    document.removeEventListener("touchmove", touchmoveHandler);
    document.removeEventListener("touchend", cleanup);
  };

  document.addEventListener("touchmove", touchmoveHandler);
  document.addEventListener("touchend", cleanup);

  return cleanup;
}

/**
 * 鼠标拖动事件处理
 * @param {object} params 参数对象
 * @param {HTMLElement} params.el 拖拽的 DOM 元素（调用方传入）
 * @param {object} params.index 浮窗状态对象
 * @param {Event} params.e 鼠标事件
 * @param {object[]} params.showCameraLst 浮窗列表（changePlace 层级置顶用）
 * @returns {Function} cleanup 清理函数（组件卸载时调用，移除 document 监听）
 */
export function dragAble({ el, index, e, showCameraLst }) {
  if (!el) return () => {};

  changePlace(showCameraLst, index);
  e = e || window.event;

  const startX = e.clientX;
  const startY = e.clientY;
  const handleMove = handleDrag({ element: el, index, startX, startY });

  const mousemoveHandler = (ev) => {
    handleMove(ev.clientX, ev.clientY);
  };

  /** 移除 document 监听（mouseup 或外部 cleanup 时调用） */
  const cleanup = () => {
    document.removeEventListener("mousemove", mousemoveHandler);
    document.removeEventListener("mouseup", cleanup);
    document.removeEventListener("mouseleave", cleanup);
  };

  document.addEventListener("mousemove", mousemoveHandler);
  document.addEventListener("mouseup", cleanup);
  document.addEventListener("mouseleave", cleanup);

  return cleanup;
}

/**
 * 调整元素层级，将拖动元素置于顶层
 * @param {object[]} showCameraLst 浮窗列表
 * @param {object} index 拖拽的浮窗状态对象（含 id/zIndex）
 */
export function changePlace(showCameraLst, index) {
  const dragItem = showCameraLst?.find((it) => it.id === index.id);
  if (!dragItem || showCameraLst.length <= 1) return;

  const maxZIndex = Math.max(...showCameraLst.map((item) => item.zIndex));
  if (dragItem.zIndex === maxZIndex) return;

  // 调整其他元素层级
  showCameraLst.forEach((item) => {
    if (item.zIndex > dragItem.zIndex) item.zIndex--;
  });

  // 将当前元素置于顶层
  dragItem.zIndex = maxZIndex;
}
