/**
 * 状态管理器
 * 负责应用状态的管理和通知机制
 */

import { COLORS, GRAPHICS_CONFIG } from '../utils/constants.js';

export class StateManager {
  constructor() {
    this.state = {
      // 图形状态
      currentShape: null,        // 当前显示的图形 ('polygon' | 'factory')
      currentGraphic: null,      // 当前的图形对象
      
      // 动画状态
      isRotating: false,
      
      // 颜色状态
      currentColor: COLORS[0],
      colorIndex: 0,
      
      // 中心点状态
      showingCenter: false,
      showingGeometricCenter: false,
      centerDot: null,
      geometricCenterDot: null,
      
      // 图形数据
      polygonPoints: [...GRAPHICS_CONFIG.DEFAULT_POLYGON_POINTS],
      factoryPoints: [...GRAPHICS_CONFIG.FACTORY_POINTS],
      pbsGraphics: [],
      
      // 视窗状态
      viewport: {
        x: 0,
        y: 0,
        scale: 1
      },
      
      // 交互状态
      isDragging: false,
      lastPointerPosition: { x: 0, y: 0 },

      // PBS移动状态
      pbsMoveable: false,
      draggingPBS: null
    };
    
    this.subscribers = [];
  }

  /**
   * 设置状态
   * @param {Object} newState - 新状态对象
   */
  setState(newState) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };
    this.notifySubscribers(this.state, oldState);
  }

  /**
   * 获取状态
   * @returns {Object} 当前状态
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 获取特定状态项
   * @param {string} key - 状态键名
   * @returns {*} 状态值
   */
  get(key) {
    return this.state[key];
  }

  /**
   * 设置特定状态项
   * @param {string} key - 状态键名
   * @param {*} value - 状态值
   */
  set(key, value) {
    this.setState({ [key]: value });
  }

  /**
   * 订阅状态变化
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * 通知所有订阅者
   * @param {Object} newState - 新状态
   * @param {Object} oldState - 旧状态
   */
  notifySubscribers(newState, oldState) {
    this.subscribers.forEach(callback => {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('状态订阅者回调错误:', error);
      }
    });
  }

  /**
   * 切换旋转状态
   */
  toggleRotation() {
    this.setState({ isRotating: !this.state.isRotating });
  }

  /**
   * 切换到下一个颜色
   */
  nextColor() {
    const nextIndex = (this.state.colorIndex + 1) % COLORS.length;
    this.setState({
      colorIndex: nextIndex,
      currentColor: COLORS[nextIndex]
    });
  }

  /**
   * 重置颜色到第一个
   */
  resetColor() {
    this.setState({
      colorIndex: 0,
      currentColor: COLORS[0]
    });
  }

  /**
   * 设置当前图形
   * @param {string} shapeType - 图形类型 ('polygon' | 'factory')
   * @param {PIXI.Graphics} graphic - 图形对象
   */
  setCurrentShape(shapeType, graphic) {
    this.setState({
      currentShape: shapeType,
      currentGraphic: graphic
    });
  }

  /**
   * 设置中心点状态
   * @param {boolean} showing - 是否显示
   * @param {PIXI.Sprite} dot - 中心点精灵
   */
  setCenterDot(showing, dot = null) {
    this.setState({
      showingCenter: showing,
      centerDot: dot
    });
  }

  /**
   * 设置几何中心点状态
   * @param {boolean} showing - 是否显示
   * @param {PIXI.Sprite} dot - 几何中心点精灵
   */
  setGeometricCenterDot(showing, dot = null) {
    this.setState({
      showingGeometricCenter: showing,
      geometricCenterDot: dot
    });
  }

  /**
   * 更新视窗状态
   * @param {Object} viewport - 视窗状态
   */
  updateViewport(viewport) {
    this.setState({
      viewport: { ...this.state.viewport, ...viewport }
    });
  }

  /**
   * 设置拖拽状态
   * @param {boolean} isDragging - 是否正在拖拽
   * @param {Object} position - 指针位置
   */
  setDragging(isDragging, position = null) {
    const newState = { isDragging };
    if (position) {
      newState.lastPointerPosition = position;
    }
    this.setState(newState);
  }

  /**
   * 切换PBS可移动状态
   * @returns {boolean} 新的PBS可移动状态
   */
  togglePBSMoveable() {
    const newState = !this.state.pbsMoveable;
    this.setState({ pbsMoveable: newState });
    console.log(`PBS移动模式: ${newState ? '已启用' : '已禁用'}`);
    return newState;
  }

  /**
   * 设置正在拖拽的PBS单元
   * @param {PIXI.Graphics} pbsUnit - PBS单元对象
   */
  setDraggingPBS(pbsUnit) {
    this.setState({ draggingPBS: pbsUnit });
  }

  /**
   * 重置所有状态
   */
  reset() {
    this.setState({
      currentShape: null,
      currentGraphic: null,
      isRotating: false,
      currentColor: COLORS[0],
      colorIndex: 0,
      showingCenter: false,
      showingGeometricCenter: false,
      centerDot: null,
      geometricCenterDot: null,
      pbsGraphics: [],
      viewport: { x: 0, y: 0, scale: 1 },
      isDragging: false,
      lastPointerPosition: { x: 0, y: 0 },
      pbsMoveable: false,
      draggingPBS: null
    });
  }
} 