/**
 * FileName: dialogPosition.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 弹窗定位与连接线计算。由源项目 CSS-Web MapTemplate.vue 的
 *              CLICK_CONFIG（628–646）、adjustDialogAndLine（1772–1814）、
 *              calculateDialogPosition（901–942）、getDialogYOffset（1837–1854）
 *              移植。差异：
 *              - document.getElementById("dialog") → getDialogDom 回调注入
 *                （调用方传 dialogRef.value，禁止全局 ID 查找——多实例冲突，
 *                移植计划 §8 MEDIUM）
 *              - ConfigParams（源项目路由级配置）本项目恒为 undefined，改为
 *                可选参数传入，分支逻辑保留走默认值（移植计划 §7）
 *              - 魔法数（含模板层 1125/-70/175 偏移）统一集中 CLICK_CONFIG
 * Version: 1.0.0
 */
import { nextTick } from "vue";

/**
 * 点击事件与弹窗定位相关配置（源 CLICK_CONFIG 平移 + 模板层魔法数集中）
 */
export const CLICK_CONFIG = {
  /** 高亮边框样式 */
  BORDER_STYLE: {
    NORMAL: { width: 1, color: 0x30ffff }, // 普通边框样式
    HIGHLIGHT: { width: 2, color: 0x30ffff }, // 高亮边框样式
  },
  /** 弹窗偏移配置 */
  DIALOG_OFFSET: {
    DEFAULT_Y: 20,
    LEGEND_STYLE_Y: 100,
    COLUMN_CHART_1_Y: 180,
    COLUMN_CHART_2_Y: 190,
    X_ADJUST: 175,
  },
  /** 连接线调整配置 */
  LINE_ADJUST: {
    DELTA_X: 150,
    DELTA_Y: -50,
  },
  /** 模板层（MapDialog.vue）位置偏移魔法数（源模板 1–214 行硬编码集中） */
  TEMPLATE: {
    LINE_LEFT_BASE: 30, // 连接线 left = lineX - lineLength/2 + 30 - OffsetX
    LINE_TOP_MAP_HEIGHT_BASE: 1125, // 连接线/弹窗 top 基准 = y - (MapHeight - 1125) - OffsetY
    LINE_WIDTH_GAP: 5, // 连接线 width = lineLength - 5
    LINE_HEIGHT: 2, // 连接线高度 2px
    DIALOG_LEFT_ADJUST: 175, // 弹窗 left = DialogX + 175 - OffsetX
    DIALOG_TOP_ADJUST: -70, // 弹窗 top = DialogY - 70 - (MapHeight - 1125) - OffsetY
  },
};

/**
 * 创建弹窗定位实例
 * @param {object} options
 * @param {object} options.DialogData 弹窗状态（reactive，字段
 *   DialogX/DialogY/lineX/lineY/lineLength/lineDeg）
 * @param {Function} [options.getDialogDom] 弹窗 DOM 获取
 *   () => HTMLElement|null（替代源 document.getElementById("dialog")）
 * @returns {object} { adjustDialogAndLine, calculateDialogPosition, getDialogYOffset }
 */
