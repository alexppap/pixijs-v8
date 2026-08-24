/**
 * FileName: mapUtils.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: Pixi 地图通用工具（多边形绘制、命中检测、颜色转换、几何计算）。
 *              由源项目 CSS-Web public/js/map/mapUtils.js 移植（v6 → v8）：
 *              - createPolygonGraphic：lineStyle/beginFill/drawPolygon/endFill
 *                → poly()/fill()/stroke()；interactive/buttonMode →
 *                eventMode='static'/cursor='pointer'
 *              - drawDashedPolygon：保持纯路径构建（moveTo/lineTo），v8 中
 *                需由调用方统一 stroke()
 *              - drawDashedLines：v6 lineStyle + moveTo/lineTo → 构建全部虚线
 *                段后统一 stroke()
 *              - lngLatToMercator：源码依赖全局 proj4 投影；本项目不引入
 *                proj4，无投影库时恒等返回（视为坐标已是目标坐标系，对齐
 *                源码的降级路径）
 *              - findPolyVisualCenter：源码依赖 polyvisualcenter 库；本项目
 *                不引入，降级为多边形重心近似
 *              - resetCoordinateSystem/fitPathToView/positionJson 不在此文件
 *                （分别归 core/CoordinateSystem.js 与 assets/imgs/position.json）
 * Version: 1.0.0
 */
/* global proj4 */
import { Graphics, Sprite } from "pixi.js";

// ===============================================
// 坐标转换相关函数
// ===============================================

/**
 * 将经纬度转换为墨卡托坐标
 * 源码依赖 proj4 全局投影定义（resetCoordinateSystem 中 defs）；本项目无
 * proj4 依赖，未加载时恒等返回（mock 数据直接给出目标坐标系坐标）。
 *
 * ⚠ 本项目的字段约定：地图数据中 **CenterY / 点位 Y 装经度，CenterX /
 * 点位 X 装纬度**（反直觉但全库一致）。因此调用处形如
 * `lngLatToMercator(item.CenterY, item.CenterX)`，返回值 [0] 作 x、[1] 作 y。
 * 新增调用请走 lngLatToMapPixel，勿再自行拼装，以免与该约定错位。
 * @param {number} longitude 经度（本项目取自 CenterY / 点位 Y）
 * @param {number} latitude 纬度（本项目取自 CenterX / 点位 X）
 * @returns {number[]} 转换后的坐标数组 [x, y]
 */
export function lngLatToMercator(longitude, latitude) {
  const lon = Number(longitude);
  const lat = Number(latitude);

  if (isNaN(lon) || isNaN(lat)) {
    console.error(
      "Invalid coordinates: longitude and latitude must be numbers",
      { longitude, latitude }
    );
    return [0, 0];
  }

  if (typeof proj4 === "undefined") {
    // 无 proj4：视为坐标已是目标坐标系
    return [lon, lat];
  }

  try {
    const result = proj4("sourceProjection", "targetProjection", [lon, lat]);

    if (
      isNaN(result[0]) ||
      isNaN(result[1]) ||
      !isFinite(result[0]) ||
      !isFinite(result[1])
    ) {
      return [0, 0];
    }

    return result;
  } catch (error) {
    console.error("Failed to convert coordinates", error);
    return [0, 0];
  }
}

/**
 * 经纬度 → 地图像素坐标（唯一实现，原 router/ship/car 三份重复的
 * convertLngLatToMapPixel 合并至此）
 *
 * Origin 缺失时按 0 处理：裸写 `picCenter[0] - mapInfo.Origin?.X` 在
 * Origin 为 undefined 时得到 NaN，PIXI 对 NaN 坐标既不报错也不渲染，
 * 元素会静默消失且极难定位，故此处统一防护。
 *
 * ⚠ 内部按 `lngLatToMercator(lat, lng)` 调用——形参名与实参顺序倒置，
 * 这是移植自源码的既有约定（三份原实现均如此），刻意保持以免改变坐标
 * 输出。故 picCenter[0] 实为 lat 位、[1] 为 lng 位。勿"顺手修正"顺序。
 * @param {object} params 参数对象
 * @param {number} params.lng 调用方标为经度的字段（实际取 CenterX / 点位 x）
 * @param {number} params.lat 调用方标为纬度的字段（实际取 CenterY / 点位 y）
 * @param {object} params.mapInfo 地图信息（Origin）
 * @param {object} [params.offset] 附加偏移 {x, y}
 * @returns {number[]} [x, y] 地图像素坐标
 */
