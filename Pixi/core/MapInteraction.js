/**
 * FileName: MapInteraction.js
 * Author: alexppap
 * Date: 2026-08-20
 * Description: PixiJS v8 地图交互封装（拖拽 / 滚轮缩放 / 触摸捏合）。
 *              由源项目 CSS-Web MapTemplate.vue (PixiJS v6) 的
 *              bindInteractionEvents / calculateScaleTransform 逻辑移植而来，
 *              v6 → v8 差异：canvas 取 app.canvas、鼠标全局坐标改为
 *              clientX/Y 减画布 getBoundingClientRect、按需渲染
 *              (ticker start/stop + isWheel) 在 autoStart 下省略。
 *              2026-08-21 扩展（对齐源码交互回调语义）：
 *              ① isHull 船体模式滚轮步长（hullZoomDelta 0.3 / 普通 0.1）；
 *              ② onInteractionStart 回调（源码 mousedown/wheel/touchmove 处
 *                 调用 closeDialogsAndCleanup 的对应注入点）；
 *              ③ 触摸拖拽与鼠标一致：超过阈值才触发 onDrag。
 * Version: 1.3.0
 */
import { calculateScaleTransform } from "../utils/scaleTransform";

// ------------------------------
// 默认交互配置
// ------------------------------
/**
 * 地图交互默认配置常量
 */
const DEFAULT_OPTIONS = {
  minScale: 0.1, // 最小缩放比例
  maxScale: 15.0, // 最大缩放比例
  zoomDelta: 0.1, // 普通模式滚轮缩放步长
  hullZoomDelta: 0.3, // 船体(isHull)模式滚轮缩放步长
  isHull: null, // 船体模式判断函数 () => boolean（如 () => props.isHull）
  dragThreshold: 5, // 拖拽触发阈值(像素)
  onInteractionStart: null, // 交互开始/进行回调（mousedown/wheel/touchmove，对应源码关闭弹窗时机）
  onScaleChange: null, // 缩放变化回调 (newScale, newPosition) => void
  onDrag: null, // 拖拽回调 (x, y) => void（超过阈值才触发）
};

/**
 * 创建地图交互实例（绑定事件到 PixiMap 封装的应用上）
 * @param {Object} pixiMap - PixiMap 实例（须已完成 init）
 * @param {Object} [options] - 交互配置，见 DEFAULT_OPTIONS
 * @returns {Object|null} 交互实例 { scale, destroy }，绑定失败返回 null
 */
