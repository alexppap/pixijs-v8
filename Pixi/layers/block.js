/**
 * FileName: block.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 地图总段和预组绘制层。由源项目 CSS-Web public/js/map/block.js
 *              （281 行）移植（v6 → v8）：
 *              - drawTextBackground：lineStyle/beginFill/drawRect/endFill →
 *                rect()/fill()/stroke()（无边框时跳过 stroke，等价源 lineStyle(0)）
 *              - PIXI.Text → 具名导入 Text
 *              - customConfig（源项目路由级配置）本项目恒为 undefined，
 *                FONT_SIZE_MULTIPLIER 走默认值 35（移植计划 §7）
 * Version: 1.0.0
 */
import { Text, Graphics } from "pixi.js";
import {
  rgbaToPixiColor,
  getStringLength,
  drawDashedLines,
} from "../utils/mapUtils";

/**
 * 默认配置常量
 * @constant
 * @type {object}
 * @property {number} FONT_SIZE_MULTIPLIER 字体大小倍率（源 customConfig 缺省值 35）
 * @property {number} SCALE_FACTOR 缩放因子
 * @property {number} BACKGROUND_PADDING 背景填充边距
 * @property {number} BACKGROUND_HEIGHT 背景高度
 * @property {number} FONT_WIDTH_MIN 字体宽度最小值
 * @property {number} FONT_WIDTH_MAX 字体宽度最大值
 */
const DEFAULT_CONFIG = {
  FONT_SIZE_MULTIPLIER: 35,
  SCALE_FACTOR: 0.06,
  BACKGROUND_PADDING: 6,
  BACKGROUND_HEIGHT: 5,
  FONT_WIDTH_MIN: 4,
  FONT_WIDTH_MAX: 10,
};

/**
 * 图层和文本清理工具函数
 * @param {object[]} list 要清理的图层或文本列表
 */
const clearList = (list) => {
  if (Array.isArray(list) && list.length > 0) {
    list.forEach((item) => item.destroy?.());
    list.splice(0, list.length);
  }
};

/**
 * 创建图形图层
 * @param {object[]} layerArray 图层数组引用
 * @param {object} container 地图容器
 * @param {boolean} visible 是否可见
 * @returns {object} 创建的 PIXI.Graphics 图形图层
 */
const createGraphicLayer = (layerArray, container, visible = true) => {
  const graphic = new Graphics();
  graphic.visible = visible;
  layerArray.push(graphic);
  container.addChild(graphic);
  return graphic;
};

/**
 * 计算实际坐标点
 * @param {object} point 原始坐标点 {X, Y}
 * @param {number[]} mapCenterPoints 地图中心点 [x, y]
 * @returns {object} 转换后的实际坐标点 {x, y}
 */
const calculateActualPoint = (point, mapCenterPoints) => ({
  x: point.X - mapCenterPoints[0],
  y: -(point.Y - mapCenterPoints[1]),
});

/**
 * 绘制文本背景（v8：rect/fill/stroke）
 * @param {object} params 绘制参数
 * @param {object} params.graphic 图形绘制对象
 * @param {object} params.centerPoint 中心点坐标
 * @param {object} params.textElement 文本元素
 * @param {string} params.fillColor 填充颜色（rgba 字符串）
 * @param {string} params.borderColor 边框颜色（rgba 字符串）
 * @param {number} params.lineWidth 边框宽度
 * @param {boolean} params.showBorder 是否显示边框
 */
const drawTextBackground = ({
  graphic,
  centerPoint,
  textElement,
  fillColor,
  borderColor,
  lineWidth,
  showBorder,
}) => {
  const width = textElement.width + DEFAULT_CONFIG.BACKGROUND_PADDING;
  const height = DEFAULT_CONFIG.BACKGROUND_HEIGHT;
  const x = centerPoint.x - width / 2;
  const y = centerPoint.y - height / 2;

  // 绘制背景矩形并填充
  const pixiFillColor = rgbaToPixiColor(fillColor).color;
  graphic.rect(x, y, width, height);
  graphic.fill({ color: pixiFillColor });

  // v8：无边框时跳过 stroke（等价源 lineStyle(0)）
  if (showBorder) {
    const pixiBorderColor = rgbaToPixiColor(borderColor).color;
    graphic.stroke({ width: lineWidth, color: pixiBorderColor });
  }
};

/**
 * 绘制块文本和背景
 * @param {object} params 参数对象
 * @param {object} params.blockObj 块对象参数
 * @param {object} params.blockObj.actualCenterPoint 实际中心点坐标
 * @param {string} params.blockObj.Text 文本内容
 * @param {object} params.blockObj.blockLineConfigure 块配置
 * @param {object} params.graphic 图形绘制对象
 * @param {object[]} params.textLst 文本元素列表
 * @param {boolean} params.isVisible 是否可见
 * @param {object} params.mapContainer 地图容器
 */
