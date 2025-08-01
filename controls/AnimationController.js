/**
 * 动画控制器
 * 负责管理所有动画效果，包括旋转、缩放、位移等
 */

import { ANIMATION_CONFIG } from '../utils/constants.js';

export class AnimationController {
  constructor(app, stateManager) {
    this.app = app;
    this.stateManager = stateManager;
    this.animations = new Map();
    this.isAnimationLoopRunning = false;
    
    // 初始化动画循环
    this.setupAnimationLoop();
  }

  /**
   * 设置动画循环
   */
  setupAnimationLoop() {
    // 使用 PixiJS 的 ticker 来创建动画循环
    this.app.ticker.add(() => {
      this.animate();
    });
    this.isAnimationLoopRunning = true;
  }

  /**
   * 动画帧更新
   */
  animate() {
    const state = this.stateManager.getState();
    
    // 如果正在旋转，更新旋转角度
    if (state.isRotating && state.currentGraphic) {
      this.updateRotation(state.currentGraphic, state.centerDot, state.geometricCenterDot);
    }
  }

  /**
   * 更新旋转动画
   * @param {PIXI.Graphics} graphic - 图形对象
   * @param {PIXI.Sprite} centerDot - 中心点对象
   * @param {PIXI.Sprite} geometricCenterDot - 几何中心点对象
   */
  updateRotation(graphic, centerDot = null, geometricCenterDot = null) {
    if (!graphic) return;

    graphic.rotation += ANIMATION_CONFIG.DEFAULT_ROTATION_SPEED;
    
    // 如果显示了中心点，让它跟随图形旋转
    if (centerDot) {
      centerDot.rotation = graphic.rotation;
    }
    
    // 如果显示了几何中心点，让它跟随图形旋转
    if (geometricCenterDot) {
      geometricCenterDot.rotation = graphic.rotation;
    }
  }

  /**
   * 开始旋转动画
   * @param {PIXI.Graphics} target - 目标对象
   * @param {number} speed - 旋转速度
   */
  startRotation(target, speed = ANIMATION_CONFIG.DEFAULT_ROTATION_SPEED) {
    if (!target) return;

    this.stateManager.setState({ isRotating: true });
    
    const animation = {
      type: 'rotation',
      target,
      speed,
      startTime: Date.now()
    };
    
    this.animations.set(target, animation);
    console.log('开始旋转动画');
  }

  /**
   * 停止旋转动画
   * @param {PIXI.Graphics} target - 目标对象
   */
  stopRotation(target = null) {
    this.stateManager.setState({ isRotating: false });
    
    if (target) {
      this.animations.delete(target);
    } else {
      // 停止所有旋转动画
      this.animations.forEach((animation, animTarget) => {
        if (animation.type === 'rotation') {
          this.animations.delete(animTarget);
        }
      });
    }
    console.log('停止旋转动画');
  }

  /**
   * 切换旋转状态
   */
  toggleRotation() {
    const state = this.stateManager.getState();
    const target = state.currentGraphic;
    
    if (!target) return;

    if (state.isRotating) {
      this.stopRotation(target);
    } else {
      this.startRotation(target);
    }
  }

  /**
   * 弹跳动画
   * @param {PIXI.Graphics} target - 目标对象
   * @param {Object} options - 动画选项
   */
  bounce(target, options = {}) {
    if (!target) return;

    const {
      scale = ANIMATION_CONFIG.BOUNCE_SCALE,
      duration = ANIMATION_CONFIG.BOUNCE_DURATION,
      onComplete = null
    } = options;

    const originalScale = target.scale.x;
    const startTime = Date.now();
    
    const bounceAnimation = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数创建弹跳效果
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentScale = originalScale + (scale - originalScale) * Math.sin(easeOut * Math.PI);
      
      target.scale.set(currentScale);
      
      if (progress < 1) {
        requestAnimationFrame(bounceAnimation);
      } else {
        target.scale.set(originalScale);
        if (onComplete) onComplete();
      }
    };
    
    bounceAnimation();
    console.log('执行弹跳动画');
  }

  /**
   * 淡入动画
   * @param {PIXI.Graphics} target - 目标对象
   * @param {Object} options - 动画选项
   */
  fadeIn(target, options = {}) {
    if (!target) return;

    const {
      duration = 500,
      onComplete = null
    } = options;

    target.alpha = 0;
    const startTime = Date.now();
    
    const fadeAnimation = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      target.alpha = progress;
      
      if (progress < 1) {
        requestAnimationFrame(fadeAnimation);
      } else {
        target.alpha = 1;
        if (onComplete) onComplete();
      }
    };
    
    fadeAnimation();
  }

  /**
   * 淡出动画
   * @param {PIXI.Graphics} target - 目标对象
   * @param {Object} options - 动画选项
   */
  fadeOut(target, options = {}) {
    if (!target) return;

    const {
      duration = 500,
      onComplete = null
    } = options;

    const startTime = Date.now();
    
    const fadeAnimation = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      target.alpha = 1 - progress;
      
      if (progress < 1) {
        requestAnimationFrame(fadeAnimation);
      } else {
        target.alpha = 0;
        if (onComplete) onComplete();
      }
    };
    
    fadeAnimation();
  }

  /**
   * 移动动画
   * @param {PIXI.Graphics} target - 目标对象
   * @param {Object} to - 目标位置 {x, y}
   * @param {Object} options - 动画选项
   */
  moveTo(target, to, options = {}) {
    if (!target) return;

    const {
      duration = 1000,
      easing = 'easeOut',
      onComplete = null
    } = options;

    const from = { x: target.x, y: target.y };
    const startTime = Date.now();
    
    const moveAnimation = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 应用缓动函数
      let easedProgress = progress;
      if (easing === 'easeOut') {
        easedProgress = 1 - Math.pow(1 - progress, 3);
      } else if (easing === 'easeIn') {
        easedProgress = Math.pow(progress, 3);
      } else if (easing === 'easeInOut') {
        easedProgress = progress < 0.5 
          ? 4 * Math.pow(progress, 3) 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      }
      
      target.x = from.x + (to.x - from.x) * easedProgress;
      target.y = from.y + (to.y - from.y) * easedProgress;
      
      if (progress < 1) {
        requestAnimationFrame(moveAnimation);
      } else {
        target.x = to.x;
        target.y = to.y;
        if (onComplete) onComplete();
      }
    };
    
    moveAnimation();
  }

  /**
   * 停止所有动画
   */
  stopAll() {
    this.animations.clear();
    this.stateManager.setState({ isRotating: false });
    console.log('停止所有动画');
  }

  /**
   * 销毁动画控制器
   */
  destroy() {
    this.stopAll();
    if (this.isAnimationLoopRunning) {
      // 注意：实际上我们不能直接移除ticker，因为其他组件可能也在使用
      // 在实际应用中，可能需要更复杂的ticker管理
      this.isAnimationLoopRunning = false;
    }
  }
} 