/**
 * FileName: layer.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 底图多边形图层绘制层。由源项目 CSS-Web public/js/map/layer.js
 *              （428 行）移植（v6 → v8）：
 *              - drawPolygon：beginFill/lineStyle/drawPolygon/endFill →
 *                poly()/fill()/stroke()；虚线分支为 poly+fill 后构建虚线路径
 *                再统一 stroke（对齐源码"填充多边形 + 虚线边框"语义）
 *              - interactive/buttonMode → eventMode='static'/cursor='pointer'；
 *                清理时 interactive=false → eventMode='pass-through'
 *              - customConfig（源项目路由级配置）本项目恒为 undefined，
 *                TEXT_SIZE_MULTIPLIER 走默认值 8（移植计划 §7）
 *              - recolor：源 MapTemplate.vue watch colorList（2647–2654）的
 *                clear+lineStyle+beginFill+drawPolygon 链改 v8 API 重写
 * Version: 1.0.0
 */
import { Graphics, Text } from "pixi.js";
import {
  drawDashedPolygon,
  getStringLength,
  findPolygonCentroid,
  createPolygonGraphic,
  rgbaToPixiColor,
  getHighContrastRGBA,
} from "../utils/mapUtils";

// 常量配置 - 集中管理参数
const LAYER_CONFIG = {
  TEXT_SCALE: 0.06, // 文本缩放比例
  TEXT_SIZE_MULTIPLIER: 8, // 文本大小乘数（源 customConfig 缺省值）
  MAX_FONT_WIDTH: 10, // 最大字体宽度
  MIN_FONT_WIDTH: 4, // 最小字体宽度
  DASH_SIZE: 4, // 虚线间隔
  TEXT_CONTAINER_ZINDEX: 999, // 文本容器层级
};

/**
 * 绘制多边形图形（v8：poly/fill/stroke）
 * @param {object} graphics PIXI.Graphics 对象
 * @param {number[]} vertices 多边形顶点（平铺数组）
 * @param {object} style 样式配置
 * @param {number} [style.alpha=1] 透明度（0-1）
 */
const drawPolygon = (graphics, vertices, style) => {
  const { fillColor, borderWidth, borderColor, borderType, alpha = 1 } = style;

  // 设置透明度
  graphics.alpha = alpha;

  // 构建多边形路径并填充
  graphics.poly(vertices);
  if (fillColor) {
    graphics.fill(fillColor);
  }

  // 绘制线条（实线或虚线）
  if (borderType === "Default") {
    graphics.stroke({ width: borderWidth, color: borderColor });
  } else {
    // 虚线绘制：填充已完成，构建虚线边框路径后统一描边
    // （fill 已结束多边形路径，此处 moveTo/lineTo 仅作用于虚线段）
    drawDashedPolygon(graphics, vertices, LAYER_CONFIG.DASH_SIZE);
    graphics.stroke({ width: borderWidth, color: borderColor });
  }
};

/**
 * 收集多边形顶点：去重后输出**世界**坐标，并把原始点位累积到
 * xarr/yarr/arr（供调用方计算底图边界、重置视角）。
 * 注：utils/mapUtils 里有个曾与本函数同名的 processPolygonVertices，但语义
 * 不同——那个输出以中心为原点的局部坐标且无副作用输出。两者不可互换，
 * 故本函数改名以消除歧义。
 * @param {object} params 参数对象
 * @param {object[]} params.mapPoints 原始点位（{X, Y} 格式）
 * @param {number[]} params.xarr X坐标数组（输出）
 * @param {number[]} params.yarr Y坐标数组（输出）
 * @param {object[]} params.arr 点位数组（输出）
 * @returns {object} 处理后的顶点信息 { vertices, verticesOrigin }
 */
