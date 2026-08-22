/**
 * FileName: animation.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 精灵动画控制。由源项目 CSS-Web public/js/map/sprite.js 的
 *              animationController / startArrowAnimation / stopAnimation /
 *              clearSprites（425–504、1144–1166 行）移植（v6 → v8）：
 *              - 动画循环仍用 requestAnimationFrame + Map.render()（本项目
 *                autoStart 常驻渲染，render 冗余但无害，对齐移植计划 §5）
 *              - clearSprites：interactive=false/buttonMode=false →
 *                eventMode="pass-through"（v8 无 buttonMode）
 * Version: 1.0.0
 */
import { calculatePathLength, getPointAtDistance } from "../../utils/mapUtils";

/** 动画速度（每帧进度增量，源 SPRITE_CONFIG.ANIMATION.SPEED） */
export const ANIMATION_SPEED = 0.002;

// 动画控制器（模块级单例，对齐源码语义：同一路线动画全局唯一）
const animationController = {
  isRunning: false,
  animationId: null,
  progress: 0,
  speed: ANIMATION_SPEED,
};

/**
 * 启动箭头（车辆沿路径移动）动画
 * @param {object} sprite 移动精灵（沿 pathPoints 循环移动）
 * @param {object[]} pathPoints 路径点数组（{x, y} 格式）
 * @param {object} Map PixiMap 实例（render 触发渲染）
 */
export function startArrowAnimation(sprite, pathPoints, Map) {
  // 停止现有动画
  stopAnimation();

  // 初始化动画状态
  animationController.isRunning = true;
  animationController.progress = 0;

  // 计算路径总长度
  const totalDistance = calculatePathLength(pathPoints);

  // 动画函数
  const animate = () => {
    if (!animationController.isRunning || !sprite || !Map || !Map.render) {
      stopAnimation();
      return;
    }

    // 更新进度
    animationController.progress += animationController.speed;
    if (animationController.progress >= 1) {
      animationController.progress = 0;
    }

    // 更新位置
    const currentDistance = animationController.progress * totalDistance;
    const currentPoint = getPointAtDistance(pathPoints, currentDistance);

    if (
      currentPoint &&
      sprite &&
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

    try {
      Map.render();
      animationController.animationId = requestAnimationFrame(animate);
    } catch (e) {
      stopAnimation();
      console.warn("动画渲染失败，已停止", e);
    }
  };

  // 启动动画
  animationController.animationId = requestAnimationFrame(animate);
}

/**
 * 停止动画（供外部调用，v8 ticker 语义：取消 rAF 循环；
 * AnimatedSprite 帧动画由各自 destroy() 停止）
 */
export function stopAnimation() {
  if (animationController.animationId) {
    cancelAnimationFrame(animationController.animationId);
    animationController.isRunning = false;
    animationController.animationId = null;
  }
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