export function createMapInteraction(pixiMap, options = {}) {
  if (!pixiMap?.app || !pixiMap.mapContainer || !pixiMap.view) {
    console.error("createMapInteraction: PixiMap 未完成初始化");
    return null;
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  const canvas = pixiMap.view;
  const container = pixiMap.mapContainer; // 拖拽/缩放作用于地图场景容器

  // 交互状态（对齐 v6 interactionState 结构）
  const state = {
    isDragging: false, // 是否处于拖拽中
    dragStart: { x: 0, y: 0 }, // 拖拽起点（clientX/Y）
    containerStart: { x: 0, y: 0 }, // 拖拽开始时容器位置
    isPinching: false, // 是否处于双指捏合中
    initialDistance: 0, // 捏合起始两指距离
  };

  /**
   * 读取容器实时缩放比例（底图绘制等外部逻辑可能直接修改 mapContainer
   * 的 scale/angle/position，如 resetCoordinateSystem，故每次从容器读取）
   * @returns {Number} 容器当前 scale.x
   */
  const currentScale = () => container.scale.x || 1;

  // ------------------------------
  // 工具函数
  // ------------------------------
  /**
   * 获取事件相对画布的本地坐标（逻辑像素，与 app.screen 一致）
   * @param {Number} clientX - 鼠标/触摸 clientX
   * @param {Number} clientY - 鼠标/触摸 clientY
   * @returns {Object} { x, y }
   */
  const getLocalPoint = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  /**
   * 应用缩放：以 centerPos 为中心缩放并调整容器位置
   * （calculateScaleTransform 由 utils/scaleTransform 共享提供）
   * @param {Number} newScale - 新的缩放比例（已限制在范围内）
   * @param {Object} centerPos - 缩放中心（画布本地坐标）
   */
  const applyScale = (newScale, centerPos) => {
    // 注意：calculateScaleTransform 需用旧 scale 反解世界坐标，须在其之后更新容器 scale
    const scaleTransform = calculateScaleTransform(container, centerPos);

    container.scale.set(newScale);
    const newPosition = scaleTransform.getNewPosition(newScale);
    container.position.set(newPosition.x, newPosition.y);

    config.onScaleChange?.(newScale, newPosition);
  };

  // ------------------------------
  // 鼠标事件处理
  // ------------------------------
  /**
   * 鼠标按下处理
   * @param {MouseEvent} event - 鼠标事件
   */
  const handleMouseDown = (event) => {
    state.isDragging = true;
    state.dragStart = { x: event.clientX, y: event.clientY };
    state.containerStart = { x: container.x, y: container.y };
    // 对齐源码：mousedown 时触发交互开始回调（关闭弹窗等）
    config.onInteractionStart?.();
  };

  /**
   * 鼠标移动处理（拖拽平移）
   * @param {MouseEvent} event - 鼠标事件
   */
  const handleMouseMove = (event) => {
    if (!state.isDragging) return;

    const deltaX = event.clientX - state.dragStart.x;
    const deltaY = event.clientY - state.dragStart.y;

    // 超过拖拽阈值才视为有效拖拽
    const beyondThreshold =
      Math.abs(deltaX) > config.dragThreshold ||
      Math.abs(deltaY) > config.dragThreshold;

    // 更新容器位置
    const newX = state.containerStart.x + deltaX;
    const newY = state.containerStart.y + deltaY;
    container.position.set(newX, newY);

    if (beyondThreshold) {
      config.onDrag?.(newX, newY);
    }
  };

  /**
   * 结束拖拽状态
   */
  const endDrag = () => {
    state.isDragging = false;
  };

  /**
   * 滚轮缩放处理（以鼠标位置为缩放中心）
   * @param {WheelEvent} event - 滚轮事件
   */
  const handleWheel = (event) => {
    event.preventDefault();

    // 对齐源码：滚轮触发时回调（关闭弹窗等）
    config.onInteractionStart?.();

    // 计算缩放增量（deltaY > 0 缩小，< 0 放大；船体模式用大步长）
    const zoomDelta = config.isHull?.()
      ? config.hullZoomDelta
      : config.zoomDelta;
    const delta = event.deltaY > 0 ? -zoomDelta : zoomDelta;

    // 更新缩放并限制范围
    const curScale = currentScale();
    const newScale = Math.max(
      config.minScale,
      Math.min(config.maxScale, curScale + delta)
    );
    if (newScale === curScale) return;

    applyScale(newScale, getLocalPoint(event.clientX, event.clientY));
  };

  // ------------------------------
  // 触摸事件处理
  // ------------------------------
  /**
   * 触摸开始处理
   * @param {TouchEvent} event - 触摸事件
   */
  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      state.isDragging = true;
      state.dragStart = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
      state.containerStart = { x: container.x, y: container.y };
    } else if (event.touches.length === 2) {
      state.isPinching = true;
      state.isDragging = false;
      const [t1, t2] = event.touches;
      state.initialDistance = Math.hypot(
        t1.clientX - t2.clientX,
        t1.clientY - t2.clientY
      );
    }
  };

  /**
   * 触摸移动处理（单指拖拽 / 双指捏合缩放）
   * @param {TouchEvent} event - 触摸事件
   */
  const handleTouchMove = (event) => {
    event.preventDefault();

    // 触摸移动（拖拽/捏合）时回调（关闭弹窗等）
    if (state.isDragging || state.isPinching) {
      config.onInteractionStart?.();
    }

    // 单指拖动
    if (state.isDragging && event.touches.length === 1) {
      const deltaX = event.touches[0].clientX - state.dragStart.x;
      const deltaY = event.touches[0].clientY - state.dragStart.y;

      // 更新容器位置
      const newX = state.containerStart.x + deltaX;
      const newY = state.containerStart.y + deltaY;
      container.position.set(newX, newY);

      // 超过拖拽阈值才触发回调
      const beyondThreshold =
        Math.abs(deltaX) > config.dragThreshold ||
        Math.abs(deltaY) > config.dragThreshold;
      if (beyondThreshold) {
        config.onDrag?.(newX, newY);
      }
    }

    // 双指缩放
    if (state.isPinching && event.touches.length === 2) {
      handlePinchZoom(event);
    }
  };

  /**
   * 触摸结束处理
   */
  const handleTouchEnd = () => {
    state.isDragging = false;
    state.isPinching = false;
    state.initialDistance = 0;
  };

  /**
   * 双指捏合缩放处理
   * @param {TouchEvent} event - 触摸事件
   */
  const handlePinchZoom = (event) => {
    const [t1, t2] = event.touches;
    const currentDistance = Math.hypot(
      t1.clientX - t2.clientX,
      t1.clientY - t2.clientY
    );

    if (state.initialDistance > 0) {
      // 计算中心点
      const centerPos = getLocalPoint(
        (t1.clientX + t2.clientX) / 2,
        (t1.clientY + t2.clientY) / 2
      );

      // 更新缩放并限制范围（比例式缩放）
      const newScale = Math.max(
        config.minScale,
        Math.min(
          config.maxScale,
          currentScale() * (currentDistance / state.initialDistance)
        )
      );

      if (newScale !== currentScale()) {
        applyScale(newScale, centerPos);
      }
    }

    state.initialDistance = currentDistance;
  };

  // ------------------------------
  // 事件绑定与解绑
  // ------------------------------
  const listeners = [
    ["mousedown", handleMouseDown],
    ["mousemove", handleMouseMove],
    ["mouseup", endDrag],
    ["mouseleave", endDrag],
    ["wheel", handleWheel, { passive: false }],
    ["touchstart", handleTouchStart, { passive: false }],
    ["touchmove", handleTouchMove, { passive: false }],
    ["touchend", handleTouchEnd, { passive: false }],
    ["touchcancel", handleTouchEnd, { passive: false }],
  ];

  listeners.forEach(([type, handler, opts]) => {
    canvas.addEventListener(type, handler, opts);
  });

  return {
    /**
     * 当前缩放比例（容器实时值）
     */
    get scale() {
      return currentScale();
    },
    /**
     * 移除所有交互事件监听，释放资源
     */
    destroy() {
      listeners.forEach(([type, handler, opts]) => {
        canvas.removeEventListener(type, handler, opts);
      });
      state.isDragging = false;
      state.isPinching = false;
      state.initialDistance = 0;
    },
  };
}

export default createMapInteraction;