export function lngLatToMapPixel({ lng, lat, mapInfo, offset = {} }) {
  const picCenter = lngLatToMercator(lat, lng);
  const originX = Number(mapInfo?.Origin?.X) || 0;
  const originY = Number(mapInfo?.Origin?.Y) || 0;
  const offsetX = Number(offset.x) || 0;
  const offsetY = Number(offset.y) || 0;

  return [
    picCenter[0] - originX + offsetX,
    -(picCenter[1] + originY + offsetY),
  ];
}

// ===============================================
// 图形绘制相关函数
// ===============================================

/**
 * 绘制虚线多边形（纯路径构建，不描边）
 * v8 中 moveTo/lineTo 仅构建路径，实际描边由调用方统一 stroke()。
 * @param {object} mapElement 地图元素对象（PIXI.Graphics）
 * @param {number[]} polygonVertices 多边形顶点数组（平铺 [x1,y1,x2,y2,...]）
 * @param {number} dashSize 虚线长度
 */
export function drawDashedPolygon(mapElement, polygonVertices, dashSize) {
  if (!mapElement || !polygonVertices || !Array.isArray(polygonVertices)) {
    console.error("Invalid parameters for drawDashedPolygon");
    return;
  }

  if (typeof dashSize !== "number" || dashSize <= 0) {
    console.error("Invalid dash size: must be a positive number");
    return;
  }

  for (let i = 0; i < polygonVertices.length; i += 2) {
    const x1 = polygonVertices[i];
    const y1 = polygonVertices[i + 1];
    const x2 = polygonVertices[(i + 2) % polygonVertices.length];
    const y2 = polygonVertices[(i + 3) % polygonVertices.length];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const dashCount = Math.floor(distance / dashSize);

    if (dashCount === 0) continue;

    const xIncrement = dx / dashCount;
    const yIncrement = dy / dashCount;
    let currentX = x1;
    let currentY = y1;

    for (let j = 0; j < dashCount; j++) {
      if (j % 2 === 0) {
        mapElement.moveTo(currentX, currentY);
      } else {
        mapElement.lineTo(currentX, currentY);
      }

      currentX += xIncrement;
      currentY += yIncrement;
    }
  }
}

/**
 * 绘制虚线段列表（构建全部虚线路径后统一描边）
 * v6 的 lineStyle 前置声明改为末尾一次性 stroke。
 * @param {object[]} dashedLineList 虚线列表（每项为两点 [{x,y},{x,y}]）
 * @param {object} graphic PIXI.Graphics 绘图对象
 */
export function drawDashedLines(dashedLineList, graphic) {
  if (!dashedLineList || !Array.isArray(dashedLineList) || !graphic) {
    console.error("Invalid parameters for drawDashedLines");
    return;
  }

  const lineWidth = 0.5;
  const lineColor = 0x49555a;
  const dashLength = 2;
  const gapLength = 1;

  dashedLineList.forEach((line) => {
    if (!line || line.length < 2) return;

    const { x: x1, y: y1 } = line[0];
    const { x: x2, y: y2 } = line[1];

    // 计算总长度和方向向量
    const totalLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    if (totalLength <= 0) return;

    const deltaX = (x2 - x1) / totalLength;
    const deltaY = (y2 - y1) / totalLength;

    let currentLength = 0;
    while (currentLength < totalLength) {
      const startX = x1 + deltaX * currentLength;
      const startY = y1 + deltaY * currentLength;

      currentLength += dashLength;
      const isOver = currentLength > totalLength;
      const endLength = isOver ? totalLength : currentLength;

      const endX = x1 + deltaX * endLength;
      const endY = y1 + deltaY * endLength;

      graphic.moveTo(startX, startY);
      graphic.lineTo(endX, endY);

      if (isOver) break;

      currentLength += gapLength;
    }
  });

  // v8：路径构建完成后统一描边
  graphic.stroke({ width: lineWidth, color: lineColor });
}

// ===============================================
// 交互检测相关函数
// ===============================================

/**
 * 点击穿透检测
 * @param {object[]} container 容器元素数组
 * @param {object} point 点坐标 {x, y}
 * @returns {object[]} 命中的元素数组
 */
export function clickThroughTest(container, point) {
  if (!container || !Array.isArray(container) || !point) {
    console.error("Invalid parameters for clickThroughTest");
    return [];
  }

  const hitElements = [];

  function traverseChildren(parent) {
    parent.forEach((child) => {
      if (
        child?.containsPoint &&
        typeof child.containsPoint === "function" &&
        child.containsPoint(point)
      ) {
        hitElements.push(child);
      }
    });
  }

  traverseChildren(container);
  return hitElements;
}

