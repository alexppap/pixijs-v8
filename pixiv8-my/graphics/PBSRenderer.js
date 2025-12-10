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
    const { x, y, color, shape, size } = pbsData;

    const pbsGraphic = new PIXI.Graphics();

    // 添加PBS标识属性，用于精准识别
    pbsGraphic.isPBS = true;
    // 保存PBS元数据，便于后续使用
    pbsGraphic.pbsData = { color, shape, size };

    // 根据形状类型绘制
    if (shape === 'circle') {
      pbsGraphic.circle(0, 0, size);
    } else if (shape === 'rect') {
      pbsGraphic.rect(-size / 2, -size / 2, size, size);
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
   * @param {string} shape - 形状 ('circle' | 'rect')
   * @param {number} size - 大小
   * @returns {Object} PBS配置对象
   */
  createPBSConfig(x, y, color, shape = 'circle', size = 5) {
    return { x, y, color, shape, size };
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
      shapes = ['circle', 'rect']
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
      
      const pbsConfig = this.createPBSConfig(x, y, color, shape, size);
      const pbsUnit = this.createUnit(pbsConfig);
      
      pbsUnits.push(pbsUnit);
    }
    
    return pbsUnits;
  }
} 