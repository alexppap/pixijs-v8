/**
 * 厂区渲染器
 * 负责创建和管理厂区图形
 */

import { calculateGeometricCenter } from '../utils/geometry.js';
import { GRAPHICS_CONFIG, APP_CONFIG } from '../utils/constants.js';
import { PBSRenderer } from './PBSRenderer.js';

export class FactoryRenderer {
  constructor(app) {
    this.app = app;
    this.pbsRenderer = new PBSRenderer(app);
  }

  /**
   * 创建厂区图形
   * @param {Object} options - 配置选项
   * @returns {PIXI.Graphics} 厂区图形对象
   */
  create(options = {}) {
    const {
      points = GRAPHICS_CONFIG.FACTORY_POINTS,
      color = 0x8B4513,
      strokeWidth = GRAPHICS_CONFIG.STROKE_WIDTH,
      strokeColor = 0x000000,
      includePBS = true,
      position = null
    } = options;

    // 计算厂区几何中心（使用几何中心作为旋转点）
    const factoryCenter = calculateGeometricCenter(points);
    
    // 创建厂区图形容器
    const factory = new PIXI.Graphics();
    
    // 绘制厂区形状
    this.drawFactory(factory, points, color, strokeWidth, strokeColor);
    
    // 设置旋转中心点为几何中心
    factory.pivot.set(factoryCenter.x, factoryCenter.y);
    
    // 使图形可交互
    factory.eventMode = 'static';
    factory.cursor = APP_CONFIG.CURSOR_POINTER;
    
    // 创建并添加PBS单元
    if (includePBS) {
      const pbsUnits = this.pbsRenderer.createUnits();
      this.pbsRenderer.addToContainer(factory, pbsUnits);
    }
    
    // 缩放和居中
    this.scaleAndCenter(factory);
    
    // 设置位置
    if (position) {
      factory.x = position.x;
      factory.y = position.y;
    }

    console.log(`厂区创建完成，几何中心: (${factoryCenter.x.toFixed(2)}, ${factoryCenter.y.toFixed(2)})`);
    
    return factory;
  }

  /**
   * 绘制厂区形状
   * @param {PIXI.Graphics} graphics - 图形对象
   * @param {Array} points - 厂区顶点数组
   * @param {number} fillColor - 填充颜色
   * @param {number} strokeWidth - 描边宽度
   * @param {number} strokeColor - 描边颜色
   */
  drawFactory(graphics, points, fillColor, strokeWidth, strokeColor) {
    if (!points || points.length < 3) {
      console.error('厂区至少需要3个顶点');
      return;
    }

    // 清除之前的绘制
    graphics.clear();
    
    // 绘制主厂区轮廓
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    
    // 应用填充色
    graphics.fill(fillColor);
    
    // 应用边框
    if (strokeWidth > 0) {
      graphics.stroke({ width: strokeWidth, color: strokeColor });
    }
    
    // 绘制厂区内部细节（办公楼、车间等）
    this.drawFactoryDetails(graphics);
  }

  /**
   * 绘制厂区内部细节
   * @param {PIXI.Graphics} graphics - 图形对象
   */
  drawFactoryDetails(graphics) {
    // 主厂房（深色）
    graphics.rect(70, 60, 60, 30);
    graphics.fill(0x654321);
    graphics.stroke({ width: 1, color: 0x000000 });
    
    // 办公楼（浅色）
    graphics.rect(15, 60, 30, 30);
    graphics.fill(0xD2B48C);
    graphics.stroke({ width: 1, color: 0x000000 });
    
    // 仓库（中等色调）
    graphics.rect(80, 120, 50, 25);
    graphics.fill(0xA0522D);
    graphics.stroke({ width: 1, color: 0x000000 });
    
    // 烟囱（深灰色矩形）
    graphics.rect(170, 20, 10, 50);
    graphics.fill(0x696969);
    graphics.stroke({ width: 1, color: 0x000000 });
  }

  /**
   * 缩放和居中厂区图形
   * @param {PIXI.Graphics} graphic - 厂区图形对象
   * @param {number} containerRatio - 容器比例，默认0.9
   */
  scaleAndCenter(graphic, containerRatio = GRAPHICS_CONFIG.CONTAINER_SCALE_RATIO) {
    if (!graphic || !this.app) return;

    // 获取容器尺寸
    const containerWidth = this.app.screen.width;
    const containerHeight = this.app.screen.height;
    
    // 获取图形的边界框
    const bounds = graphic.getBounds();
    const graphicWidth = bounds.width;
    const graphicHeight = bounds.height;
    
    // 计算缩放比例，使图形适应容器的指定比例大小
    const targetWidth = containerWidth * containerRatio;
    const targetHeight = containerHeight * containerRatio;
    
    const scaleX = targetWidth / graphicWidth;
    const scaleY = targetHeight / graphicHeight;
    
    // 使用较小的缩放比例，保持图形比例
    const scale = Math.min(scaleX, scaleY);
    
    // 应用缩放
    graphic.scale.set(scale);
    
    // 将图形中心移动到容器中心
    graphic.x = containerWidth / 2;
    graphic.y = containerHeight / 2;
    
    console.log(`厂区缩放和居中完成: 缩放比例=${scale.toFixed(3)}, 位置=(${graphic.x}, ${graphic.y})`);
    
    return { scale, x: graphic.x, y: graphic.y };
  }

  /**
   * 重新创建厂区（保持状态）
   * @param {PIXI.Graphics} oldFactory - 旧的厂区对象
   * @param {Object} options - 配置选项
   * @returns {PIXI.Graphics} 新的厂区图形对象
   */
  recreate(oldFactory, options = {}) {
    if (!oldFactory) return this.create(options);

    // 保存当前状态
    const currentRotation = oldFactory.rotation;
    const currentX = oldFactory.x;
    const currentY = oldFactory.y;
    const currentScale = oldFactory.scale.x;

    // 创建新的厂区
    const newFactory = this.create(options);

    // 恢复状态
    newFactory.rotation = currentRotation;
    newFactory.x = currentX;
    newFactory.y = currentY;
    newFactory.scale.set(currentScale);

    return newFactory;
  }

  /**
   * 重置厂区到初始状态
   * @param {PIXI.Graphics} factory - 厂区图形对象
   */
  reset(factory) {
    if (!factory) return;

    // 重置变换
    factory.rotation = 0;
    
    // 重新缩放和居中
    this.scaleAndCenter(factory);
  }

  /**
   * 获取厂区边界信息
   * @param {PIXI.Graphics} factory - 厂区图形对象
   * @returns {Object} 边界信息
   */
  getBounds(factory) {
    if (!factory) return null;
    
    const bounds = factory.getBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2
    };
  }
} 