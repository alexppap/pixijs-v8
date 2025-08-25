/**
 * 视窗控制器
 * 负责管理视窗的拖拽、缩放、平移等操作
 */

import { VIEWPORT_CONFIG, APP_CONFIG } from '../utils/constants.js';

export class ViewportController {
  constructor(app, stateManager) {
    this.app = app;
    this.stateManager = stateManager;
    
    // 初始化视窗状态
    this.initViewport();
    
    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 初始化视窗状态
   */
  initViewport() {
    this.stateManager.updateViewport({
      x: 0,
      y: 0,
      scale: VIEWPORT_CONFIG.DEFAULT_SCALE
    });
  }

  /**
   * 设置视窗控制相关的事件监听器
   */
  setupEventListeners() {
    if (!this.app || !this.app.canvas) {
      console.error('Canvas未准备好，无法设置视窗控制');
      return;
    }

    const canvas = this.app.canvas;
    
    // 添加滚轮事件监听器
    canvas.addEventListener('wheel', (event) => {
      this.handleWheel(event);
    }, { passive: false });
    
    // 添加鼠标/触摸事件监听器
    canvas.addEventListener('pointerdown', (event) => {
      this.handlePointerDown(event);
    });
    
    // 在全局监听移动和抬起事件，确保拖拽不会中断
    window.addEventListener('pointermove', (event) => {
      this.handlePointerMove(event);
    });
    
    window.addEventListener('pointerup', (event) => {
      this.handlePointerUp(event);
    });
    
    // 也添加鼠标事件作为备用
    canvas.addEventListener('mousedown', (event) => {
      this.handlePointerDown(event);
    });
    
    window.addEventListener('mousemove', (event) => {
      this.handlePointerMove(event);
    });
    
    window.addEventListener('mouseup', (event) => {
      this.handlePointerUp(event);
    });
    
    // 防止右键菜单影响拖拽
    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  /**
   * 处理鼠标滚轮缩放
   * @param {WheelEvent} event - 滚轮事件
   */
  handleWheel(event) {
    event.preventDefault();
    const state = this.stateManager.getState();
    const viewport = state.viewport;
    
    // 获取鼠标在canvas中的位置，考虑缩放比例
    const rect = this.app.canvas.getBoundingClientRect();
    const scaleX = this.app.canvas.width / rect.width;
    const scaleY = this.app.canvas.height / rect.height;
    
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;
    
    // 计算缩放因子
    const scaleFactor = event.deltaY > 0 
      ? VIEWPORT_CONFIG.WHEEL_ZOOM_OUT_FACTOR 
      : VIEWPORT_CONFIG.WHEEL_ZOOM_IN_FACTOR;
      
    const newScale = Math.max(
      VIEWPORT_CONFIG.MIN_SCALE,
      Math.min(VIEWPORT_CONFIG.MAX_SCALE, viewport.scale * scaleFactor)
    );
    
    // 如果缩放值没有变化，直接返回
    if (newScale === viewport.scale) return;
    
    // 计算鼠标在世界坐标系中的位置
    const worldX = (mouseX - viewport.x) / viewport.scale;
    const worldY = (mouseY - viewport.y) / viewport.scale;
    
    // 更新视窗状态
    const newViewport = {
      scale: newScale,
      x: mouseX - worldX * newScale,
      y: mouseY - worldY * newScale
    };
    
    this.stateManager.updateViewport(newViewport);
    this.updateViewport();
    if(!this.app.autoStart) {
      this.app.render();
    }
  }

  /**
   * 处理鼠标按下事件
   * @param {PointerEvent} event - 指针事件
   */
  handlePointerDown(event) {
    if(!this.app.autoStart) {
      this.app.start();
    }
    // 只处理在canvas上的点击
    const rect = this.app.canvas.getBoundingClientRect();
    const isOnCanvas = event.clientX >= rect.left && event.clientX <= rect.right &&
                      event.clientY >= rect.top && event.clientY <= rect.bottom;
    
    if (!isOnCanvas) return;
    
    this.stateManager.setDragging(true, {
      x: event.clientX,
      y: event.clientY
    });
    
    // 改变鼠标样式
    this.app.canvas.style.cursor = APP_CONFIG.CURSOR_GRABBING;
    
    // 阻止默认行为
    event.preventDefault();
  }

  /**
   * 处理鼠标移动事件
   * @param {PointerEvent} event - 指针事件
   */
  handlePointerMove(event) {
    const state = this.stateManager.getState();
    if (!state.isDragging) return;
    
    // 计算移动距离
    const deltaX = event.clientX - state.lastPointerPosition.x;
    const deltaY = event.clientY - state.lastPointerPosition.y;
    
    // 更新视窗位置
    const newViewport = {
      x: state.viewport.x + deltaX,
      y: state.viewport.y + deltaY
    };
    
    this.stateManager.updateViewport(newViewport);
    this.stateManager.setDragging(true, {
      x: event.clientX,
      y: event.clientY
    });
    
    this.updateViewport();
  }

  /**
   * 处理鼠标抬起事件
   * @param {PointerEvent} event - 指针事件
   */
  handlePointerUp(event) {
    this.stateManager.setDragging(false);
    
    // 恢复鼠标样式
    this.app.canvas.style.cursor = APP_CONFIG.CURSOR_GRAB;

    if(!this.app.autoStart) {
      this.app.stop();
    }
  }

  /**
   * 设置视窗变换
   */
  updateViewport() {
    if (!this.app || !this.app.stage) return;
    
    const viewport = this.stateManager.get('viewport');
    this.app.stage.position.set(viewport.x, viewport.y);
    this.app.stage.scale.set(viewport.scale);
  }

  /**
   * 放大视窗
   */
  zoomIn() {
    const viewport = this.stateManager.get('viewport');
    const centerX = this.app.canvas.width / 2;
    const centerY = this.app.canvas.height / 2;
    
    const scaleFactor = VIEWPORT_CONFIG.ZOOM_IN_FACTOR;
    const newScale = Math.min(VIEWPORT_CONFIG.MAX_SCALE, viewport.scale * scaleFactor);
    
    if (newScale === viewport.scale) return;
    
    const worldX = (centerX - viewport.x) / viewport.scale;
    const worldY = (centerY - viewport.y) / viewport.scale;
    
    const newViewport = {
      scale: newScale,
      x: centerX - worldX * newScale,
      y: centerY - worldY * newScale
    };
    
    this.stateManager.updateViewport(newViewport);
    this.updateViewport();
    if (!this.app.autoStart) {
      this.app.render();
    }
  }

  /**
   * 缩小视窗
   */
  zoomOut() {
    const viewport = this.stateManager.get('viewport');
    const centerX = this.app.canvas.width / 2;
    const centerY = this.app.canvas.height / 2;
    
    const scaleFactor = VIEWPORT_CONFIG.ZOOM_OUT_FACTOR;
    const newScale = Math.max(VIEWPORT_CONFIG.MIN_SCALE, viewport.scale * scaleFactor);
    
    if (newScale === viewport.scale) return;
    
    const worldX = (centerX - viewport.x) / viewport.scale;
    const worldY = (centerY - viewport.y) / viewport.scale;
    
    const newViewport = {
      scale: newScale,
      x: centerX - worldX * newScale,
      y: centerY - worldY * newScale
    };
    
    this.stateManager.updateViewport(newViewport);
    this.updateViewport();
    if (!this.app.autoStart) {
      this.app.render();
    }
  }

  /**
   * 重置视窗到初始状态
   */
  reset() {
    this.stateManager.updateViewport({
      x: 0,
      y: 0,
      scale: VIEWPORT_CONFIG.DEFAULT_SCALE
    });
    this.updateViewport();
    if (!this.app.autoStart) {
      this.app.render();
    }
    console.log('视窗已重置');
  }

  /**
   * 平移视窗
   * @param {number} deltaX - X轴移动距离
   * @param {number} deltaY - Y轴移动距离
   */
  pan(deltaX, deltaY) {
    const viewport = this.stateManager.get('viewport');
    const newViewport = {
      x: viewport.x + deltaX,
      y: viewport.y + deltaY
    };
    
    this.stateManager.updateViewport(newViewport);
    this.updateViewport();
    if (!this.app.autoStart) {
      this.app.render();
    }
  }

  /**
   * 缩放到指定比例
   * @param {number} scale - 目标缩放比例
   * @param {Object} center - 缩放中心点 {x, y}，默认为画布中心
   */
  zoomTo(scale, center = null) {
    const targetScale = Math.max(
      VIEWPORT_CONFIG.MIN_SCALE,
      Math.min(VIEWPORT_CONFIG.MAX_SCALE, scale)
    );
    
    const centerX = center ? center.x : this.app.canvas.width / 2;
    const centerY = center ? center.y : this.app.canvas.height / 2;
    
    const viewport = this.stateManager.get('viewport');
    const worldX = (centerX - viewport.x) / viewport.scale;
    const worldY = (centerY - viewport.y) / viewport.scale;
    
    const newViewport = {
      scale: targetScale,
      x: centerX - worldX * targetScale,
      y: centerY - worldY * targetScale
    };
    
    this.stateManager.updateViewport(newViewport);
    this.updateViewport();
    if (!this.app.autoStart) {
      this.app.render();
    }
  }

  /**
   * 适应视窗大小（缩放以适应内容）
   * @param {Object} bounds - 内容边界 {x, y, width, height}
   * @param {number} padding - 边距比例，默认0.1
   */
  fitToContent(bounds, padding = 0.1) {
    if (!bounds) return;
    
    const canvasWidth = this.app.canvas.width;
    const canvasHeight = this.app.canvas.height;
    
    // 计算缩放比例
    const scaleX = (canvasWidth * (1 - padding * 2)) / bounds.width;
    const scaleY = (canvasHeight * (1 - padding * 2)) / bounds.height;
    const scale = Math.min(scaleX, scaleY);
    
    // 计算中心位置
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const contentCenterX = bounds.x + bounds.width / 2;
    const contentCenterY = bounds.y + bounds.height / 2;
    
    const newViewport = {
      scale: Math.max(VIEWPORT_CONFIG.MIN_SCALE, Math.min(VIEWPORT_CONFIG.MAX_SCALE, scale)),
      x: centerX - contentCenterX * scale,
      y: centerY - contentCenterY * scale
    };
    
    this.stateManager.updateViewport(newViewport);
    this.updateViewport();
    if (!this.app.autoStart) {
      this.app.render();
    }
  }

  /**
   * 获取当前视窗信息
   * @returns {Object} 视窗信息
   */
  getViewportInfo() {
    const viewport = this.stateManager.get('viewport');
    return {
      ...viewport,
      minScale: VIEWPORT_CONFIG.MIN_SCALE,
      maxScale: VIEWPORT_CONFIG.MAX_SCALE,
      canvasWidth: this.app.canvas.width,
      canvasHeight: this.app.canvas.height
    };
  }
} 