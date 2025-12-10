/**
 * PBS单元渲染器
 * 负责创建和管理PBS单元图形
 */

import { GRAPHICS_CONFIG } from '../utils/constants.js';

export class PBSRenderer {
  constructor(app) {
    this.app = app;
  }

  /**
   * 创建单个PBS单元
   * @param {Object} pbsData - PBS数据配置
   * @returns {PIXI.Graphics} PBS图形对象
   */
  createUnit(pbsData) {
    const { x, y, color, shape, size, points } = pbsData;

    const pbsGraphic = new PIXI.Graphics();

    // 添加PBS标识属性，用于精准识别
    pbsGraphic.isPBS = true;
    // 保存PBS元数据，便于后续使用
    pbsGraphic.pbsData = { color, shape, size, points };

    // 根据形状类型绘制
    if (shape === 'circle') {
      pbsGraphic.circle(0, 0, size);
    } else if (shape === 'rect') {
      pbsGraphic.rect(-size / 2, -size / 2, size, size);
    } else if (shape === 'polygon' && points) {
      // 绘制多边形
      pbsGraphic.poly(points);
    } else {
      // 默认绘制圆形
      pbsGraphic.circle(0, 0, size);
    }

    // 应用填充色
    pbsGraphic.fill(color);

    // 设置位置
    pbsGraphic.x = x;
    pbsGraphic.y = y;

    return pbsGraphic;
  }

  /**
   * 创建所有PBS单元
   * @param {Array} pbsDataArray - PBS数据数组，可选，默认使用配置中的数据
   * @returns {Array} PBS图形对象数组
   */
  createUnits(pbsDataArray = GRAPHICS_CONFIG.PBS_DATA) {
    const pbsGraphics = [];
    
    pbsDataArray.forEach(pbsData => {
      const pbsUnit = this.createUnit(pbsData);
      pbsGraphics.push(pbsUnit);
    });
    
    console.log(`创建了 ${pbsGraphics.length} 个PBS单元`);
    return pbsGraphics;
  }

  /**
   * 将PBS单元添加到父容器
   * @param {PIXI.Container} parentContainer - 父容器
   * @param {Array} pbsGraphics - PBS图形数组
   */
  addToContainer(parentContainer, pbsGraphics) {
    if (!parentContainer || !pbsGraphics) return;
    
    pbsGraphics.forEach(pbsUnit => {
      parentContainer.addChild(pbsUnit);
    });
  }

  /**
   * 从父容器移除PBS单元
   * @param {PIXI.Container} parentContainer - 父容器
   * @param {Array} pbsGraphics - PBS图形数组
   */
  removeFromContainer(parentContainer, pbsGraphics) {
    if (!parentContainer || !pbsGraphics) return;
    
    pbsGraphics.forEach(pbsUnit => {
      if (parentContainer.children.includes(pbsUnit)) {
        parentContainer.removeChild(pbsUnit);
      }
    });
  }

  /**
   * 更新PBS单元颜色
   * @param {PIXI.Graphics} pbsUnit - PBS单元
   * @param {number} color - 新颜色
   * @param {Object} originalData - 原始数据，用于重绘
   */
  updateColor(pbsUnit, color, originalData) {
    if (!pbsUnit || !originalData) return;
    
    const { shape, size } = originalData;
    
    // 清除并重绘
    pbsUnit.clear();
    
    if (shape === 'circle') {
      pbsUnit.circle(0, 0, size);
    } else if (shape === 'rect') {
      pbsUnit.rect(-size / 2, -size / 2, size, size);
    } else {
      pbsUnit.circle(0, 0, size);
    }
    
    pbsUnit.fill(color);
  }

  /**
   * 创建自定义PBS配置
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} color - 颜色
   * @param {string} shape - 形状 ('circle' | 'rect' | 'polygon')
   * @param {number} size - 大小
   * @param {Array} points - 多边形顶点坐标数组（仅用于polygon）
   * @returns {Object} PBS配置对象
   */
  createPBSConfig(x, y, color, shape = 'circle', size = 5, points = null) {
    const config = { x, y, color, shape, size };
    if (points) {
      config.points = points;
    }
    return config;
  }