const collectPolygonVertices = ({ mapPoints, xarr, yarr, arr }) => {
  const vertices = [];
  const verticesOrigin = [];

  mapPoints?.forEach((point, i) => {
    // 收集坐标信息
    xarr.push(point.X);
    yarr.push(point.Y);
    arr.push(point);

    // 去重处理（与上一个点比较，直接比较坐标提高效率）
    const prevPoint = mapPoints[i - 1];
    const isDifferentPoint =
      i === 0 || point.X !== prevPoint.X || point.Y !== prevPoint.Y;

    if (isDifferentPoint) {
      vertices.push(point.X, point.Y);
      verticesOrigin.push(point);
    }
  });

  return { vertices, verticesOrigin };
};

/**
 * 创建并配置文本元素（v8 Text 直接可用）
 * @param {string} text 文本内容
 * @param {object} options 配置选项
 * @param {number} options.centerX 中心点X坐标
 * @param {number} options.centerY 中心点Y坐标
 * @param {number} options.textColor 文本颜色
 * @param {boolean} [options.visible=true] 是否可见
 * @param {number} [options.width=0] 可用宽度（按字数均摊字号）
 * @returns {object} PIXI.Text 文本元素
 */
const createTextElement = (text, options) => {
  const { centerX, centerY, textColor, visible = true, width = 0 } = options;

  // 计算字体宽度（直接使用文本，避免JSON.stringify）
  const textLength = getStringLength(text);
  const calculatedFontWidth =
    width > 0 && textLength > 0 ? width / textLength : LAYER_CONFIG.MIN_FONT_WIDTH;
  const fontWidth = Math.min(
    LAYER_CONFIG.MAX_FONT_WIDTH,
    Math.max(LAYER_CONFIG.MIN_FONT_WIDTH, calculatedFontWidth)
  );

  // 创建文本元素
  const elementText = new Text(text, {
    fontSize: fontWidth * LAYER_CONFIG.TEXT_SIZE_MULTIPLIER,
    fill: textColor,
    backgroundColor: "#fff",
  });

  // 设置位置、缩放和可见性
  elementText.position.set(centerX, centerY);
  elementText.scale.set(LAYER_CONFIG.TEXT_SCALE);
  elementText.visible = visible;

  // 计算并设置中心点（考虑缩放影响）
  const originalScale = 1 / LAYER_CONFIG.TEXT_SCALE;
  elementText.pivot.set(
    (elementText.width * originalScale) / 2,
    (elementText.height * originalScale) / 2
  );

  return elementText;
};

/**
 * 创建并配置地图图形元素（回填命中检测依赖字段，勿删）
 * @param {object} params 参数对象
 * @param {object} params.element 地图元素数据
 * @param {number[]} params.vertices 多边形顶点（平铺数组）
 * @param {object[]} params.verticesOrigin 原始顶点数据
 * @param {Function} [params.clickHandler] 点击事件处理函数
 * @returns {object} 配置好的 PIXI.Graphics 元素
 */
const createMapElement = ({ element, vertices, verticesOrigin, clickHandler }) => {
  // 创建图形元素，使用统一的createPolygonGraphic函数
  const mapElement = createPolygonGraphic({
    item: element,
    polygonVertices: vertices,
    mapInfo: null, // 不需要，因为是直接设置位置
    borderConfig: { width: element.BorderWidth, color: element.BorderColor }, // 自定义边框配置
    fillColor: element.FillColor,
    transparency: 1,
    options: {
      centerCalculation: false, // 不计算中心，直接设置位置
      interactive: true, // 设置交互
      position: { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1 }, // 初始位置
    },
  });

  // 存储图块信息
  mapElement.FieldID = element.FieldID;
  mapElement.name = element.Name;
  mapElement.textColor = element.TextColor;
  mapElement.BorderWidth = element.BorderWidth;
  mapElement.BorderColor = element.BorderColor;

  // 设置交互（v8：eventMode + cursor）
  if (clickHandler) {
    mapElement.on("pointerdown", clickHandler);
  }

  // 计算并存储中心点
  const [centerX, centerY] = findPolygonCentroid(verticesOrigin);
  mapElement.centerX = centerX;
  mapElement.centerY = centerY;

  return mapElement;
};

