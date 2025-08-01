/**
 * 图形工厂
 * 统一管理所有图形渲染器，提供统一的图形创建接口
 */

import { PolygonRenderer } from './PolygonRenderer.js';
import { FactoryRenderer } from './FactoryRenderer.js';
import { PBSRenderer } from './PBSRenderer.js';
import { calculatePolygonCenter, calculateGeometricCenter } from '../utils/geometry.js';
import { GRAPHICS_CONFIG } from '../utils/constants.js';

export class GraphicsFactory {
  constructor(app) {
    this.app = app;
    this.polygonRenderer = new PolygonRenderer(app);
    this.factoryRenderer = new FactoryRenderer(app);
    this.pbsRenderer = new PBSRenderer(app);
  }

  /**
   * 创建多边形
   * @param {Array} points - 顶点数组
   * @param {Object} options - 配置选项
   * @returns {PIXI.Graphics} 多边形图形对象
   */
  createPolygon(points = GRAPHICS_CONFIG.DEFAULT_POLYGON_POINTS, options = {}) {
    return this.polygonRenderer.create(points, options);
  }

  /**
   * 创建厂区
   * @param {Object} options - 配置选项
   * @returns {PIXI.Graphics} 厂区图形对象
   */
  createFactory(options = {}) {
    return this.factoryRenderer.create(options);
  }

  /**
   * 创建PBS单元数组
   * @param {Array} pbsDataArray - PBS数据数组
   * @returns {Array} PBS图形对象数组
   */
  createPBSUnits(pbsDataArray) {
    return this.pbsRenderer.createUnits(pbsDataArray);
  }

  /**
   * 创建中心点标记
   * @param {Array} points - 多边形顶点
   * @param {string} centerType - 中心类型 ('mass' | 'geometric')
   * @param {Object} options - 配置选项
   * @returns {PIXI.Sprite} 中心点精灵
   */
  createCenterDot(points, centerType = 'mass', options = {}) {
    const {
      radius = GRAPHICS_CONFIG.CENTER_DOT_RADIUS,
      fillColor = 0xffffff,
      strokeWidth = GRAPHICS_CONFIG.STROKE_WIDTH,
      strokeColor = 0x000000
    } = options;

    // 计算中心点
    const center = centerType === 'geometric' 
      ? calculateGeometricCenter(points)
      : calculatePolygonCenter(points);
    
    // 创建中心点图形
    const graphics = new PIXI.Graphics();
    graphics.circle(0, 0, radius);
    graphics.fill(fillColor);
    
    if (strokeWidth > 0) {
      graphics.stroke({ width: strokeWidth, color: strokeColor });
    }
    
    // 生成纹理并创建精灵
    const texture = this.app.renderer.generateTexture(graphics);
    const centerDot = new PIXI.Sprite(texture);
    
    // 设置锚点为中心
    centerDot.anchor.set(0.5);
    
    return { centerDot, center };
  }

  /**
   * 更新多边形颜色
   * @param {PIXI.Graphics} polygon - 多边形对象
   * @param {Array} points - 顶点数组
   * @param {number} color - 新颜色
   */
  updatePolygonColor(polygon, points, color) {
    this.polygonRenderer.updateColor(polygon, points, color);
  }

  /**
   * 缩放和居中图形
   * @param {PIXI.Graphics} graphic - 图形对象
   * @param {string} type - 图形类型 ('polygon' | 'factory')
   * @param {number} containerRatio - 容器比例
   */
  scaleAndCenterGraphic(graphic, type = 'polygon', containerRatio) {
    if (type === 'factory') {
      return this.factoryRenderer.scaleAndCenter(graphic, containerRatio);
    } else {
      return this.polygonRenderer.scaleAndCenter(graphic, containerRatio);
    }
  }

  /**
   * 重置图形到初始状态
   * @param {PIXI.Graphics} graphic - 图形对象
   * @param {string} type - 图形类型 ('polygon' | 'factory')
   * @param {Array} points - 顶点数组（仅多边形需要）
   * @param {number} color - 颜色（仅多边形需要）
   */
  resetGraphic(graphic, type = 'polygon', points = null, color = 0xff0000) {
    if (type === 'factory') {
      this.factoryRenderer.reset(graphic);
    } else if (type === 'polygon' && points) {
      this.polygonRenderer.reset(graphic, points, color);
    }
  }

  /**
   * 重新创建厂区（保持状态）
   * @param {PIXI.Graphics} oldFactory - 旧厂区对象
   * @param {Object} options - 配置选项
   * @returns {PIXI.Graphics} 新厂区对象
   */
  recreateFactory(oldFactory, options = {}) {
    return this.factoryRenderer.recreate(oldFactory, options);
  }

  /**
   * 获取图形边界信息
   * @param {PIXI.Graphics} graphic - 图形对象
   * @returns {Object} 边界信息
   */
  getGraphicBounds(graphic) {
    if (!graphic) return null;
    
    const bounds = graphic.getBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2
    };
  }

  /**
   * 添加图形到舞台
   * @param {PIXI.Graphics} graphic - 图形对象
   */
  addToStage(graphic) {
    if (graphic && this.app && this.app.stage) {
      this.app.stage.addChild(graphic);
    }
  }

  /**
   * 从舞台移除图形
   * @param {PIXI.Graphics} graphic - 图形对象
   */
  removeFromStage(graphic) {
    if (graphic && this.app && this.app.stage && this.app.stage.children.includes(graphic)) {
      this.app.stage.removeChild(graphic);
    }
  }

  /**
   * 创建自定义形状
   * @param {Function} drawFunction - 绘制函数
   * @param {Object} options - 配置选项
   * @returns {PIXI.Graphics} 自定义图形对象
   */
  createCustomShape(drawFunction, options = {}) {
    const {
      position = { x: this.app.screen.width / 2, y: this.app.screen.height / 2 },
      scale = 1,
      interactive = true
    } = options;

    const graphics = new PIXI.Graphics();
    
    // 执行自定义绘制函数
    drawFunction(graphics);
    
    // 设置位置和缩放
    graphics.x = position.x;
    graphics.y = position.y;
    graphics.scale.set(scale);
    
    // 设置交互性
    if (interactive) {
      graphics.eventMode = 'static';
      graphics.cursor = 'pointer';
    }
    
    return graphics;
  }

  /**
   * 批量创建图形
   * @param {Array} configs - 图形配置数组
   * @returns {Array} 图形对象数组
   */
  createBatch(configs) {
    const graphics = [];
    
    configs.forEach(config => {
      const { type, ...options } = config;
      
      let graphic = null;
      switch (type) {
        case 'polygon':
          graphic = this.createPolygon(options.points, options);
          break;
        case 'factory':
          graphic = this.createFactory(options);
          break;
        case 'custom':
          graphic = this.createCustomShape(options.drawFunction, options);
          break;
        default:
          console.warn(`未知的图形类型: ${type}`);
      }
      
      if (graphic) {
        graphics.push(graphic);
      }
    });
    
    return graphics;
  }
} 