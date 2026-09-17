/**
 * FileName: animation.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 精灵动画控制。由源项目 CSS-Web public/js/map/sprite.js 的
 *              animationController / startArrowAnimation / stopAnimation /
 *              clearSprites（425–504、1144–1166 行）移植（v6 → v8）：
 *              - 动画循环由 requestAnimationFrame + Map.render() 改为
 *                app.ticker.add：常驻渲染下 rAF 手动渲染会造成每帧渲染两次
 *              - 控制器由模块级单例改为 createAnimationController() 工厂：
 *                双图联动（CoordinateSystem onSyncPosition/onSyncWheel）场景下
 *                单例会让第二个地图的 startArrowAnimation 停掉第一个的动画
 *              - clearSprites：interactive=false/buttonMode=false →
 *                eventMode="pass-through"（v8 无 buttonMode）
 * Version: 2.0.0
 */
import { calculatePathLength, getPointAtDistance } from "../../utils/mapUtils";

/** 动画速度（每帧进度增量，源 SPRITE_CONFIG.ANIMATION.SPEED） */
export const ANIMATION_SPEED = 0.002;

/**
 * 创建箭头动画控制器（每个地图实例一个，实例间互不干扰）
 * @returns {{startArrowAnimation: Function, stopAnimation: Function,
 *            isRunning: Function, destroy: Function}} 控制器
 */
export function createAnimationController() {
  const state = {
    isRunning: false,
    progress: 0,
    speed: ANIMATION_SPEED,
  };

  /** 当前挂在 ticker 上的回调（null 表示未运行） */
  let tickFn = null;
  /** 挂载 tickFn 的 ticker（停止时需从同一个 ticker 摘除） */
  let boundTicker = null;

  /**
   * 停止动画（从 ticker 摘除回调；AnimatedSprite 帧动画由各自 destroy() 停止）
   */
  const stopAnimation = () => {
    if (tickFn && boundTicker) {
      boundTicker.remove(tickFn);
    }
    tickFn = null;
    boundTicker = null;
    state.isRunning = false;
  };

  /**
   * 启动箭头（车辆沿路径移动）动画
   * @param {object} sprite 移动精灵（沿 pathPoints 循环移动）
   * @param {object[]} pathPoints 路径点数组（{x, y} 格式）
   * @param {object} pixiMap PixiMap 实例（取 app.ticker 驱动动画）
   */
  const startArrowAnimation = (sprite, pathPoints, pixiMap) => {
    // 停止现有动画（同一控制器内同时只跑一条路线，对齐源码语义）
    stopAnimation();

    const ticker = pixiMap?.app?.ticker;
    if (!ticker || !sprite) {
      console.warn("startArrowAnimation: 缺少 ticker 或精灵，动画未启动");
      return;
    }

    state.isRunning = true;
    state.progress = 0;

    // 计算路径总长度
    const totalDistance = calculatePathLength(pathPoints);

    // ticker 回调：只更新位置/朝向，渲染由常驻 ticker 自身完成
    tickFn = () => {
      if (!state.isRunning || !sprite || sprite.destroyed) {
        stopAnimation();
        return;
      }

      // 更新进度
      state.progress += state.speed;
      if (state.progress >= 1) {
        state.progress = 0;
      }

      // 更新位置
      const currentDistance = state.progress * totalDistance;
      const currentPoint = getPointAtDistance(pathPoints, currentDistance);

      if (
        currentPoint &&
        sprite.x !== undefined &&
        sprite.y !== undefined
      ) {
        sprite.x = currentPoint.x;
        sprite.y = currentPoint.y;

        // 更新方向
        const nextDistance = Math.min(currentDistance + 10, totalDistance);
        const nextPoint = getPointAtDistance(pathPoints, nextDistance);

        if (nextPoint) {
          const angle = Math.atan2(
            nextPoint.y - currentPoint.y,
            nextPoint.x - currentPoint.x
          );
          if (sprite.rotation !== undefined) {
            sprite.rotation = angle;
          }
        }
      }
    };

    boundTicker = ticker;
    ticker.add(tickFn);
  };

  return {
    startArrowAnimation,
    stopAnimation,

    /**
     * 动画是否在运行
     * @returns {boolean} 运行状态
     */
    isRunning: () => state.isRunning,

    /**
     * 销毁控制器（等价 stopAnimation，供状态清理链统一调用）
     */
    destroy: stopAnimation,
  };
}

/**
 * 清空精灵数组并销毁精灵（car/router/ship 共用）
 * v6 → v8：interactive=false/buttonMode=false → eventMode="pass-through"
 * @param {object[]} spritesArray 精灵数组
 */
export function clearSprites(spritesArray) {
  if (Array.isArray(spritesArray) && spritesArray.length > 0) {
    spritesArray.forEach((item) => {
      if (item && item.destroy && typeof item.destroy === "function") {
        try {
          // 先停悬停效果（摘除 ticker 回调与 mouseover/mouseout 监听），
          // 否则动画回调会在容器销毁后继续访问已销毁对象
          if (typeof item.__hoverEffect?.destroy === "function") {
            item.__hoverEffect.destroy();
            item.__hoverEffect = null;
          }
          // 在销毁前移除所有事件监听器，避免交互系统继续引用
          item.removeAllListeners();
          // 标记为不可交互（v8：eventMode 还原为 pass-through）
          item.eventMode = "pass-through";
          // 销毁精灵
          item.destroy({ children: true });
        } catch (e) {
          console.warn("销毁精灵时出错:", e);
        }
      }
    });
    // 清空数组
    spritesArray.splice(0, spritesArray.length);
  }
}