  /**
   * 生成不规则多边形的顶点
   * @param {number} sides - 边数（最少3边）
   * @param {number} radius - 多边形半径
   * @param {number} irregularity - 不规则程度 (0-1)，0为规则多边形，1为完全不规则
   * @param {number} spikiness - 尖刺程度 (0-1)，控制顶点距离中心的变化
   * @returns {Array} 顶点坐标数组 [{x, y}, ...]
   */
  generateIrregularPolygon(sides = 6, radius = 10, irregularity = 0.3, spikiness = 0.2) {
    if (sides < 3) sides = 3;

    irregularity = Math.max(0, Math.min(1, irregularity)); // 限制在0-1之间
    spikiness = Math.max(0, Math.min(1, spikiness));

    const angleSteps = [];
    const lower = (2 * Math.PI / sides) - irregularity * (2 * Math.PI / sides);
    const upper = (2 * Math.PI / sides) + irregularity * (2 * Math.PI / sides);
    let sum = 0;

    // 生成不规则的角度步长
    for (let i = 0; i < sides; i++) {
      const angle = lower + Math.random() * (upper - lower);
      angleSteps.push(angle);
      sum += angle;
    }

    // 归一化角度，使总和为2π
    const k = sum / (2 * Math.PI);
    for (let i = 0; i < sides; i++) {
      angleSteps[i] = angleSteps[i] / k;
    }

    // 生成顶点坐标
    const points = [];
    let angle = Math.random() * 2 * Math.PI; // 随机起始角度

    for (let i = 0; i < sides; i++) {
      // 添加随机半径变化
      const radiusVariation = 1 + (Math.random() * 2 - 1) * spikiness;
      const r = radius * radiusVariation;

      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);

      points.push({ x, y });

      angle += angleSteps[i];
    }

    return points;
  }

  /**
   * 批量创建PBS单元在指定区域
   * @param {Object} area - 区域配置 {x, y, width, height}
   * @param {number} count - 数量
   * @param {Object} options - 选项配置
   * @returns {Array} PBS图形数组
   */
  createUnitsInArea(area, count, options = {}) {
    const {
      minSize = 3,
      maxSize = 8,
      colors = [0x00ff00, 0xffff00, 0x00ffff, 0xff00ff],
      shapes = ['circle', 'rect', 'polygon']
    } = options;

    const pbsUnits = [];

    for (let i = 0; i < count; i++) {
      // 随机位置
      const x = area.x + Math.random() * area.width;
      const y = area.y + Math.random() * area.height;

      // 随机属性
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const size = minSize + Math.random() * (maxSize - minSize);

      let pbsConfig;

      // 如果是多边形，生成不规则多边形顶点
      if (shape === 'polygon') {
        const sides = 3 + Math.floor(Math.random() * 5); // 3-7边
        const irregularity = 0.2 + Math.random() * 0.4; // 0.2-0.6
        const spikiness = 0.1 + Math.random() * 0.3; // 0.1-0.4
        const points = this.generateIrregularPolygon(sides, size, irregularity, spikiness);
        pbsConfig = this.createPBSConfig(x, y, color, shape, size, points);
      } else {
        pbsConfig = this.createPBSConfig(x, y, color, shape, size);
      }

      const pbsUnit = this.createUnit(pbsConfig);
      pbsUnits.push(pbsUnit);
    }

    // 添加一个特定的不规则多边形示例（五角星形状）
    const starX = area.x + area.width / 2;
    const starY = area.y + area.height / 2;
    const starColor = 0xff6600; // 橙色
    const starPoints = this.generateIrregularPolygon(5, 15, 0.5, 0.6);
    const starConfig = this.createPBSConfig(starX, starY, starColor, 'polygon', 15, starPoints);
    const starUnit = this.createUnit(starConfig);
    pbsUnits.push(starUnit);

    return pbsUnits;
  }
} 