/**
 * 绘制Hull模式下的图层
 * @param {object} params 参数对象
 * @param {number[]} params.xarr X坐标数组（输出）
 * @param {number[]} params.yarr Y坐标数组（输出）
 * @param {object[]} params.arr 点位数组（输出）
 * @param {object} params.props 组件属性（mapLayerInfos / feildTextVisible）
 * @param {object} params.mapContainer 地图容器
 * @param {Function} params.onHullFieldClick 点击事件处理函数
 * @param {object} params.state mapLayerState（MapLayer / fieldTextLst）
 */
const drawHullLayer = ({
  xarr,
  yarr,
  arr,
  props,
  mapContainer,
  onHullFieldClick,
  state,
}) => {
  const { MapLayer, fieldTextLst } = state;
  // 直接遍历原始数据：本函数只读 element 的字段，不回写。
  // 源实现在此做 JSON 深拷贝，大底图上是明显的卡顿源，且同库
  // drawClickableLayer / drawMergedLayer 本来就直接遍历原数据——
  // 移除后三个分支行为一致。
  const elements = props.mapLayerInfos || [];

  elements.forEach((element) => {
    // 处理顶点
    const { vertices, verticesOrigin } = collectPolygonVertices({
      mapPoints: element.MapPoints,
      xarr,
      yarr,
      arr,
    });

    // 创建图形元素
    const mapElement = createMapElement({
      element,
      vertices,
      verticesOrigin,
      clickHandler: onHullFieldClick,
    });

    // 添加到图层和容器
    MapLayer.push(mapElement);
    mapContainer.addChild(mapElement);

    // 绘制文本（如果有名称）
    if (mapElement.name) {
      const elementText = createTextElement(mapElement.name, {
        centerX: mapElement.centerX,
        centerY: mapElement.centerY,
        textColor: mapElement.textColor,
        visible: props.feildTextVisible,
        width: mapElement.width,
      });
      // 回填 FieldID：recolor 靠它把文字与图形配对。
      // 不能靠数组下标——只有 name 非空的元素才入 fieldTextLst，
      // 与 MapLayer 的下标天然错位
      elementText.FieldID = element.FieldID;

      fieldTextLst.push(elementText);
      mapContainer.addChild(elementText);
    }
  });
};

/**
 * 绘制可点击模式下的图层
 * @param {object} params 参数对象
 * @param {number[]} params.xarr X坐标数组（输出）
 * @param {number[]} params.yarr Y坐标数组（输出）
 * @param {object[]} params.arr 点位数组（输出）
 * @param {object} params.mapInfo 地图信息（LayerInfos）
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.state mapLayerState（MapLayer）
 */
const drawClickableLayer = ({
  xarr,
  yarr,
  arr,
  mapInfo,
  mapContainer,
  state,
}) => {
  const { MapLayer } = state;

  // 按ZIndex排序图层（复制后排序：sort 原地修改会改变调用方 mapInfo 的
  // LayerInfos 顺序，导致第二次绘制的输入与第一次不同）
  [...mapInfo.LayerInfos]
    .sort((a, b) => b.ZIndex - a.ZIndex)
    .forEach((layer) => {
      layer.Elements.forEach((element) => {
        if (element.Type === "Polygon") {
          // 处理顶点
          const { vertices, verticesOrigin } = collectPolygonVertices({
            mapPoints: element.MapPoints,
            xarr,
            yarr,
            arr,
          });

          // 创建图形元素
          const mapElement = createPolygonGraphic({
            item: element,
            polygonVertices: vertices,
            mapInfo: null, // 不需要，因为是直接设置位置
            borderConfig: {
              width: element.BorderWidth,
              color: element.BorderColor,
            }, // 自定义边框配置
            fillColor: element.FillColor,
            transparency: 1,
            options: {
              centerCalculation: false, // 不计算中心，直接设置位置
              interactive: true, // 设置交互
              position: { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1 }, // 初始位置
            },
          });

          // 存储信息和交互设置（v8：eventMode + cursor）
          mapElement.FieldID = element.FieldID;
          mapElement.polygonVertices = vertices;
          mapElement.eventMode = "static";
          mapElement.cursor = "pointer";

          // 计算中心点
          const [centerX, centerY] = findPolygonCentroid(verticesOrigin);
          mapElement.centerX = centerX;
          mapElement.centerY = centerY;

          // 添加到图层和容器
          MapLayer.push(mapElement);
          mapContainer.addChild(mapElement);
        }
        // 文本类型元素处理（当前注释掉，保留结构）
        // else if (element.Type === "Text") { ... }
      });
    });
};

