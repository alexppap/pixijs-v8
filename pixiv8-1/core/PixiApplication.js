/**
 * PixiJS应用核心类
 * 负责PixiJS应用的初始化和基本配置
 */

import { APP_CONFIG } from '../utils/constants.js';

export class PixiApplication {
  constructor(containerId = 'pixi-container', autoStart = false) {
    this.app = null;
    this.containerId = containerId;
    this.container = null;
    this.autoStart = autoStart;
  }

  /**
   * 初始化PixiJS应用
   */
  async init() {
    // 获取容器元素
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`未找到${this.containerId}元素`);
    }

    // 获取容器的实际尺寸
    const containerRect = this.container.getBoundingClientRect();
    const containerWidth = containerRect.width || this.container.clientWidth || 800;
    const containerHeight = containerRect.height || this.container.clientHeight || 600;

    // 创建 PixiJS 应用实例
    this.app = new PIXI.Application();
    
    // 使用容器的实际尺寸初始化应用
    await this.app.init({
      width: containerWidth,
      height: containerHeight,
      backgroundColor: APP_CONFIG.DEFAULT_BACKGROUND_COLOR,
      antialias: APP_CONFIG.ANTIALIAS,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      autoStart: this.autoStart
    });

    // 将 canvas 添加到 DOM
    this.container.appendChild(this.app.canvas);

    // 配置canvas样式
    this.setupCanvasStyle();

    console.log(`PixiJS应用初始化完成: ${containerWidth} x ${containerHeight}`);
    this.app.renderer.render(this.app.stage);
    return this.app;
  }

  /**
   * 配置canvas样式
   */
  setupCanvasStyle() {
    if (!this.app || !this.app.canvas) return;

    const canvas = this.app.canvas;
    
    // 让canvas填充整个容器
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    
    // 设置触摸行为
    canvas.style.touchAction = APP_CONFIG.TOUCH_ACTION;
    
    // 设置初始鼠标样式
    canvas.style.cursor = APP_CONFIG.CURSOR_GRAB;
  }

  /**
   * 处理窗口大小调整
   */
  handleResize() {
    if (!this.app || !this.container) return;
    
    // 获取容器的新尺寸
    const containerRect = this.container.getBoundingClientRect();
    const newWidth = containerRect.width || this.container.clientWidth;
    const newHeight = containerRect.height || this.container.clientHeight;

    // 避免无效尺寸
    if (newWidth <= 0 || newHeight <= 0) return;

    console.log(`调整尺寸为: ${newWidth} x ${newHeight}`);
    
    // 调整PixiJS渲染器尺寸
    this.app.renderer.resize(newWidth, newHeight);
    
    return { width: newWidth, height: newHeight };
  }

  /**
   * 获取应用实例
   */
  getApp() {
    return this.app;
  }

  /**
   * 获取容器信息
   */
  getContainer() {
    return this.container;
  }

  /**
   * 销毁应用
   */
  destroy() {
    if (this.app) {
      this.app.destroy(true, true);
      this.app = null;
    }
  }
} 