// ===============================================
// 几何计算相关函数
// ===============================================

/**
 * 获取字符串长度（考虑中英文）
 * @param {string} str 输入字符串
 * @returns {number} 计算后的长度
 */
export function getStringLength(str) {
  if (typeof str !== "string") {
    console.error("getStringLength requires a string parameter");
    return 0;
  }

  let realLength = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    // ASCII字符计为0.5，其他字符计为1
    realLength += charCode >= 0 && charCode <= 128 ? 0.5 : 1;
  }
  return realLength;
}

/**
 * 寻找多边形重心
 * @param {object[]} points 多边形顶点数组（{X, Y} 格式）
 * @returns {number[]} 重心坐标 [x, y]
 */
export function findPolygonCentroid(points) {
  if (!points || !Array.isArray(points) || points.length === 0) {
    console.error("Invalid points for findPolygonCentroid");
    return [0, 0];
  }

  const n = points.length;
  let area = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let i = 0; i < n; i++) {
    const point1 = points[i];
    const point2 = points[(i + 1) % n];
    const crossProduct = point1.X * point2.Y - point2.X * point1.Y;

    area += crossProduct;
    centroidX += (point1.X + point2.X) * crossProduct;
    centroidY += (point1.Y + point2.Y) * crossProduct;
  }

  area *= 0.5;
  if (area === 0) return [0, 0]; // 防止除以零

  centroidX /= 6 * area;
  centroidY /= 6 * area;

  return [centroidX, centroidY];
}

/**
 * 计算路径总长度
 * @param {object[]} points 路径点数组（{x, y} 格式）
 * @returns {number} 路径总长度
 */
export function calculatePathLength(points) {
  if (!points || !Array.isArray(points) || points.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }
  return totalDistance;
}

/**
 * 获取路径上指定距离的点
 * @param {object[]} points 路径点数组（{x, y} 格式）
 * @param {number} distance 指定距离
 * @returns {object|null} 路径上的点 {x, y}
 */
export function getPointAtDistance(points, distance) {
  if (
    !points ||
    !Array.isArray(points) ||
    points.length === 0 ||
    typeof distance !== "number"
  ) {
    console.error("Invalid parameters for getPointAtDistance");
    return null;
  }

  if (points.length === 1) return points[0];

  let currentDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const segmentDistance = Math.sqrt(dx * dx + dy * dy);

    // 如果距离在当前线段内
    if (segmentDistance > 0 && currentDistance + segmentDistance >= distance) {
      const t = (distance - currentDistance) / segmentDistance;
      return {
        x: points[i].x + t * dx,
        y: points[i].y + t * dy,
      };
    }

    currentDistance += segmentDistance;
  }

  // 如果超过总距离，返回终点
  return points[points.length - 1];
}

/**
 * 寻找多边形的视觉中心
 * 源码依赖 polyvisualcenter（pole of inaccessibility）；本项目不引入该
 * 依赖，降级为多边形重心近似（对齐源码失败路径的 [0,0] 兜底语义）。
 * @param {object[]} mapPoints 多边形顶点数组（{X, Y} 格式）
 * @returns {number[]} 视觉中心坐标 [x, y]
 */
export function findPolyVisualCenter(mapPoints) {
  if (!mapPoints || !Array.isArray(mapPoints) || mapPoints.length === 0) {
    console.error("Invalid points for findPolyVisualCenter");
    return [0, 0];
  }

  const centroid = findPolygonCentroid(mapPoints);
  if (centroid[0] === 0 && centroid[1] === 0) {
    console.warn("Could not calculate polygon visual center");
    return [0, 0];
  }

  return centroid;
}

/**
 * 通用的边界框计算函数
 * @param {object[]} points 点数组
 * @param {object} options 配置选项
 * @param {string} options.xKey x坐标属性名，默认"x"
 * @param {string} options.yKey y坐标属性名，默认"y"
 * @param {boolean} options.includeCenter 是否包含中心点，默认false
 * @returns {object} 边界框信息 {minX, minY, maxX, maxY[, centerX, centerY]}
 */
