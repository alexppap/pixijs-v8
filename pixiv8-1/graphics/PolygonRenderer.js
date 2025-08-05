/**
 * 多边形渲染器
 * 负责创建和管理多边形图形
 */

import { calculatePolygonCenter } from '../utils/geometry.js';
import { GRAPHICS_CONFIG, APP_CONFIG } from '../utils/constants.js';

export class PolygonRenderer {
  constructor(app) {
    this.app = app;
  }

  /**
   * 创建多边形图形
   * @param {Array} points - 多边形顶点数组
   * @param {Object} options - 配置选项
   * @returns {PIXI.Graphics} 多边形图形对象
   */
  create(points = GRAPHICS_CONFIG.DEFAULT_POLYGON_POINTS, options = {}) {
    const {
      color = 0xff0000,
      strokeWidth = GRAPHICS_CONFIG.STROKE_WIDTH,
      strokeColor = 0x000000,
      scale = GRAPHICS_CONFIG.SCALE_FACTOR,
      position = null
    } = options;

    // 计算多边形中心点
    const center = calculatePolygonCenter(points);
    
    // 创建多边形图形
    const graphics = new PIXI.Graphics();
    
    // 绘制多边形
    this.drawPolygon(graphics, points, color, strokeWidth, strokeColor);
    
    // 设置旋转和缩放的中心点
    graphics.pivot.set(center.x, center.y);
    
    // 设置位置
    if (position) {
      graphics.x = position.x;
      graphics.y = position.y;
    } else {
      graphics.x = this.app.screen.width / 2;
      graphics.y = this.app.screen.height / 2;
    }
    
    graphics.scale.set(scale);
    
    // 使图形可交互
    graphics.eventMode = 'static';
    graphics.cursor = APP_CONFIG.CURSOR_POINTER;

    return graphics;
  }

  /**
   * 绘制多边形路径
   * @param {PIXI.Graphics} graphics - 图形对象
   * @param {Array} points - 顶点数组
   * @param {number} fillColor - 填充颜色
   * @param {number} strokeWidth - 描边宽度
   * @param {number} strokeColor - 描边颜色
   */
  drawPolygon(graphics, points, fillColor, strokeWidth, strokeColor) {
    if (!points || points.length < 3) {
      console.error('多边形至少需要3个顶点');
      return;
    }

    // 清除之前的绘制
    graphics.clear();
    
    // 开始绘制路径
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
  }

  /**
   * 更新多边形颜色
   * @param {PIXI.Graphics} graphics - 图形对象
   * @param {Array} points - 顶点数组
   * @param {number} color - 新颜色
   * @param {number} strokeWidth - 描边宽度
   * @param {number} strokeColor - 描边颜色
   */
  updateColor(graphics, points, color, strokeWidth = GRAPHICS_CONFIG.STROKE_WIDTH, strokeColor = 0x000000) {
    this.drawPolygon(graphics, points, color, strokeWidth, strokeColor);
  }

  /**
   * 缩放和居中图形
   * @param {PIXI.Graphics} graphic - 图形对象
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
    
    console.log(`多边形缩放和居中完成: 缩放比例=${scale.toFixed(3)}, 位置=(${graphic.x}, ${graphic.y})`);
    
    return { scale, x: graphic.x, y: graphic.y };
  }

  /**
   * 重置多边形到初始状态
   * @param {PIXI.Graphics} graphic - 图形对象
   * @param {Array} points - 顶点数组
   * @param {number} color - 颜色
   */
  reset(graphic, points, color = 0xff0000) {
    if (!graphic) return;

    // 重置变换
    graphic.rotation = 0;
    graphic.x = this.app.screen.width / 2;
    graphic.y = this.app.screen.height / 2;
    graphic.scale.set(GRAPHICS_CONFIG.SCALE_FACTOR);
    
    // 重置颜色
    this.updateColor(graphic, points, color);
  }
} 