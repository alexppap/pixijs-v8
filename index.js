/**
 * PixiJS工具主入口文件
 * 整合所有模块，提供统一的初始化和管理接口
 */

import { PixiApplication } from './core/PixiApplication.js';
import { StateManager } from './core/StateManager.js';
import { GraphicsFactory } from './graphics/GraphicsFactory.js';
import { AnimationController } from './controls/AnimationController.js';
import { ViewportController } from './controls/ViewportController.js';
import { UIController } from './ui/UIController.js';
import { KeyboardHandler } from './events/KeyboardHandler.js';

/**
 * PixiJS工具主类
 * 协调所有模块，提供统一的API接口
 */
export class PixiTool {
  constructor(containerId = 'pixi-container') {
    this.containerId = containerId;
    
    // 核心模块
    this.pixiApp = null;
    this.stateManager = null;
    
    // 功能模块
    this.graphicsFactory = null;
    this.animationController = null;
    this.viewportController = null;
    this.uiController = null;
    this.keyboardHandler = null;
    
    // 初始化状态
    this.isInitialized = false;
  }

  /**
   * 初始化PixiJS工具
   */
  async init() {
    try {
      console.log('开始初始化PixiJS工具...');
      
      // 1. 初始化核心应用
      this.pixiApp = new PixiApplication(this.containerId);
      const app = await this.pixiApp.init();
      
      // 2. 初始化状态管理器
      this.stateManager = new StateManager();
      
      // 3. 初始化图形工厂
      this.graphicsFactory = new GraphicsFactory(app);
      
      // 4. 初始化控制器
      this.animationController = new AnimationController(app, this.stateManager);
      this.viewportController = new ViewportController(app, this.stateManager);
      
      // 5. 初始化UI控制器
      this.uiController = new UIController(
        app, 
        this.stateManager, 
        this.graphicsFactory, 
        this.animationController, 
        this.viewportController
      );
      
      // 6. 初始化键盘处理器
      this.keyboardHandler = new KeyboardHandler();
      this.keyboardHandler.setup({
        viewport: this.viewportController,
        animation: this.animationController,
        ui: this.uiController
      });
      
      // 7. 初始化默认场景
      this.uiController.initializeDefaultScene();
      
      this.isInitialized = true;
      console.log('PixiJS工具初始化完成！');
      
      // 返回工具实例，便于链式调用
      return this;
      
    } catch (error) {
      console.error('PixiJS工具初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取应用实例
   */
  getApp() {
    return this.pixiApp?.getApp();
  }

  /**
   * 获取状态管理器
   */
  getStateManager() {
    return this.stateManager;
  }

  /**
   * 获取图形工厂
   */
  getGraphicsFactory() {
    return this.graphicsFactory;
  }

  /**
   * 获取动画控制器
   */
  getAnimationController() {
    return this.animationController;
  }

  /**
   * 获取视窗控制器
   */
  getViewportController() {
    return this.viewportController;
  }

  /**
   * 获取UI控制器
   */
  getUIController() {
    return this.uiController;
  }

  /**
   * 获取键盘处理器
   */
  getKeyboardHandler() {
    return this.keyboardHandler;
  }

  /**
   * 快捷方法：创建多边形
   * @param {Array} points - 顶点数组
   * @param {Object} options - 配置选项
   */
  createPolygon(points, options) {
    this.checkInitialized();
    return this.graphicsFactory.createPolygon(points, options);
  }

  /**
   * 快捷方法：创建厂区
   * @param {Object} options - 配置选项
   */
  createFactory(options) {
    this.checkInitialized();
    return this.graphicsFactory.createFactory(options);
  }

  /**
   * 快捷方法：切换旋转
   */
  toggleRotation() {
    this.checkInitialized();
    this.animationController.toggleRotation();
  }

  /**
   * 快捷方法：重置视窗
   */
  resetViewport() {
    this.checkInitialized();
    this.viewportController.reset();
  }

  /**
   * 快捷方法：缩放视窗
   * @param {number} factor - 缩放因子
   */
  zoom(factor) {
    this.checkInitialized();
    if (factor > 1) {
      this.viewportController.zoomIn();
    } else {
      this.viewportController.zoomOut();
    }
  }

  /**
   * 快捷方法：平移视窗
   * @param {number} deltaX - X轴移动距离
   * @param {number} deltaY - Y轴移动距离
   */
  pan(deltaX, deltaY) {
    this.checkInitialized();
    this.viewportController.pan(deltaX, deltaY);
  }

  /**
   * 快捷方法：获取当前状态
   */
  getStatus() {
    this.checkInitialized();
    return this.uiController.getStatusInfo();
  }

  /**
   * 快捷方法：重置所有
   */
  reset() {
    this.checkInitialized();
    this.uiController.reset();
  }

  /**
   * 添加自定义图形
   * @param {Function} drawFunction - 绘制函数
   * @param {Object} options - 配置选项
   */
  addCustomShape(drawFunction, options) {
    this.checkInitialized();
    const shape = this.graphicsFactory.createCustomShape(drawFunction, options);
    this.graphicsFactory.addToStage(shape);
    return shape;
  }

  /**
   * 添加自定义快捷键
   * @param {string} key - 按键
   * @param {Function} handler - 处理函数
   * @param {Object} modifiers - 修饰键
   */
  addShortcut(key, handler, modifiers) {
    this.checkInitialized();
    this.keyboardHandler.addShortcut(key, handler, modifiers);
  }

  /**
   * 获取快捷键帮助
   */
  getShortcutHelp() {
    this.checkInitialized();
    return this.keyboardHandler.getShortcutHelp();
  }

  /**
   * 设置视窗以适应内容
   * @param {Object} bounds - 内容边界
   * @param {number} padding - 边距比例
   */
  fitToContent(bounds, padding) {
    this.checkInitialized();
    this.viewportController.fitToContent(bounds, padding);
  }

  /**
   * 获取视窗信息
   */
  getViewportInfo() {
    this.checkInitialized();
    return this.viewportController.getViewportInfo();
  }

  /**
   * 订阅状态变化
   * @param {Function} callback - 回调函数
   */
  onStateChange(callback) {
    this.checkInitialized();
    return this.stateManager.subscribe(callback);
  }

  /**
   * 检查是否已初始化
   */
  checkInitialized() {
    if (!this.isInitialized) {
      throw new Error('PixiJS工具尚未初始化，请先调用 init() 方法');
    }
  }

  /**
   * 销毁工具实例
   */
  destroy() {
    if (!this.isInitialized) return;

    try {
      // 销毁各个模块
      this.keyboardHandler?.destroy();
      this.animationController?.destroy();
      this.pixiApp?.destroy();
      
      // 重置状态
      this.stateManager?.reset();
      
      // 清理引用
      this.pixiApp = null;
      this.stateManager = null;
      this.graphicsFactory = null;
      this.animationController = null;
      this.viewportController = null;
      this.uiController = null;
      this.keyboardHandler = null;
      
      this.isInitialized = false;
      
      console.log('PixiJS工具已销毁');
    } catch (error) {
      console.error('销毁PixiJS工具时发生错误:', error);
    }
  }

  /**
   * 获取工具版本信息
   */
  static getVersion() {
    return {
      version: '1.0.0',
      pixi: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown',
      author: 'PixiJS Tool',
      description: '基于PixiJS v8的模块化图形工具'
    };
  }

  /**
   * 静态方法：检查环境兼容性
   */
  static checkCompatibility() {
    const checks = {
      pixi: typeof PIXI !== 'undefined',
      canvas: !!document.createElement('canvas').getContext,
      webgl: !!document.createElement('canvas').getContext('webgl'),
      es6: typeof Symbol !== 'undefined'
    };

    const isCompatible = Object.values(checks).every(check => check);
    
    return {
      compatible: isCompatible,
      checks,
      recommendations: isCompatible ? [] : [
        !checks.pixi && 'PixiJS未加载',
        !checks.canvas && '浏览器不支持Canvas',
        !checks.webgl && '浏览器不支持WebGL',
        !checks.es6 && '浏览器不支持ES6'
      ].filter(Boolean)
    };
  }
}

// 自动初始化功能（如果在浏览器环境中直接运行）
if (typeof window !== 'undefined') {
  // 等待DOM加载完成
  const initializePixiTool = async () => {
    // 检查环境兼容性
    const compatibility = PixiTool.checkCompatibility();
    
    if (!compatibility.compatible) {
      console.error('环境不兼容:', compatibility.recommendations);
      alert(`环境不兼容: ${compatibility.recommendations.join(', ')}`);
      return;
    }

    // 检查 PixiJS 是否已加载
    if (typeof PIXI === 'undefined') {
      console.error('PixiJS 加载失败！');
      alert('PixiJS 加载失败，请检查网络连接！');
      return;
    }

    try {
      console.log('PixiJS v8 已成功加载！');
      console.log('版本信息:', PixiTool.getVersion());
      
      const pixiTool = new PixiTool();
      await pixiTool.init();
      
      // 将实例暴露到全局，便于调试和外部访问
      window.pixiTool = pixiTool;
      
      console.log('工具已挂载到 window.pixiTool，您可以在控制台中使用它');
      console.log('快捷键帮助:', pixiTool.getShortcutHelp());
      
    } catch (error) {
      console.error('初始化失败:', error);
      alert('初始化失败: ' + error.message);
    }
  };

  // DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePixiTool);
  } else {
    initializePixiTool();
  }
}

// 导出工具类
export default PixiTool; 