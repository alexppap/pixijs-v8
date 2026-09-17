/**
 * FileName: CoordinateSystem.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 地图坐标系与视口管理（PixiJS v8）。由源项目 CSS-Web 的
 *              mapUtils.js resetCoordinateSystem（180–390）与 MapTemplate.vue 的
 *              calculateScaleTransform / adjustElementsOnScale / resetMap /
 *              updateMapWidth 逻辑移植而来。采用依赖注入：容器与 ref 状态
 *              （scale/angle/originScale/originPositionX/Y）由调用方持有并注入，
 *              本模块只读/写这些状态。源码差异说明：
 *              1. proj4 投影定义（resetCoordinateSystem 开头）在源码中定义后
 *                 未被使用，本项目无 proj4 依赖，予以省略；
 *              2. resetMap 源码普通分支内部嵌套的 isHull else（mapScaleHull
 *                 计算）在外层分支下为死代码，不移植；
 *              3. updateMapWidth 源码手动设置 canvas style.width/height，
 *                 本项目 PixiMap 以 autoDensity 创建，renderer.resize 已自动
 *                 同步 CSS 尺寸，予以省略。
 * Version: 1.1.0
 */
import { calculateScaleTransform } from "../utils/scaleTransform";

// ------------------------------
// 默认配置
// ------------------------------
/** 视角适配边距系数（"新扬子"视图铺满系数 1.055，其余 0.9 留边） */
const XINYANGZI_FIT_RATIO = 1.055;
const DEFAULT_FIT_RATIO = 0.9;

// ------------------------------
// 内部工具
// ------------------------------
/**
 * 角度（度）转弧度（与源码 angleToRadian 一致）
 * @param {Number} angle - 角度
 * @returns {Number} 弧度
 */
const angleToRadian = (angle) => Math.PI * (angle / 180);

/**
 * 点绕指定中心旋转（与源码 rotatePoint 一致）
 * @param {Object} params - 参数对象
 * @param {Number} params.x - 点X坐标
 * @param {Number} params.y - 点Y坐标
 * @param {Number} params.centerX - 旋转中心X
 * @param {Number} params.centerY - 旋转中心Y
 * @param {Number} params.angle - 旋转角度（度）
 * @returns {Object} { x, y }
 */
const rotatePoint = ({ x, y, centerX, centerY, angle }) => {
  const radian = angleToRadian(-angle);
  const deltaX = x - centerX;
  const deltaY = y - centerY;
  return {
    x: deltaX * Math.cos(radian) - deltaY * Math.sin(radian) + centerX,
    y: deltaX * Math.sin(radian) + deltaY * Math.cos(radian) + centerY,
  };
};

/**
 * 创建地图坐标系实例
 * @param {Object} ctx - 依赖注入上下文
 * @param {Object} ctx.pixiMap - PixiMap 实例（须已完成 init）
 * @param {Object} ctx.mapInfo - 地图信息对象 { MapWidth, MapHeight, Scale? }，由调用方维护
 * @param {Object} ctx.scale - 当前缩放 ref（Number）
 * @param {Object} ctx.angle - 地图旋转角 ref（Number，度）
 * @param {Object} ctx.originScale - 初始缩放 ref（Number）
 * @param {Object} ctx.originPositionX - 初始位置X ref（Number）
 * @param {Object} ctx.originPositionY - 初始位置Y ref（Number）
 * @param {Function} [ctx.isHull] - 是否船体模式 () => boolean，默认 false
 * @param {Function} [ctx.getMapObj] - 画布配置获取 () => { MapWidth, MapHeight,
 *   defaultScale?, NowShowViewName? }（对应源 props.mapObj）
 * @param {Function} [ctx.getMapHeightZoom] - 高度缩放系数获取 () => Number（对应源 props.mapHeightZoom，默认 1）
 * @param {Function} [ctx.getFieldTextsPIXI] - 场地文字 PIXI 对象数组获取（反向缩放目标）
 * @param {Function} [ctx.getFieldTexts] - 场地文字对象数组获取（反向缩放目标）
 * @param {Function} [ctx.getCameraLstPIXI] - 摄像头图标数组获取（反向缩放目标）
 * @param {Function} [ctx.closeDialog] - 关闭弹窗回调（resetMap/updateMapWidth 时触发）
 * @param {Function} [ctx.onSyncPosition] - 双图联动位置回调 ([x, y]) => void
 * @param {Function} [ctx.onSyncWheel] - 双图联动缩放回调 (scale, [x, y]) => void
 * @returns {Object} 坐标系实例 { resetCoordinateSystem, calculateScaleTransform,
 *   adjustElementsOnScale, resetMap, updateMapWidth }
 */
