/**
 * 常量配置文件
 * 包含应用中使用的所有常量和配置项
 */

// 颜色配置
export const COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];

// 视窗控制配置
export const VIEWPORT_CONFIG = {
  MIN_SCALE: 0.1,
  MAX_SCALE: 5,
  DEFAULT_SCALE: 1,
  ZOOM_IN_FACTOR: 1.2,
  ZOOM_OUT_FACTOR: 0.8,
  WHEEL_ZOOM_IN_FACTOR: 1.1,
  WHEEL_ZOOM_OUT_FACTOR: 0.9
};

// 动画配置
export const ANIMATION_CONFIG = {
  DEFAULT_ROTATION_SPEED: 0.05,
  BOUNCE_DURATION: 300,
  BOUNCE_SCALE: 1.2
};

// 图形配置
export const GRAPHICS_CONFIG = {
  // 默认多边形顶点
  DEFAULT_POLYGON_POINTS: [
    { x: 50, y: 10 },   // 顶部
    { x: 90, y: 30 },   // 右上
    { x: 80, y: 70 },   // 右下
    { x: 40, y: 90 },   // 底部
    { x: 10, y: 60 },   // 左下
    { x: 20, y: 20 }    // 左上
  ],
  
  // 厂区形状顶点
  FACTORY_POINTS: [
    { x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 100 }, { x: 120, y: 100 },
    { x: 120, y: 150 }, { x: 180, y: 150 }, { x: 180, y: 170 }, { x: 50, y: 170 },
    { x: 50, y: 150 }, { x: 20, y: 150 }, { x: 20, y: 100 }, { x: 10, y: 100 },
    { x: 10, y: 30 }, { x: 60, y: 30 }, { x: 60, y: 50 }, { x: 165, y: 20 },
    { x: 185, y: 20 }, { x: 185, y: 70 }, { x: 165, y: 70 }
  ],
  
  // PBS单元配置
  PBS_DATA: [
    { x: 100, y: 100, color: 0x00ff00, shape: 'circle', size: 5 },
    { x: 20, y: 70, color: 0xffff00, shape: 'rect', size: 8 },
    { x: 120, y: 130, color: 0x00ffff, shape: 'circle', size: 6 },
    { x: 175, y: 60, color: 0xff00ff, shape: 'rect', size: 7 }
  ],
  
  // 中心点配置
  CENTER_DOT_RADIUS: 8,
  STROKE_WIDTH: 2,
  SCALE_FACTOR: 1.5,
  CONTAINER_SCALE_RATIO: 0.9
};

// 应用配置
export const APP_CONFIG = {
  DEFAULT_BACKGROUND_COLOR: 0x1099bb,
  ANTIALIAS: true,
  TOUCH_ACTION: 'none',
  CURSOR_GRAB: 'grab',
  CURSOR_GRABBING: 'grabbing',
  CURSOR_POINTER: 'pointer'
};

// 按钮配置
export const BUTTON_CONFIG = {
  FACTORY_CREATE_TEXT: '创建厂区',
  FACTORY_SHOW_POLYGON_TEXT: '显示多边形',
  POLYGON_CREATE_TEXT: '显示厂区',
  ROTATION_START_TEXT: '旋转精灵',
  ROTATION_STOP_TEXT: '停止旋转'
}; 