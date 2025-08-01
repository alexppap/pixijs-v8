/**
 * UI控制器
 * 负责管理所有UI交互和业务逻辑的协调
 */

import { BUTTON_CONFIG, GRAPHICS_CONFIG } from '../utils/constants.js';

export class UIController {
  constructor(app, stateManager, graphicsFactory, animationController, viewportController) {
    this.app = app;
    this.stateManager = stateManager;
    this.graphicsFactory = graphicsFactory;
    this.animationController = animationController;
    this.viewportController = viewportController;
    
    // 设置UI事件监听器
    this.setupUIEventListeners();
    
    // 订阅状态变化
    this.subscribeToStateChanges();
    
    // 设置窗口大小调整监听
    this.setupResizeListener();
  }

  /**
   * 设置UI事件监听器
   */
  setupUIEventListeners() {
    // 创建厂区按钮
    document.getElementById('create-factory-btn')?.addEventListener('click', () => {
      this.toggleFactory();
    });

    // 旋转按钮
    document.getElementById('rotate-btn')?.addEventListener('click', () => {
      this.toggleRotation();
    });

    // 改变颜色按钮
    document.getElementById('color-btn')?.addEventListener('click', () => {
      this.changeColor();
    });

    // 确认中心按钮
    document.getElementById('center-btn')?.addEventListener('click', () => {
      this.toggleCenter();
    });

    // 厂区几何中心按钮
    document.getElementById('factory-center-btn')?.addEventListener('click', () => {
      this.toggleFactoryCenterType();
    });

    // 放大按钮
    document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
      this.viewportController.zoomIn();
    });

    // 缩小按钮
    document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
      this.viewportController.zoomOut();
    });

    // 重置视窗按钮
    document.getElementById('viewport-reset-btn')?.addEventListener('click', () => {
      this.viewportController.reset();
    });

    // 重置按钮
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      this.reset();
    });
  }

  /**
   * 订阅状态变化
   */
  subscribeToStateChanges() {
    this.stateManager.subscribe((newState, oldState) => {
      // 更新按钮状态
      this.updateButtonStates(newState);
      
      // 处理图形变化
      if (newState.currentShape !== oldState.currentShape) {
        this.handleShapeChange(newState);
      }
    });
  }

  /**
   * 设置窗口大小调整监听
   */
  setupResizeListener() {
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  /**
   * 初始化默认场景
   */
  initializeDefaultScene() {
    // 创建默认多边形
    const polygon = this.graphicsFactory.createPolygon();
    this.graphicsFactory.addToStage(polygon);
    
    // 设置当前图形状态
    this.stateManager.setCurrentShape('polygon', polygon);
    
    console.log('默认场景初始化完成');
  }

  /**
   * 切换厂区和原多边形显示
   */
  toggleFactory() {
    const state = this.stateManager.getState();
    const btn = document.getElementById('create-factory-btn');
    
    if (state.currentShape === 'factory') {
      // 切换到多边形
      this.switchToPolygon();
      btn.textContent = BUTTON_CONFIG.POLYGON_CREATE_TEXT;
    } else {
      // 切换到厂区
      this.switchToFactory();
      btn.textContent = BUTTON_CONFIG.FACTORY_SHOW_POLYGON_TEXT;
    }
    
    // 重置状态（但不重新创建）
    this.reset(false);
  }

  /**
   * 切换到多边形显示
   */
  switchToPolygon() {
    const state = this.stateManager.getState();
    
    // 移除厂区
    if (state.currentGraphic) {
      this.graphicsFactory.removeFromStage(state.currentGraphic);
    }
    
    // 创建或显示多边形
    let polygon = null;
    if (state.currentShape === 'polygon' && state.currentGraphic) {
      polygon = state.currentGraphic;
      this.graphicsFactory.addToStage(polygon);
    } else {
      polygon = this.graphicsFactory.createPolygon();
      this.graphicsFactory.addToStage(polygon);
    }
    
    // 更新状态
    this.stateManager.setCurrentShape('polygon', polygon);
    this.stateManager.set('pbsGraphics', []);
    
    // 更新按钮可见性
    this.updateButtonVisibility('polygon');
    
    console.log('已切换到原多边形');
  }

  /**
   * 切换到厂区显示
   */
  switchToFactory() {
    const state = this.stateManager.getState();
    
    // 移除多边形
    if (state.currentGraphic) {
      this.graphicsFactory.removeFromStage(state.currentGraphic);
    }
    
    // 创建厂区
    const factory = this.graphicsFactory.createFactory();
    this.graphicsFactory.addToStage(factory);
    
    // 更新状态
    this.stateManager.setCurrentShape('factory', factory);
    
    // 更新按钮可见性
    this.updateButtonVisibility('factory');
    
    console.log('已创建厂区');
  }

  /**
   * 更新按钮可见性
   * @param {string} shapeType - 图形类型
   */
  updateButtonVisibility(shapeType) {
    const centerBtn = document.getElementById('center-btn');
    const factoryCenterBtn = document.getElementById('factory-center-btn');
    const colorBtn = document.getElementById('color-btn');
    
    if (shapeType === 'factory') {
      centerBtn.style.display = 'none';
      factoryCenterBtn.style.display = 'inline-block';
      colorBtn.style.display = 'none';
    } else {
      centerBtn.style.display = 'inline-block';
      factoryCenterBtn.style.display = 'none';
      colorBtn.style.display = 'inline-block';
    }
  }

  /**
   * 切换旋转状态
   */
  toggleRotation() {
    this.animationController.toggleRotation();
  }

  /**
   * 改变颜色
   * @param {boolean} reset - 是否重置到第一个颜色
   */
  changeColor(reset = false) {
    const state = this.stateManager.getState();
    if (state.currentShape !== 'polygon' || !state.currentGraphic) return;

    if (reset) {
      this.stateManager.resetColor();
    } else {
      this.stateManager.nextColor();
    }
    
    const newState = this.stateManager.getState();
    this.graphicsFactory.updatePolygonColor(
      newState.currentGraphic, 
      newState.polygonPoints, 
      newState.currentColor
    );
  }

  /**
   * 切换中心点显示
   */
  toggleCenter() {
    const state = this.stateManager.getState();
    
    if (state.showingCenter) {
      this.hideCenter();
    } else {
      this.showCenter();
    }
  }

  /**
   * 显示中心点
   */
  showCenter() {
    const state = this.stateManager.getState();
    const targetGraphic = state.currentGraphic;
    const targetPoints = state.currentShape === 'factory' 
      ? state.factoryPoints 
      : state.polygonPoints;

    if (!targetGraphic || !targetPoints) return;

    // 创建中心点
    const { centerDot, center } = this.graphicsFactory.createCenterDot(targetPoints, 'mass');
    
    // 设置中心点位置
    centerDot.x = targetGraphic.x;
    centerDot.y = targetGraphic.y;
    
    // 添加到舞台
    this.app.stage.addChild(centerDot);
    
    // 更新状态
    this.stateManager.setCenterDot(true, centerDot);
    
    const graphicType = state.currentShape === 'factory' ? '厂区' : '多边形';
    console.log(`${graphicType}中心点位置: (${center.x.toFixed(2)}, ${center.y.toFixed(2)})`);
  }

  /**
   * 隐藏中心点
   */
  hideCenter() {
    const state = this.stateManager.getState();
    if (state.centerDot) {
      this.app.stage.removeChild(state.centerDot);
      this.stateManager.setCenterDot(false, null);
    }
  }

  /**
   * 切换厂区中心类型
   */
  toggleFactoryCenterType() {
    const state = this.stateManager.getState();
    if (state.currentShape !== 'factory') return;

    if (state.showingGeometricCenter) {
      this.hideFactoryGeometricCenter();
      console.log('隐藏厂区几何中心标记');
    } else {
      this.showFactoryGeometricCenter();
      console.log('显示厂区几何中心标记');
    }
  }

  /**
   * 显示厂区几何中心点
   */
  showFactoryGeometricCenter() {
    const state = this.stateManager.getState();
    if (state.currentShape !== 'factory' || !state.factoryPoints) {
      console.log('当前不是厂区模式，无法显示厂区几何中心');
      return;
    }

    // 隐藏现有的几何中心点
    this.hideFactoryGeometricCenter();
    
    // 创建几何中心点
    const { centerDot, center } = this.graphicsFactory.createCenterDot(
      state.factoryPoints, 
      'geometric',
      { fillColor: 0x00ff00 } // 绿色以区分
    );
    
    // 设置位置
    centerDot.x = state.currentGraphic.x;
    centerDot.y = state.currentGraphic.y;
    
    // 添加到舞台
    this.app.stage.addChild(centerDot);
    
    // 更新状态
    this.stateManager.setGeometricCenterDot(true, centerDot);
    
    console.log(`厂区几何中心: (${center.x.toFixed(2)}, ${center.y.toFixed(2)})`);
  }

  /**
   * 隐藏厂区几何中心点
   */
  hideFactoryGeometricCenter() {
    const state = this.stateManager.getState();
    if (state.geometricCenterDot) {
      this.app.stage.removeChild(state.geometricCenterDot);
      this.stateManager.setGeometricCenterDot(false, null);
    }
  }

  /**
   * 重置所有状态
   * @param {boolean} recreate - 是否重新创建图形
   */
  reset(recreate = true) {
    const state = this.stateManager.getState();
    const targetGraphic = state.currentGraphic;
    
    if (!targetGraphic) return;
    
    // 隐藏中心点
    this.hideCenter();
    this.hideFactoryGeometricCenter();
    
    // 停止动画
    this.animationController.stopAll();
    
    if (state.currentShape === 'factory' && recreate) {
      // 重新创建厂区
      this.graphicsFactory.removeFromStage(targetGraphic);
      const newFactory = this.graphicsFactory.createFactory();
      this.graphicsFactory.addToStage(newFactory);
      this.stateManager.setCurrentShape('factory', newFactory);
    } else if (state.currentShape === 'polygon') {
      // 重置多边形
      this.graphicsFactory.resetGraphic(
        targetGraphic, 
        'polygon', 
        state.polygonPoints, 
        0xff0000
      );
      this.stateManager.resetColor();
    } else if (state.currentShape === 'factory') {
      // 重置厂区位置
      this.graphicsFactory.resetGraphic(targetGraphic, 'factory');
    }
    
    // 重置按钮文本
    const rotateBtn = document.getElementById('rotate-btn');
    if (rotateBtn) {
      rotateBtn.textContent = BUTTON_CONFIG.ROTATION_START_TEXT;
    }
    
    // 重置视窗
    this.viewportController.reset();
    
    console.log('重置完成');
  }

  /**
   * 处理窗口大小调整
   */
  handleResize() {
    const newSize = this.app.handleResize();
    if (!newSize) return;
    
    const state = this.stateManager.getState();
    const targetGraphic = state.currentGraphic;
    
    if (targetGraphic) {
      if (state.currentShape === 'factory') {
        // 对于厂区，重新应用缩放和居中
        this.graphicsFactory.scaleAndCenterGraphic(targetGraphic, 'factory');
      } else if (state.currentShape === 'polygon') {
        // 对于原多边形，简单居中
        targetGraphic.x = newSize.width / 2;
        targetGraphic.y = newSize.height / 2;
      }
      
      // 更新中心点位置
      if (state.centerDot) {
        state.centerDot.x = targetGraphic.x;
        state.centerDot.y = targetGraphic.y;
      }
      
      if (state.geometricCenterDot) {
        state.geometricCenterDot.x = targetGraphic.x;
        state.geometricCenterDot.y = targetGraphic.y;
      }
    }
  }

  /**
   * 更新按钮状态
   * @param {Object} state - 当前状态
   */
  updateButtonStates(state) {
    const rotateBtn = document.getElementById('rotate-btn');
    if (rotateBtn) {
      rotateBtn.textContent = state.isRotating 
        ? BUTTON_CONFIG.ROTATION_STOP_TEXT 
        : BUTTON_CONFIG.ROTATION_START_TEXT;
    }
  }

  /**
   * 处理图形变化
   * @param {Object} state - 当前状态
   */
  handleShapeChange(state) {
    // 可以在这里添加图形切换时的特殊逻辑
    console.log(`图形已切换到: ${state.currentShape}`);
  }

  /**
   * 获取当前状态信息
   */
  getStatusInfo() {
    const state = this.stateManager.getState();
    return {
      currentShape: state.currentShape,
      isRotating: state.isRotating,
      currentColor: state.currentColor,
      showingCenter: state.showingCenter,
      showingGeometricCenter: state.showingGeometricCenter,
      viewport: state.viewport
    };
  }
} 