/**
 * 绘制合并模式下的图层
 * @param {object} params 参数对象
 * @param {number[]} params.xarr X坐标数组（输出）
 * @param {number[]} params.yarr Y坐标数组（输出）
 * @param {object[]} params.arr 点位数组（输出）
 * @param {object} params.mapInfo 地图信息（LayerInfos）
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.state mapLayerState（MapLayer）
 */
const drawMergedLayer = ({
  xarr,
  yarr,
  arr,
  mapInfo,
  mapContainer,
  state,
}) => {
  const { MapLayer } = state;

  // 这些是用于绘制多个多边形的容器，不适合使用createPolygonGraphic
  const mainGraphics = new Graphics();
  const textGraphics = new Graphics();
  textGraphics.zIndex = LAYER_CONFIG.TEXT_CONTAINER_ZINDEX;

  mapContainer.addChild(mainGraphics);
  mapContainer.addChild(textGraphics);

  // 按ZIndex排序图层（复制后排序，避免原地修改调用方的 LayerInfos 顺序）
  [...mapInfo.LayerInfos]
    .sort((a, b) => b.ZIndex - a.ZIndex)
    .forEach((layer) => {
      const targetGraphics = layer.ZIndex !== -10 ? mainGraphics : textGraphics;
      const alpha = layer.ZIndex !== -10 ? 1 : 0.5;

      layer.Elements.forEach((element) => {
        if (element.Type === "Polygon") {
          // 处理顶点
          const { vertices } = collectPolygonVertices({
            mapPoints: element.MapPoints,
            xarr,
            yarr,
            arr,
          });

          // 绘制多边形
          drawPolygon(targetGraphics, vertices, {
            fillColor: element.FillColor,
            borderWidth: element.BorderWidth,
            borderColor: element.BorderColor,
            borderType: element.BorderType || "Default",
            alpha,
          });
        }
        // 文本类型元素处理（当前注释掉，保留结构）
        // else if (element.Type === "Text") { ... }
      });
    });

  // 添加到图层
  MapLayer.push(mainGraphics);
  MapLayer.push(textGraphics);
};

/**
 * 清除地图图层（销毁池内对象并清空数组）
 * @param {object} state mapLayerState（MapLayer / fieldTextLst）
 */
export const clearMapLayers = (state) => {
  const { MapLayer, fieldTextLst } = state;

  // 销毁并清除地图元素
  MapLayer.forEach((item) => {
    if (item && item.destroy && typeof item.destroy === "function") {
      try {
        // 在销毁前移除所有事件监听器，避免交互系统继续引用
        item.removeAllListeners();
        // 标记为不可交互（v8：eventMode 还原为 pass-through）
        item.eventMode = "pass-through";
        // 销毁元素
        item.destroy({ children: true });
      } catch (e) {
        console.warn("销毁地图元素时出错:", e);
      }
    }
  });
  MapLayer.splice(0);

  // 销毁并清除文本元素
  fieldTextLst.forEach((item) => {
    if (item && item.destroy && typeof item.destroy === "function") {
      try {
        // 在销毁前移除所有事件监听器
        item.removeAllListeners();
        // 标记为不可交互
        item.eventMode = "pass-through";
        // 销毁元素
        item.destroy({ children: true });
      } catch (e) {
        console.warn("销毁文本元素时出错:", e);
      }
    }
  });
  fieldTextLst.splice(0);
};