export function calculateBounds(points, options = {}) {
  const { xKey = "x", yKey = "y", includeCenter = false } = options;

  if (!points || points.length === 0) {
    const result = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return includeCenter ? { ...result, centerX: 0, centerY: 0 } : result;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach((point) => {
    minX = Math.min(minX, point[xKey]);
    maxX = Math.max(maxX, point[xKey]);
    minY = Math.min(minY, point[yKey]);
    maxY = Math.max(maxY, point[yKey]);
  });

  const result = { minX, minY, maxX, maxY };

  if (includeCenter) {
    return {
      ...result,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }

  return result;
}

// ===============================================
// 图形元素创建相关函数
// ===============================================

/**
 * 处理多边形顶点去重和转换（世界坐标 → 以中心为原点的局部坐标）
 * @param {object[]} points 多边形顶点数组（{X, Y} 格式）
 * @param {number} centerX 中心点X坐标
 * @param {number} centerY 中心点Y坐标
 * @returns {number[]} 处理后的多边形顶点数组（平铺）
 */
export function processPolygonVertices(points, centerX, centerY) {
  const polygonVertices = [];

  points.forEach((point, i) => {
    // 去重操作
    if (i === 0 || JSON.stringify(point) !== JSON.stringify(points[i - 1])) {
      polygonVertices.push(point.X - centerX);
      polygonVertices.push(-(point.Y - centerY));
    }
  });

  return polygonVertices;
}

/**
 * 公共工具函数：创建多边形图形对象（v8 重写）
 * v6 → v8：lineStyle/beginFill/drawPolygon/endFill 链式调用改为
 * poly()/fill()/stroke()；interactive/buttonMode 改为
 * eventMode='static'/cursor='pointer'。
 * 命中检测依赖的业务字段（MyPolygonVertices/MyAngle/MyMirror 等）在此回填。
 * @param {object} params 参数对象
 * @param {object} params.item 地图元素数据（含 CenterX/CenterY/Angle/Mirror 等）
 * @param {number[]} params.polygonVertices 多边形顶点（平铺数组）
 * @param {object} params.mapInfo 地图信息（Origin/Scale）
 * @param {number|object} params.borderConfig 边框配置（1=默认；对象=自定义）
 * @param {number} params.fillColor 填充颜色
 * @param {number} [params.transparency=1] 填充透明度
 * @param {object} [params.options] 选项
 * @param {boolean} [params.options.hasBorder] 是否绘制边框
 * @param {number} [params.options.borderWidth] 边框宽度
 * @param {number} [params.options.borderColor] 边框颜色
 * @param {boolean} [params.options.hasFill] 是否填充
 * @param {boolean} [params.options.interactive] 是否可交互
 * @param {boolean} [params.options.centerCalculation] 是否按 item 中心计算位置
 * @param {object|null} [params.options.position] 直接指定位置 {x, y, angle, scaleX, scaleY}
 * @returns {object} PIXI.Graphics
 */
export function createPolygonGraphic({
  item,
  polygonVertices,
  mapInfo,
  borderConfig,
  fillColor,
  transparency = 1,
  options = {},
}) {
  const graphic = new Graphics();
  const {
    hasBorder = true,
    borderWidth = 1,
    borderColor = 0x000000,
    hasFill = true,
    interactive = true,
    centerCalculation = true,
    position = null,
  } = options;

  // v8：先构建多边形路径
  graphic.poly(polygonVertices);

  // 填充颜色
  if (hasFill) {
    graphic.fill({ color: fillColor, alpha: transparency });
  }

  // 设置边框（v8：stroke 基于已构建路径）
  if (hasBorder && borderConfig === 1) {
    graphic.stroke({ width: borderWidth, color: borderColor, alpha: 1 });
  } else if (hasBorder && typeof borderConfig === "object") {
    // 支持自定义边框配置
    graphic.stroke({
      width: borderConfig.width,
      color: borderConfig.color,
      alpha: borderConfig.alpha || 1,
    });
  }

  // 设置位置和变换
  if (position) {
    // 直接使用提供的位置
    graphic.x = position.x || 0;
    graphic.y = position.y || 0;
    graphic.angle = position.angle || 0;
    graphic.scale.x = position.scaleX || 1;
    graphic.scale.y = position.scaleY || 1;
  } else if (centerCalculation && item && mapInfo) {
    // 计算中心坐标
    const picCenter = lngLatToMercator(
      Number(item.CenterY),
      Number(item.CenterX)
    );

    // 归一化 Origin/Scale/Angle，缺失或非法时不产生 NaN（对齐 createSprite 防护）
    const originX = Number(mapInfo.Origin?.X || 0);
    const originY = Number(mapInfo.Origin?.Y || 0);
    const mapScale = Number(mapInfo.Scale) || 1;

    graphic.x = picCenter[0] - originX;
    graphic.y = -(picCenter[1] + originY);
    graphic.angle = typeof item.Angle === "number" ? item.Angle : 0;
    graphic.scale.x = item.Mirror ? -mapScale : mapScale;
    graphic.scale.y = mapScale;
  }

  // 设置交互属性（v8：eventMode + cursor）
  if (interactive) {
    graphic.eventMode = "static";
    graphic.cursor = "pointer";
  }

  // 设置公共属性（命中检测/弹窗依赖字段，勿删）
  if (item) {
    graphic.RefObjectID = item.RefObjectID;
    graphic.RefObjectType = item.RefObjectType;
    graphic.MyAngle = item.Angle;
    graphic.MyMirror = item.Mirror;
  }

  // 始终保存多边形顶点
  graphic.MyPolygonVertices = polygonVertices;
  graphic.FillColor = fillColor;

  return graphic;
}

/**
 * 公共工具函数：创建精灵
 * v6 → v8：interactive/buttonMode → eventMode='static'/cursor='pointer'；
 * resources 取值兼容 PIXI.Loader.resources（{texture}）与 TextureLoader
 * 缓存（Texture 本体）两种形态。
 * @param {object} item 精灵数据（ImageID/CenterX/CenterY/Angle/Mirror/Length/Width）
 * @param {object} resources 纹理资源映射（ImageID → Texture 或 {texture}）
 * @param {object} mapInfo 地图信息（Origin/Scale）
 * @returns {object|null} PIXI.Sprite
 */
export function createSprite(item, resources, mapInfo) {
  // 确保item对象有必要的属性
  if (!item || !resources || !mapInfo) {
    console.error("Missing required parameters for createSprite");
    return null;
  }

  // 确保ImageID存在且有效（兼容 {texture} 包装与 Texture 本体）
  const resource = resources[item.ImageID];
  const texture = resource?.texture || resource;
  if (!item.ImageID || !texture) {
    console.error("Invalid texture resource for createSprite", { item });
    return null;
  }

  const sprite = new Sprite(texture);

  // 确保CenterY和CenterX是有效的数字
  const centerY = Number(item.CenterY);
  const centerX = Number(item.CenterX);

  // 使用lngLatToMercator转换坐标，该函数已经有错误处理
  // 参数顺序为(lng, lat)，即(centerY, centerX)，对齐源码
  const picCenter = lngLatToMercator(centerY, centerX);

  // 设置位置和尺寸，确保使用有效的数值
  const originX = Number(mapInfo.Origin?.X || 0);
  const originY = Number(mapInfo.Origin?.Y || 0);

  sprite.x = picCenter[0] - originX;
  sprite.y = -(picCenter[1] + originY);

  sprite.anchor.set(0.5, 0.5);

  // 设置缩放和旋转，确保使用有效的数值
  const mapScale = typeof mapInfo.Scale === "number" ? mapInfo.Scale : 1;
  const mirror = !!item.Mirror;

  sprite.scale.x = mirror ? -mapScale : mapScale;
  sprite.scale.y = mapScale;

  sprite.width = typeof item.Length === "number" ? item.Length : 10;
  sprite.height = typeof item.Width === "number" ? item.Width : 10;

  sprite.angle = typeof item.Angle === "number" ? item.Angle : 0;

  // 设置交互属性（v8：eventMode + cursor）与业务字段
  sprite.RefObjectID = item.RefObjectID || "";
  sprite.Name = item.Name || "";
  sprite.eventMode = "static";
  sprite.cursor = "pointer";

  return sprite;
}

// ===============================================
// 颜色处理相关函数
// ===============================================

/**
 * 将RGBA颜色转换为Pixi格式
 * @param {string} rgbaString RGBA颜色字符串
 * @returns {object} Pixi颜色对象 {color, alpha}
 */
export function rgbaToPixiColor(rgbaString) {
  if (typeof rgbaString !== "string") {
    console.error("rgbaToPixiColor requires a string parameter");
    return { color: 0, alpha: 1 };
  }

  try {
    const parts = rgbaString
      .replace(/^rgba\(|\)$/g, "")
      .split(",")
      .map((part) => part.trim());
    const r = Math.min(255, Math.max(0, parseInt(parts[0], 10) || 0));
    const g = Math.min(255, Math.max(0, parseInt(parts[1], 10) || 0));
    const b = Math.min(255, Math.max(0, parseInt(parts[2], 10) || 0));
    const a = Math.min(1, Math.max(0, parseFloat(parts[3]) || 1));

    const color = (r << 16) | (g << 8) | b;
    return { color, alpha: a };
  } catch (error) {
    console.error("Failed to parse rgba color:", error);
    return { color: 0, alpha: 1 };
  }
}

// ===============================================
// 高亮边框相关函数（源 MapTemplate.vue 1723–1764）
// ===============================================

/**
 * 创建高亮边框（点击/悬停选中元素的多边形边框）
 * 边框样式默认值与 CLICK_CONFIG.BORDER_STYLE.NORMAL 一致（{width:1,
 * color:0x30ffff}），此处以字面量给出以避免 utils → behaviors 反向依赖。
 * @param {object} target 目标元素（读取 x/y 作为边框位置）
 * @param {number[]} vertices 多边形顶点（平铺数组）
 * @param {object} [style] 边框样式 { width, color }
 * @returns {object} PIXI.Graphics 边框图形（仅描边不填充）
 */
export function createHighlightBorder(
  target,
  vertices,
  style = { width: 1, color: 0x30ffff }
) {
  // 直接使用 createPolygonGraphic：无填充、无交互、直接采用目标位置
  return createPolygonGraphic({
    item: null, // 不需要
    polygonVertices: vertices,
    mapInfo: null, // 不需要
    borderConfig: { width: style.width, color: style.color }, // 自定义边框配置
    fillColor: 0, // 0（只是边框）
    transparency: 0, // 0 完全透明
    options: {
      hasFill: false, // 只绘制边框，不填充
      interactive: false, // 不需要交互
      centerCalculation: false, // 不计算中心
      position: { x: target.x, y: target.y, angle: 0, scaleX: 1, scaleY: 1 },
    },
  });
}

/**
 * 清除现有边框列表（逐项销毁后清空数组）
 * @param {object[]} borderList 边框列表（原地清空）
 */
export function clearBorderList(borderList) {
  if (!borderList || !borderList.length) return;

  borderList.forEach((border) => {
    if (border && border.destroy && typeof border.destroy === "function") {
      try {
        border.destroy();
      } catch (error) {
        console.warn("销毁边框时出错:", error);
      }
    }
  });
  borderList.length = 0;
}

/**
 * 获取高对比度RGBA颜色
 * @param {string|Array} originalRGBA 原始RGBA颜色（字符串或数组）
 * @returns {string} 高对比度RGBA颜色字符串
 */
export function getHighContrastRGBA(originalRGBA) {
  // 解析原始RGBA（支持字符串如"rgba(255,0,255,1)"或数组[r,g,b,a]）
  let r, g, b, a;
  if (typeof originalRGBA === "string") {
    const match = originalRGBA.match(
      /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/
    );
    if (!match) throw new Error("无效的RGBA格式");
    [, r, g, b, a] = match.map(Number);
  } else if (Array.isArray(originalRGBA) && originalRGBA.length === 4) {
    [r, g, b, a] = originalRGBA;
  } else {
    throw new Error("输入格式应为RGBA字符串或数组");
  }

  // 辅助函数：计算颜色的相对亮度（0-1范围）
  const getRelativeLuminance = (r, g, b) => {
    const [R, G, B] = [r, g, b].map((c) => {
      const val = c / 255;
      return val <= 0.03928
        ? val / 12.92
        : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  // 计算反色
  const invertedR = 255 - r;
  const invertedG = 255 - g;
  const invertedB = 255 - b;

  // 计算原始色和反色的相对亮度
  const originalLum = getRelativeLuminance(r, g, b);
  const invertedLum = getRelativeLuminance(invertedR, invertedG, invertedB);

  // 计算亮度比（确保分子大于分母）
  const contrastRatio =
    originalLum > invertedLum
      ? (originalLum + 0.05) / (invertedLum + 0.05)
      : (invertedLum + 0.05) / (originalLum + 0.05);

  // 若反色对比度足够（≥4.5），则使用反色；否则用黑白对比
  if (contrastRatio >= 4.5) {
    return `rgba(${invertedR}, ${invertedG}, ${invertedB}, ${a})`;
  } else {
    // 原始色偏亮（亮度>0.5）用黑色，否则用白色
    return originalLum > 0.5
      ? `rgba(0, 0, 0, ${a})`
      : `rgba(255, 255, 255, ${a})`;
  }
}