export function createCoordinateSystem(ctx) {
  const {
    pixiMap,
    mapInfo,
    scale,
    angle,
    originScale,
    originPositionX,
    originPositionY,
  } = ctx;

  if (!pixiMap || !mapInfo || !scale || !angle || !originScale) {
    console.error("createCoordinateSystem: 缺少必要依赖（pixiMap/mapInfo/scale/angle/originScale）");
    return null;
  }

  // 是否船体模式
  const isHull = () => ctx.isHull?.() ?? false;
  // 画布配置获取（对应源 props.mapObj）
  const getMapObj = () => ctx.getMapObj?.() ?? {};
  // 高度缩放系数获取（对应源 props.mapHeightZoom，默认 1）
  const getMapHeightZoom = () => ctx.getMapHeightZoom?.() ?? 1;
  // 场地文字 PIXI 对象数组获取（反向缩放目标）
  const getFieldTextsPIXI = () => ctx.getFieldTextsPIXI?.() ?? [];
  // 场地文字对象数组获取（反向缩放目标）
  const getFieldTexts = () => ctx.getFieldTexts?.() ?? [];
  // 摄像头图标数组获取（反向缩放目标） 
  const getCameraLstPIXI = () => ctx.getCameraLstPIXI?.() ?? [];

  /**
   * 计算地图中心点绕原点旋转后的坐标（源码多处重复的旋转中心计算）
   * @returns {Object} { newCenterX, newCenterY }
   */
  const getRotatedMapCenter = () => {
    const oldCenterX = mapInfo.MapWidth / 2;
    const oldCenterY = mapInfo.MapHeight / 2;
    const deg = Math.PI * (-angle.value / 180);
    return {
      newCenterX: oldCenterX * Math.cos(deg) - oldCenterY * Math.sin(deg),
      newCenterY: oldCenterX * Math.sin(deg) + oldCenterY * Math.cos(deg),
    };
  };

  /**
   * 根据底图边界重置坐标系（旋转、居中、初始缩放，含 isHull 双分支）
   * 移植自源 mapUtils.js resetCoordinateSystem
   * @param {Array<Object>} arr - 所有底图顶点 [{X, Y}]
   */
  const resetCoordinateSystem = (arr) => {
    const container = pixiMap.mapContainer;
    if (!container) return;
    const mapObj = getMapObj();

    // 计算容器外接矩形四角绕地图中心旋转后的外接矩形（校验地图尺寸有效）
    const containerPoints = [
      { X: 0, Y: 0 },
      { X: mapInfo.MapWidth, Y: 0 },
      { X: 0, Y: mapInfo.MapHeight },
      { X: mapInfo.MapWidth, Y: mapInfo.MapHeight },
    ];
    const center = { X: mapInfo.MapWidth / 2, Y: mapInfo.MapHeight / 2 };
    const rotatedContainer = containerPoints.map((p) =>
      rotatePoint({ x: p.X, y: p.Y, centerX: center.X, centerY: center.Y, angle: angle.value })
    );
    const bigSquare = rotatedContainer.reduce(
      (acc, p) => ({
        minX: Math.min(acc.minX, p.X),
        maxX: Math.max(acc.maxX, p.X),
        minY: Math.min(acc.minY, p.Y),
        maxY: Math.max(acc.maxY, p.Y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );
    const bigWidth = bigSquare.maxX - bigSquare.minX;
    const bigHeight = bigSquare.maxY - bigSquare.minY;
    if (bigWidth <= 0 || bigHeight <= 0) return;

    // 所有顶点绕原点旋转后的边界（源码绕原点而非地图中心）
    const deg1 = Math.PI * (-angle.value / 180);
    const rotatedPoints = arr.map((p) => ({
      x: p.X * Math.cos(deg1) - p.Y * Math.sin(deg1),
      y: p.X * Math.sin(deg1) + p.Y * Math.cos(deg1),
    }));
    const xMax = Math.max(...rotatedPoints.map((p) => p.x));
    const yMax = Math.max(...rotatedPoints.map((p) => p.y));
    const xMin = Math.min(...rotatedPoints.map((p) => p.x));
    const yMin = Math.min(...rotatedPoints.map((p) => p.y));
    const rotatedWidth = xMax - xMin;
    const rotatedHeight = yMax - yMin;

    // 计算初始缩放（"新扬子"视图铺满 1.055，其余 0.9 留边；可被 defaultScale 覆盖）
    const viewName = mapObj.NowShowViewName;
    const isXinyangzi = Boolean(viewName) && viewName.indexOf("新扬子") !== -1;
    const fitRatio = isXinyangzi ? XINYANGZI_FIT_RATIO : DEFAULT_FIT_RATIO;
    const scale1 = (mapObj.MapWidth / rotatedWidth) * fitRatio;
    const scale2 =
      ((mapObj.MapHeight * getMapHeightZoom()) / rotatedHeight) * fitRatio;
    scale.value = mapObj.defaultScale
      ? mapObj.defaultScale
      : Math.min(scale1, scale2);

    // 地图中心点旋转后的坐标
    const { newCenterX, newCenterY } = getRotatedMapCenter();

    // 计算初始位置（isHull 双分支）
    if (!isHull()) {
      originPositionX.value = mapObj.MapWidth / 2 - newCenterX * scale.value;
      originPositionY.value =
        (getMapHeightZoom() * mapObj.MapHeight) / 2 - newCenterY * scale.value;
    } else {
      // 船体图：按船体与画布宽高关系选择铺满策略
      const hullHeight = mapInfo.MapHeight; // 船体图高度
      const canvasHeight = mapObj.MapHeight; // 画布高度
      const hullWidth = mapInfo.MapWidth; // 船体图宽度
      const canvasWidth = mapObj.MapWidth; // 画布宽度
      let mapScaleHull;
      if (hullHeight > hullWidth || Math.abs(hullHeight - hullWidth) < 50) {
        // 船体高大于宽（或近似方形）：以宽度比例铺满画布
        mapScaleHull = canvasWidth / hullWidth;
        originPositionX.value =
          mapObj.MapWidth / 2 -
          newCenterX * scale.value +
          (mapInfo.MapWidth * scale.value) / 2;
        originPositionY.value =
          mapObj.MapHeight / 2 -
          newCenterY * scale.value +
          (mapInfo.MapHeight * mapScaleHull) / 2;
      } else {
        // 否则取宽高较小比例，保证船体图完整显示
        mapScaleHull = Math.min(canvasWidth / hullWidth, canvasHeight / hullHeight);
        originPositionX.value =
          canvasWidth / 2 -
          newCenterX * mapScaleHull +
          (hullWidth * mapScaleHull) / 2;
        originPositionY.value =
          canvasHeight / 2 -
          newCenterY * mapScaleHull +
          (hullHeight * mapScaleHull) / 2;
      }
      // 保留1位小数并覆盖缩放
      mapScaleHull = Number(mapScaleHull.toFixed(1));
      scale.value = mapScaleHull;
    }

    // 应用变换并记录初始状态
    container.angle = -angle.value;
    container.scale.set(scale.value);
    originScale.value = scale.value;
    container.position.set(originPositionX.value, originPositionY.value);
  };

  /**
   * 计算缩放中心点和位置（委托 utils/scaleTransform 共享实现，
   * 与 MapInteraction 滚轮/捏合缩放复用同一算法）
   * 注：读取 mapContainer 实时变换（外部逻辑可能直接修改容器，等价于源码 scale.value）
   * @param {Object} mousePos - 缩放中心（画布本地坐标 {x, y}）
   * @returns {Object} { tempX, tempY, getNewPosition(newScale) }
   */
  const calculateScaleTransformFor = (mousePos) =>
    calculateScaleTransform(pixiMap.mapContainer, mousePos);

  /**
   * 调整缩放时的元素大小（文字/相机图标反向缩放）
   * 移植自源 MapTemplate.vue adjustElementsOnScale
   * @param {Number} newScale - 新的缩放比例
   */
  const adjustElementsOnScale = (newScale) => {
    getFieldTextsPIXI().forEach((it) => {
      it.scale.set(originScale.value / newScale);
    });
    getFieldTexts().forEach((it) => {
      it.scale.set(originScale.value / newScale);
    });
    getCameraLstPIXI().forEach((it) => {
      it.scale.set(originScale.value / 2 / newScale);
    });
  };

  /**
   * 重置地图视角（恢复初始缩放与位置，保留 isHull 双分支）
   * 移植自源 MapTemplate.vue resetMap
   */
  const resetMap = () => {
    const container = pixiMap?.mapContainer;
    if (!container) return;
    ctx.closeDialog?.();

    if (isHull()) {
      // 船体模式：仅重置支点并恢复初始缩放（沿用初始位置）
      container.pivot.set(0, 0);
      scale.value = originScale.value;
      container.scale.set(originScale.value);
    } else {
      // 普通模式：重置变换并按旋转中心重算初始位置
      container.pivot.set(0, 0);
      container.scale.set(originScale.value);
      scale.value = originScale.value;

      const { newCenterX, newCenterY } = getRotatedMapCenter();
      const mapObj = getMapObj();
      originPositionX.value =
        mapObj.MapWidth / 2 - newCenterX * scale.value;
      originPositionY.value =
        (getMapHeightZoom() * mapObj.MapHeight) / 2 - newCenterY * scale.value;
    }

    // 文字与相机图标反向缩放补偿
    getFieldTextsPIXI().forEach((it) =>
      it.scale.set(originScale.value / scale.value)
    );
    getFieldTexts().forEach((it) =>
      it.scale.set(originScale.value / scale.value)
    );
    getCameraLstPIXI().forEach((it) =>
      it.scale.set(originScale.value / 2 / scale.value)
    );

    container.position.set(originPositionX.value, originPositionY.value);

    // 双图联动同步
    ctx.onSyncPosition?.([originPositionX.value, originPositionY.value]);
    ctx.onSyncWheel?.(scale.value, [
      originPositionX.value,
      originPositionY.value,
    ]);
  };

  /**
   * 更新画布尺寸并重置视角布局
   * 移植自源 MapTemplate.vue updateMapWidth
   * @param {Number} newWidth - 新画布宽度
   * @param {Number} [newHeight] - 新画布高度（省略时保持当前高度）
   * @param {Number} [newScale] - 指定新的初始缩放（同时更新 originScale）
   */
  const updateMapWidth = (newWidth, newHeight, newScale) => {
    const container = pixiMap?.mapContainer;
    if (!container) return;

    if (!newWidth || newWidth <= 0) {
      console.error("无效的参数，无法更新地图宽度");
      return;
    }

    const mapObj = getMapObj();
    if (newScale) {
      scale.value = newScale;
      originScale.value = newScale;
      container.scale.set(newScale);
    }

    // 更新 PIXI 渲染尺寸（autoDensity 下 CSS 尺寸自动同步，无需手动设置 style）
    const targetHeight = newHeight ? newHeight : pixiMap.screenSize.height;
    pixiMap.resize(newWidth, targetHeight);

    // 重置容器核心变换状态（顺序重要）
    container.pivot.set(0, 0);
    container.scale.set(originScale.value);
    scale.value = originScale.value;

    // 按旋转中心重算初始位置
    const { newCenterX, newCenterY } = getRotatedMapCenter();
    originPositionX.value =
      (newWidth ? newWidth : mapObj.MapWidth) / 2 - newCenterX * scale.value;
    originPositionY.value =
      (getMapHeightZoom() * (newHeight ? newHeight : mapObj.MapHeight)) / 2 -
      newCenterY * scale.value;

    container.position.set(originPositionX.value, originPositionY.value);

    // 关闭弹窗（画面由常驻渲染的 ticker 在下一帧刷新）
    ctx.closeDialog?.();
  };

  return {
    resetCoordinateSystem,
    calculateScaleTransform: calculateScaleTransformFor,
    adjustElementsOnScale,
    resetMap,
    updateMapWidth,
  };
}

export default createCoordinateSystem;