/**
 * 绘制底图主函数（isHull / fieldClickable / merged 三分支）
 * @param {object} params 参数对象
 * @param {number[]} params.xarr X坐标数组（输出，供坐标系重置收集边界）
 * @param {number[]} params.yarr Y坐标数组（输出）
 * @param {object[]} params.arr 点位数组（输出）
 * @param {object} params.props 组件属性（isHull / fieldClickable / mapLayerInfos / feildTextVisible）
 * @param {object} params.mapContainer 地图容器
 * @param {Function} params.onHullFieldClick 船体场地点击事件处理函数
 * @param {object} params.mapInfo 地图信息（LayerInfos）
 * @param {object} params.state mapLayerState（MapLayer / fieldTextLst）
 */
export function drawLayer({
  xarr,
  yarr,
  arr,
  props,
  mapContainer,
  onHullFieldClick,
  mapInfo,
  state,
}) {
  // 清空现有图层
  clearMapLayers(state);

  // 根据不同模式绘制图层
  if (props.isHull) {
    drawHullLayer({
      xarr,
      yarr,
      arr,
      props,
      mapContainer,
      onHullFieldClick,
      state,
    });
  } else if (props.fieldClickable) {
    drawClickableLayer({ xarr, yarr, arr, mapInfo, mapContainer, state });
  } else {
    drawMergedLayer({ xarr, yarr, arr, mapInfo, mapContainer, state });
  }
}

/**
 * 颜色重绘（供 watch colorList 调用，源 MapTemplate.vue 2647–2654 的 v8 改写）
 *
 * 配对策略：colorList 各项若带 FieldID，则按 FieldID 精确匹配图形与文字；
 * 否则回退为数组下标对应（源码行为）。下标对应只在 isHull 模式成立——
 * merged 模式下 MapLayer 只有 mainGraphics/textGraphics 两项、fieldTextLst
 * 为空，三方长度根本不一致，靠下标必然错配。
 * @param {object} state mapLayerState（MapLayer / fieldTextLst）
 * @param {object[]} colorList 颜色列表（每项含 fillColor，可选 FieldID）
 * @returns {boolean} 是否执行了重绘
 */
export function recolor(state, colorList) {
  if (!colorList || !colorList.length) return false;

  // FieldID → 颜色项。colorList 不带 FieldID 时该表为空，走下标回退
  const colorByFieldId = new Map();
  colorList.forEach((item) => {
    const fieldId = item?.FieldID ?? item?.fieldID ?? item?.fieldId;
    if (fieldId !== undefined && fieldId !== null) {
      colorByFieldId.set(fieldId, item);
    }
  });
  const matchByFieldId = colorByFieldId.size > 0;

  /**
   * 取某个显示对象对应的颜色项
   * @param {object} target 图形或文字元素（含 FieldID）
   * @param {number} index 在各自数组中的下标（回退用）
   * @returns {object|undefined} 颜色项
   */
  const pickColor = (target, index) =>
    matchByFieldId ? colorByFieldId.get(target?.FieldID) : colorList[index];

  // 重绘图形颜色（v8：clear + poly + fill + stroke）
  state.MapLayer?.forEach((graphic, index) => {
    const colorItem = pickColor(graphic, index);
    if (!graphic?.MyPolygonVertices || !colorItem) return;

    try {
      graphic.clear();
      graphic.poly(graphic.MyPolygonVertices);
      const pixiColor = rgbaToPixiColor(colorItem.fillColor);
      graphic.fill({ color: pixiColor.color, alpha: pixiColor.alpha });
      graphic.stroke({
        width: graphic.BorderWidth ?? 1,
        color: graphic.BorderColor ?? 0x000000,
      });
    } catch (e) {
      // 单个图形重绘失败不中断其余图形（否则整张底图停留在半新半旧状态）
      console.warn(`重绘图形颜色失败（FieldID ${graphic?.FieldID}）:`, e);
    }
  });

  // 更新字体颜色
  state.fieldTextLst?.forEach((item, index) => {
    const colorItem = pickColor(item, index);
    if (!item || !colorItem) return;

    try {
      // getHighContrastRGBA 对非法颜色会 throw，需逐项隔离
      item.style.fill = getHighContrastRGBA(colorItem.fillColor);
    } catch (e) {
      console.warn(`计算文字对比色失败（FieldID ${item?.FieldID}）:`, e);
    }
  });

  return true;
}
