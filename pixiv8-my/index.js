import { PixiApplication } from './core/PixiApplication.js';
import { FactoryRenderer } from './graphics/FactoryRenderer.js';
import { StateManager } from './core/StateManager.js';
import { ViewportController } from './controls/ViewportController.js';

export class PixiTool {
  constructor({ pixiApp, stateManager, graphicsFactory, viewportController, containerId = 'pixi-container', autoStart = false }) {
    this.containerId = containerId;
    this.autoStart = autoStart;
    this.pixiApp = pixiApp;
    this.stateManager = stateManager;
    this.graphicsFactory = graphicsFactory;
    this.viewportController = viewportController;
  }

  /**
   * 初始化PixiJS工具（保留，兼容老用法，但推荐用工厂函数）
   */
  async init() {
    try {
      console.log('PixiJS工具初始化完成！');
      // 1. 初始化核心应用
      this.pixiApp = new PixiApplication(this.containerId, this.autoStart);
      const app = await this.pixiApp.init();
      // 2. 初始化状态管理器
      this.stateManager = new StateManager();
      // 3. 初始化工厂
      this.graphicsFactory = new FactoryRenderer(app);
      const factory = this.graphicsFactory.create();
      this.pixiApp.app.stage.addChild(factory);
      // 4. 初始化视窗控制器
      this.viewportController = new ViewportController(app, this.stateManager);
      // 渲染应用
      if (!this.autoStart) {
        this.pixiApp.render();
      }
      // 返回工具实例，便于链式调用
      return this;
    } catch (error) {
      console.error('PixiJS工具初始化失败:', error);
      throw error;
    }
  }

  /**
 * 静态方法：获取工具版本信息
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

/**
 * 工厂函数：创建并初始化 PixiTool 实例
 * 步骤：
 * 1. 初始化核心应用（PixiApplication）
 * 2. 初始化状态管理器（StateManager）
 * 3. 初始化工厂渲染器（FactoryRenderer），并将工厂对象添加到舞台
 * 4. 初始化视窗控制器（ViewportController）
 *
 * @param {string} containerId - PixiJS 容器ID
 * @param {boolean} autoStart - 是否自动启动渲染
 * @returns {Promise<PixiTool>} - 初始化完成的 PixiTool 实例
 */
export async function createPixiTool(containerId = 'pixi-container', autoStart = false) {
  // 1. 初始化核心应用
  const pixiApp = new PixiApplication(containerId, autoStart);
  const app = await pixiApp.init();
  // 2. 初始化状态管理器
  const stateManager = new StateManager();
  // 3. 初始化工厂渲染器，并添加到舞台
  const graphicsFactory = new FactoryRenderer(app);
  const factory = graphicsFactory.create();
  app.stage.addChild(factory);
  // 渲染应用
  if (!autoStart) {
    pixiApp.render();
  }
  // 4. 初始化视窗控制器
  const viewportController = new ViewportController(app, stateManager);
  // 组装 PixiTool 实例
  return new PixiTool({
    pixiApp,
    stateManager,
    graphicsFactory,
    viewportController,
    containerId,
    autoStart
  });
}

// 3. 自动初始化部分调用工厂函数
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
      const pixiTool = await createPixiTool();
      // 将实例暴露到全局，便于调试和外部访问
      window.pixiTool = pixiTool;
      console.log('工具已挂载到 window.pixiTool，您可以在控制台中使用它');
      
      // 添加重置视窗按钮的事件监听器
      const resetBtn = document.getElementById('viewport-reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          pixiTool.viewportController.reset();
          if (!pixiTool.pixiApp.autoStart) {
            pixiTool.pixiApp.render();
          }
        });
        console.log('重置视窗按钮事件监听器已添加');
      } else {
        console.warn('未找到重置视窗按钮元素');
      }
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