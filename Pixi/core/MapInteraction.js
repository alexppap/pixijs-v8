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
 *              2026-08-25 重构（P1-4）：mouse + touch 两套监听统一为
 *              Pointer Events（pointerdown/move/up/cancel），单指拖拽与鼠标
 *              拖拽走同一条路径，双指捏合按活跃指针表计算。同时修正两个缺陷：
 *              ① 只有主键（button === 0）触发拖拽，右键/中键不再拖动地图；
 *              ② 用 setPointerCapture 承接后续事件，拖到画布外不再中断。
 *              行为收敛：源码 mouse 路径在 mousedown 触发 onInteractionStart，
 *              touch 路径却延到 touchmove；统一后触摸单指拖拽也在按下时触发
 *              （与鼠标一致，弹窗关得更早）。捏合仍在 move 时持续触发。
 *              注：canvas 需 touch-action: none，否则浏览器原生手势会吞掉
 *              pointermove（替代源码 touchmove 里的 preventDefault）。
 * Version: 2.0.0
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
  onInteractionStart: null, // 交互开始/进行回调（pointerdown/wheel/捏合，对应源码关闭弹窗时机）
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

  /**
   * 活跃指针表：pointerId → 最近一次 client 坐标。
   * 1 个 → 拖拽；2 个 → 捏合缩放（触屏/触控板均走此路径）
   * @type {Map<number, {x: number, y: number}>}
   */
  const activePointers = new Map();

  // 交互状态（对齐 v6 interactionState 结构）
  const state = {
    isDragging: false, // 是否处于拖拽中
    dragPointerId: null, // 承担拖拽的指针 ID（多指时只认第一根）
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
   * @param {Number} clientX - 指针 clientX
   * @param {Number} clientY - 指针 clientY
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

  /**
   * 把缩放比例限制在配置范围内
   * @param {Number} value - 目标缩放
   * @returns {Number} 限制后的缩放
   */
  const clampScale = (value) =>
    Math.max(config.minScale, Math.min(config.maxScale, value));

  /**
   * 取当前两根活跃指针（不足两根返回 null）
   * @returns {Array<{x: number, y: number}>|null} 两个指针坐标
   */
  const getTwoPointers = () => {
    if (activePointers.size < 2) return null;
    const [p1, p2] = [...activePointers.values()];
    return [p1, p2];
  };

  // ------------------------------
  // 指针事件处理（鼠标 / 触摸 / 触控笔统一）
  // ------------------------------
  /**
   * 指针按下：单指进入拖拽，第二指切入捏合
   * @param {PointerEvent} event - 指针事件
   */
  const handlePointerDown = (event) => {
    // 只有主键（左键/单指触摸/笔尖）拖拽；右键、中键不参与
    if (event.button !== 0) return;

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // 捕获该指针：后续 move/up 即便移出画布也仍派发到 canvas，
    // 修复"拖到画布外拖拽中断"（源实现把 mousemove/up 绑在 canvas 上）
    canvas.setPointerCapture?.(event.pointerId);

    if (activePointers.size === 1) {
      state.isDragging = true;
      state.dragPointerId = event.pointerId;
      state.dragStart = { x: event.clientX, y: event.clientY };
      state.containerStart = { x: container.x, y: container.y };
      // 对齐源码：按下时触发交互开始回调（关闭弹窗等）
      config.onInteractionStart?.();
    } else if (activePointers.size === 2) {
      // 第二根手指落下：从拖拽切换到捏合
      state.isPinching = true;
      state.isDragging = false;
      state.dragPointerId = null;
      const pair = getTwoPointers();
      state.initialDistance = Math.hypot(
        pair[0].x - pair[1].x,
        pair[0].y - pair[1].y
      );
    }
  };

  /**
   * 指针移动：单指拖拽平移 / 双指捏合缩放
   * @param {PointerEvent} event - 指针事件
   */
  const handlePointerMove = (event) => {
    // 未登记的指针（如未按下的鼠标移动）不处理
    if (!activePointers.has(event.pointerId)) return;

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // 双指捏合缩放
    if (state.isPinching) {
      handlePinchZoom();
      return;
    }

    // 单指/鼠标拖拽平移
    if (!state.isDragging || event.pointerId !== state.dragPointerId) return;

    const deltaX = event.clientX - state.dragStart.x;
    const deltaY = event.clientY - state.dragStart.y;

    // 更新容器位置
    const newX = state.containerStart.x + deltaX;
    const newY = state.containerStart.y + deltaY;
    container.position.set(newX, newY);

    // 超过拖拽阈值才视为有效拖拽
    const beyondThreshold =
      Math.abs(deltaX) > config.dragThreshold ||
      Math.abs(deltaY) > config.dragThreshold;
    if (beyondThreshold) {
      config.onDrag?.(newX, newY);
    }
  };

  /**
   * 指针抬起/取消：移出指针表，必要时结束拖拽或捏合
   * @param {PointerEvent} event - 指针事件
   */
  const handlePointerUp = (event) => {
    activePointers.delete(event.pointerId);
    // 必须先查 hasPointerCapture：捕获已释放时 releasePointerCapture 会抛
    // NotFoundError。lostpointercapture 也走本处理器，那时捕获正是已释放状态
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (activePointers.size < 2) {
      state.isPinching = false;
      state.initialDistance = 0;
    }

    if (activePointers.size === 0) {
      state.isDragging = false;
      state.dragPointerId = null;
      return;
    }

    // 捏合中抬起一根手指：剩下那根接续拖拽（避免地图"卡住"）
    if (activePointers.size === 1) {
      const [id] = [...activePointers.keys()];
      const point = activePointers.get(id);
      state.isDragging = true;
      state.dragPointerId = id;
      state.dragStart = { x: point.x, y: point.y };
      state.containerStart = { x: container.x, y: container.y };
    }
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
    const newScale = clampScale(curScale + delta);
    if (newScale === curScale) return;

    applyScale(newScale, getLocalPoint(event.clientX, event.clientY));
  };

  /**
   * 双指捏合缩放处理（按活跃指针表实时距离比例缩放）
   */
  const handlePinchZoom = () => {
    const pair = getTwoPointers();
    if (!pair) return;

    // 捏合进行中回调（关闭弹窗等，对齐源码 touchmove 时机）
    config.onInteractionStart?.();

    const currentDistance = Math.hypot(
      pair[0].x - pair[1].x,
      pair[0].y - pair[1].y
    );

    if (state.initialDistance > 0) {
      // 计算中心点
      const centerPos = getLocalPoint(
        (pair[0].x + pair[1].x) / 2,
        (pair[0].y + pair[1].y) / 2
      );

      // 更新缩放并限制范围（比例式缩放）
      const curScale = currentScale();
      const newScale = clampScale(
        curScale * (currentDistance / state.initialDistance)
      );

      if (newScale !== curScale) {
        applyScale(newScale, centerPos);
      }
    }

    state.initialDistance = currentDistance;
  };

  // ------------------------------
  // 事件绑定与解绑
  // ------------------------------
  // touch-action: none —— 交由 Pointer Events 处理手势，
  // 否则浏览器原生滚动/双击缩放会吞掉 pointermove
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";

  const listeners = [
    ["pointerdown", handlePointerDown],
    ["pointermove", handlePointerMove],
    ["pointerup", handlePointerUp],
    ["pointercancel", handlePointerUp],
    // 指针捕获下 pointerleave 不该结束拖拽（拖出画布仍继续），
    // 但捕获不可用时（旧浏览器）仍需兜底
    ["lostpointercapture", handlePointerUp],
    ["wheel", handleWheel, { passive: false }],
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
     * 只读交互状态（供 ship.js hover 效果等消费方判断"拖拽/捏合中不跳动"，
     * 免去调用方自行维护一份同名状态）
     */
    interactionState: {
      get isDragging() {
        return state.isDragging;
      },
      get isPinching() {
        return state.isPinching;
      },
    },
    /**
     * 移除所有交互事件监听，释放资源
     */
    destroy() {
      listeners.forEach(([type, handler, opts]) => {
        canvas.removeEventListener(type, handler, opts);
      });
      canvas.style.touchAction = previousTouchAction;
      activePointers.clear();
      state.isDragging = false;
      state.dragPointerId = null;
      state.isPinching = false;
      state.initialDistance = 0;
    },
  };
}

export default createMapInteraction;