export function createDialogPosition(options = {}) {
  const { DialogData, getDialogDom } = options;

  /**
   * 调整弹窗位置并计算连接线（点击类弹窗用，nextTick 后测量 DOM 尺寸）
   * 移植自源 adjustDialogAndLine（1772–1814）
   * @param {HTMLElement} dom 弹窗 DOM 元素（调用方 nextTick 后传 ref.value）
   * @param {object} globalPoint 点击元素的全局位置 {x, y}
   * @param {object} [config] 配置参数
   * @param {number} [config.xAdjust=0] X 轴附加偏移（ShowColunmChart===1 时 175）
   * @param {number} [config.yOffset=20] Y 轴偏移（getDialogYOffset 计算值）
   * @param {number} [config.lineDeltaX=150] 连接线 X 增量
   * @param {number} [config.lineDeltaY=-50] 连接线 Y 增量
   */
  const adjustDialogAndLine = (dom, globalPoint, config = {}) => {
    const {
      xAdjust = 0,
      yOffset = CLICK_CONFIG.DIALOG_OFFSET.DEFAULT_Y,
      lineDeltaX = CLICK_CONFIG.LINE_ADJUST.DELTA_X,
      lineDeltaY = CLICK_CONFIG.LINE_ADJUST.DELTA_Y,
    } = config;

    // 初始位置计算
    DialogData.DialogX = globalPoint.x + xAdjust;
    DialogData.DialogY = globalPoint.y + yOffset;

    nextTick(() => {
      if (!dom) return;

      // 垂直位置调整（Y 轴溢出上移）
      const restHeight = window.innerHeight - DialogData.DialogY - 100;
      const moveHeight = dom.clientHeight - restHeight;
      let deltaY = lineDeltaY;
      if (restHeight < dom.clientHeight) {
        DialogData.DialogY -= moveHeight;
        deltaY -= moveHeight;
        DialogData.lineY = (DialogData.DialogY * 2 + deltaY) / 2 + moveHeight;
      } else {
        DialogData.lineY = (DialogData.DialogY * 2 + deltaY) / 2;
      }

      // 水平位置调整（X 轴溢出左移）
      const restWidth = window.innerWidth - DialogData.DialogX - 200;
      const moveWidth = dom.clientWidth - restWidth;
      let deltaX = lineDeltaX;
      if (restWidth < dom.clientWidth) {
        DialogData.DialogX -= moveWidth;
        deltaX -= moveWidth;
        DialogData.lineX = (DialogData.DialogX * 2 + deltaX) / 2 + moveWidth;
      } else {
        DialogData.lineX = (DialogData.DialogX * 2 + deltaX) / 2;
      }

      // 连接线角度和长度计算
      const angle = (360 * Math.atan2(deltaY, deltaX)) / (2 * Math.PI);
      DialogData.lineLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      DialogData.lineDeg = angle <= -90 ? 360 + angle : angle;
    });
  };

  /**
   * 计算弹窗位置和连接线（场地 hover 弹窗用，同步测量，DOM 经 getDialogDom 注入）
   * 移植自源 calculateDialogPosition（901–942）
   * @param {object} clickPoint 点击坐标 {x, y}
   */
  const calculateDialogPosition = (clickPoint) => {
    const dom = getDialogDom?.() || null;

    if (clickPoint) {
      DialogData.DialogX = clickPoint.x;
      DialogData.DialogY = clickPoint.y;
    }

    if (dom) {
      // 处理 Y 轴溢出（-50 与 LINE_ADJUST.DELTA_Y 一致，源码此处硬编码）
      const restHeight = window.innerHeight - DialogData.DialogY - 100;
      const moveHeight = dom.clientHeight - restHeight;
      let deltaY;
      if (restHeight < dom.clientHeight) {
        DialogData.DialogY -= moveHeight;
        deltaY = CLICK_CONFIG.LINE_ADJUST.DELTA_Y - moveHeight;
        DialogData.lineY = (DialogData.DialogY * 2 + deltaY) / 2 + moveHeight;
      } else {
        deltaY = CLICK_CONFIG.LINE_ADJUST.DELTA_Y;
        DialogData.lineY = (DialogData.DialogY * 2 + deltaY) / 2;
      }

      // 处理 X 轴溢出（150 与 LINE_ADJUST.DELTA_X 一致，源码此处硬编码）
      const restWidth = window.innerWidth - DialogData.DialogX - 200;
      const moveWidth = dom.clientWidth - restWidth;
      let deltaX;
      if (restWidth < dom.clientWidth) {
        DialogData.DialogX -= moveWidth;
        deltaX = CLICK_CONFIG.LINE_ADJUST.DELTA_X - moveWidth;
        DialogData.lineX = (DialogData.DialogX * 2 + deltaX) / 2 + moveWidth;
      } else {
        deltaX = CLICK_CONFIG.LINE_ADJUST.DELTA_X;
        DialogData.lineX = (DialogData.DialogX * 2 + deltaX) / 2;
      }

      // 计算角度
      const angle = (360 * Math.atan2(deltaY, deltaX)) / (2 * Math.PI);
      DialogData.lineLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      DialogData.lineDeg = angle <= -90 ? 360 + angle : angle;
    }
  };

  /**
   * 获取弹窗 Y 轴偏移量（依据 ConfigParams 动态计算，未配置时 0）
   * 移植自源 getDialogYOffset（1837–1854）
   * @param {object} [configParams] 路由级配置（本项目恒 undefined，走默认值）
   * @returns {number} Y 轴偏移量
   */
  const getDialogYOffset = (configParams) => {
    if (configParams?.ShowColunmChart === 3) {
      return CLICK_CONFIG.DIALOG_OFFSET.DEFAULT_Y;
    }

    if (configParams?.LegendStyle === 1) {
      return CLICK_CONFIG.DIALOG_OFFSET.LEGEND_STYLE_Y;
    }

    switch (configParams?.ShowColunmChart) {
      case 1:
        return CLICK_CONFIG.DIALOG_OFFSET.COLUMN_CHART_1_Y;
      case 2:
        return CLICK_CONFIG.DIALOG_OFFSET.COLUMN_CHART_2_Y;
      default:
        return 0;
    }
  };

  return {
    adjustDialogAndLine,
    calculateDialogPosition,
    getDialogYOffset,
  };
}

export default createDialogPosition;