const drawBlockText = ({
  blockObj,
  graphic,
  textLst,
  isVisible,
  mapContainer,
}) => {
  const { actualCenterPoint, Text: text, blockLineConfigure } = blockObj;

  const {
    BlockLineWidth,
    BlockLineShowText,
    BlockLineTextColor,
    BlockLineShowBackground,
    BlockLineBackgroundFillColor,
    BlockLineShowBackgroundBorder,
    BlockLineBackgroundBorderColor,
  } = blockLineConfigure;

  // 性能优化：如果文本和背景都不显示，直接返回
  if (!BlockLineShowText && !BlockLineShowBackground) return;

  // 计算字体宽度（直接用 text：源实现传 JSON.stringify(text)，
  // 多算两个引号使 textLength 偏大、字号偏小；layer.js 已修正，此处回流）
  const textLength = typeof text === "string" ? getStringLength(text) : 0;
  const fontWidth = Math.min(
    DEFAULT_CONFIG.FONT_WIDTH_MAX,
    Math.max(
      DEFAULT_CONFIG.FONT_WIDTH_MIN,
      // textLength 为 0 时 8/0 = Infinity，须显式兜底
      textLength > 0 ? Math.floor(8 / textLength) : DEFAULT_CONFIG.FONT_WIDTH_MIN
    )
  );

  // 创建文本元素
  const elementText = new Text(text, {
    fontSize: fontWidth * DEFAULT_CONFIG.FONT_SIZE_MULTIPLIER,
    fill: BlockLineTextColor,
    backgroundColor: "#fff",
  });

  // 设置文本位置和缩放
  elementText.position.set(actualCenterPoint.x, actualCenterPoint.y);
  elementText.scale.set(DEFAULT_CONFIG.SCALE_FACTOR);
  elementText.visible = isVisible && BlockLineShowText;

  // 计算文本中心点（考虑缩放影响）
  const originalScale = 1 / DEFAULT_CONFIG.SCALE_FACTOR;
  elementText.pivot.set(
    (elementText.width * originalScale) / 2,
    (elementText.height * originalScale) / 2
  );

  // 添加到文本列表
  textLst.push(elementText);

  // 绘制背景
  if (BlockLineShowBackground && isVisible) {
    drawTextBackground({
      graphic,
      centerPoint: actualCenterPoint,
      textElement: elementText,
      fillColor: BlockLineBackgroundFillColor,
      borderColor: BlockLineBackgroundBorderColor,
      lineWidth: BlockLineWidth,
      showBorder: BlockLineShowBackgroundBorder,
    });
  }

  // 添加文本到容器
  if (BlockLineShowText) {
    mapContainer.addChild(elementText);
  }
};

/**
 * 绘制块（总段或预组）
 * @param {object} params 参数对象
 * @param {object} params.lineData 线条数据（lineDataLst/blockLineConfigure/mapCenterPoints）
 * @param {object} params.graphic 图形绘制对象
 * @param {object[]} params.textLst 文本元素列表
 * @param {boolean} params.isVisible 是否可见
 * @param {object} params.mapContainer 地图容器
 */
const drawBlocks = ({
  lineData,
  graphic,
  textLst,
  isVisible,
  mapContainer,
}) => {
  const { lineDataLst, blockLineConfigure, mapCenterPoints } = lineData;

  if (!lineDataLst || !Array.isArray(lineDataLst)) return;

  lineDataLst.forEach((val) => {
    const { CenterPoint, OuterPoints, Text: text } = val;
    if (!CenterPoint) return;

    const { IsEmpty, X, Y } = CenterPoint;

    // 计算实际中心点
    const actualCenterPoint = calculateActualPoint({ X, Y }, mapCenterPoints);

    // 绘制虚线连接
    if (!IsEmpty && OuterPoints?.length) {
      const dashedLineLst = OuterPoints.map((item) => [
        actualCenterPoint,
        calculateActualPoint(item, mapCenterPoints),
      ]);
      drawDashedLines(dashedLineLst, graphic);
    }

    // 绘制文本和背景
    drawBlockText({
      blockObj: {
        actualCenterPoint,
        Text: text,
        blockLineConfigure,
      },
      graphic,
      textLst,
      isVisible,
      mapContainer,
    });
  });
};

/**
 * 绘制总段和预组
 * @param {object} props 组件属性（blockInfoLst/combInfoLst/feildBlockVisible/feildCombVisible）
 * @param {object} mapContainer 地图容器
 * @param {object} state blockCombState（BlockLayer/CombLayer/blockTextLst/combTextLst）
 */
export function drawBlockAndCombLines(props, mapContainer, state) {
  const { BlockLayer, CombLayer, blockTextLst, combTextLst } = state;

  // 清空现有图层和文本
  clearList(BlockLayer);
  clearList(CombLayer);
  clearList(blockTextLst);
  clearList(combTextLst);

  // 创建图形图层
  const blockGraphic = createGraphicLayer(
    BlockLayer,
    mapContainer,
    props.feildBlockVisible
  );
  const combGraphic = createGraphicLayer(
    CombLayer,
    mapContainer,
    props.feildCombVisible
  );

  // 绘制总段
  if (props.blockInfoLst?.length) {
    const blockObj = { ...props.blockInfoLst[0] };
    drawBlocks({
      lineData: blockObj,
      graphic: blockGraphic,
      textLst: blockTextLst,
      isVisible: props.feildBlockVisible,
      mapContainer,
    });
  }

  // 绘制预组
  if (props.combInfoLst?.length) {
    const combObj = { ...props.combInfoLst[0] };
    drawBlocks({
      lineData: combObj,
      graphic: combGraphic,
      textLst: combTextLst,
      isVisible: props.feildCombVisible,
      mapContainer,
    });
  }
}
