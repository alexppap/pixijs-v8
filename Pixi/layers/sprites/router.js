/**
 * FileName: router.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 路线精灵绘制（路径线 + 箭头 + 沿线移动车辆动画）。由源项目
 *              CSS-Web public/js/map/sprite.js 的 drawRouterSprites
 *              （241–503 行）移植（v6 → v8）：
 *              - PIXI.Loader.shared.resources['blueArrow'|'pingbanche'] →
 *                TextureLoader.getTexture（缺失时 await loadAllTextures 兜底）
 *              - lineStyle + moveTo/lineTo → 构建路径后统一 stroke()；
 *                beginFill/drawCircle/endFill → circle().fill()
 *              - 源码引用全局 Map 的 fitPathToView（源 mapUtils.js 510–572）
 *                移植为参数化局部实现，避免全局依赖
 * Version: 1.0.0
 */
import { Graphics, Sprite } from "pixi.js";
import { loadAllTextures, getTexture } from "../../core/TextureLoader";
import { lngLatToMapPixel } from "../../utils/mapUtils";
import { clearSprites, startArrowAnimation } from "./animation";

// 常量定义（源 SPRITE_CONFIG.ROUTER）
const ROUTER_CONFIG = {
  PATH_STYLE: {
    width: 4,
    color: 0x1500ff,
    alpha: 1,
  },
  ARROW: {
    WIDTH: 3,
    HEIGHT: 3,
    INTERVAL: 5,
  },
  CAR: {
    WIDTH: 10,
    HEIGHT: 8,
  },
  POINT: {
    RADIUS: 5,
    START_COLOR: 0x4caf50, // 绿色起点
    END_COLOR: 0xf44336, // 红色终点
  },
};

/** 路线视图适配参数（源 fitPathToView 内部常量） */
const FIT_VIEW = {
  PADDING: 50,
  MAX_SCALE: 2.5,
  FALLBACK_WIDTH: 800,
  FALLBACK_HEIGHT: 600,
};

/**
 * 计算点集边界框（{x, y} 格式，源 calculateBoundsFrom2DPoints）
 * @param {object[]} points 点数组
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} 边界框
 */
const calculateBoundsFrom2DPoints = (points) => {
  if (!points || !Array.isArray(points) || points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }
  );
};

/**
 * 适配路径到视图（源 mapUtils.js fitPathToView；全局 Map 依赖参数化；
 * 坐标转换复用 convertRouterPointToMapCoords，与路径绘制保持一致）
 * @param {object} params 参数对象
 * @param {object} params.mapConfigParams 地图配置参数（routerOffsetX/Y）
 * @param {object} params.mapInfo 地图信息（Origin）
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.scale 缩放比例（ref，回写适配后比例）
 * @param {string[]} params.routerProps 路径数据（"lat,lng" 字符串数组）
 * @param {object} params.Map PixiMap 实例（render 触发渲染）
 */
export const fitPathToView = ({
  mapConfigParams,
  mapInfo,
  mapContainer,
  scale,
  routerProps,
  Map,
}) => {
  if (!mapInfo || !mapContainer || !scale || !routerProps) {
    console.error("Missing required parameters for fitPathToView");
    return;
  }
  // 转换坐标点（复用 convertRouterPointToMapCoords，与路径绘制共用同一
  // 转换链，避免两处各自解析坐标字符串产生顺序分歧）
  const points = routerProps.map(
    convertRouterPointToMapCoords(mapInfo, mapConfigParams)
  );

  // 计算路径的边界框
  const bounds = calculateBoundsFrom2DPoints(points);
  // 获取地图容器尺寸
  const containerWidth = mapContainer.width || FIT_VIEW.FALLBACK_WIDTH;
  const containerHeight = mapContainer.height || FIT_VIEW.FALLBACK_HEIGHT;
  // 计算适合的缩放比例
  const padding = FIT_VIEW.PADDING;
  const scaleX =
    (containerWidth - padding * 2) / (bounds.maxX - bounds.minX || 1);
  const scaleY =
    (containerHeight - padding * 2) / (bounds.maxY - bounds.minY || 1);
  let newScale = Math.min(scaleX, scaleY);

  // 限制最大缩放
  if (newScale > FIT_VIEW.MAX_SCALE) {
    newScale = FIT_VIEW.MAX_SCALE;
  }

  // 计算地图中心位置
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  // 应用缩放和位置调整
  scale.value = newScale;
  mapContainer.scale.set(newScale);
  if (mapContainer.pivot?.set) {
    mapContainer.pivot.set(centerX, centerY);
  }
  mapContainer?.position.set(containerWidth / 2, containerHeight / 2);
  // 触发地图重绘
  Map?.render?.();
};

/**
 * 转换路由点坐标到地图坐标
 * 注：偏移量原实现加在 Origin 外侧（-(y+Origin)+offset），现统一走
 * lngLatToMapPixel 的内侧语义（-(y+Origin+offset)）以与 ship/car 一致；
 * 本项目 routerOffsetY 恒为 0/未配置，故输出不变。
 * @param {object} mapInfo 地图信息（Origin）
 * @param {object} MapConfigParams 地图配置参数（routerOffsetX/Y）
 * @returns {Function} (it) => ({x, y})，it 为 "lat,lng" 字符串
 */
const convertRouterPointToMapCoords =
  (mapInfo, MapConfigParams) =>
  (it) => {
    const [lat, lng] = it.split(",").map(Number);
    const [x, y] = lngLatToMapPixel({
      lng,
      lat,
      mapInfo,
      offset: {
        x: MapConfigParams?.routerOffsetX || 0,
        y: MapConfigParams?.routerOffsetY || 0,
      },
    });

    return {
      x,
      y,
    };
  };

/**
 * 创建路由路径线（v8：构建 moveTo/lineTo 路径后统一 stroke）
 * @param {{x: number, y: number}[]} points 路径点
 * @returns {object} PIXI.Graphics
 */
const createRouterPath = (points) => {
  const path = new Graphics();
  const { width, color, alpha } = ROUTER_CONFIG.PATH_STYLE;

  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }
  path.stroke({ width, color, alpha });

  return path;
};

/**
 * 创建箭头精灵（沿路径每隔 5 个采样点放一个，朝向路径方向）
 * @param {object} params 参数对象
 * @param {{x: number, y: number}[]} params.arrowPathLst 采样点列表
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.spriteState 精灵状态
 * @param {object} params.texture 箭头纹理
 */
const createArrowSprites = ({
  arrowPathLst,
  mapContainer,
  spriteState,
  texture,
}) => {
  arrowPathLst.forEach((it, index) => {
    if (index % 5 === 0) {
      const arrowSprite = new Sprite(texture);
      arrowSprite.anchor.set(0.5, 0.5);
      arrowSprite.width = ROUTER_CONFIG.ARROW.WIDTH;
      arrowSprite.height = ROUTER_CONFIG.ARROW.HEIGHT;
      arrowSprite.x = it.x;
      arrowSprite.y = it.y;

      // 设置箭头方向
      if (index < arrowPathLst.length - 1) {
        const nextPoint = arrowPathLst[index + 1];
        const dx = nextPoint.x - it.x;
        const dy = nextPoint.y - it.y;
        arrowSprite.rotation = Math.atan2(dy, dx) + Math.PI / 2;
      }

      spriteState.routerObjs.push(arrowSprite);
      mapContainer.addChild(arrowSprite);
    }
  });
};

/**
 * 创建路由上的车辆精灵（默认镜像朝向）
 * @param {object} texture 车辆纹理
 * @returns {object} PIXI.Sprite
 */
const createRouterCarSprite = (texture) => {
  const carSprite = new Sprite(texture);

  carSprite.anchor.set(0.5, 0.5);
  carSprite.scale.x = -1;
  carSprite.width = ROUTER_CONFIG.CAR.WIDTH;
  carSprite.height = ROUTER_CONFIG.CAR.HEIGHT;

  return carSprite;
};

/**
 * 创建起点和终点标记（v8：circle().fill()）
 * @param {{x: number, y: number}[]} points 路径点
 * @returns {{startPoint: object, endPoint: object}} 起终点 PIXI.Graphics
 */
const createRoutePoints = (points) => {
  // 起点
  const startPoint = new Graphics();
  startPoint
    .circle(0, 0, ROUTER_CONFIG.POINT.RADIUS)
    .fill(ROUTER_CONFIG.POINT.START_COLOR);
  startPoint.position.set(points[0].x, points[0].y);

  // 终点
  const endPoint = new Graphics();
  endPoint
    .circle(0, 0, ROUTER_CONFIG.POINT.RADIUS)
    .fill(ROUTER_CONFIG.POINT.END_COLOR);
  endPoint.position.set(
    points[points.length - 1].x,
    points[points.length - 1].y
  );

  return { startPoint, endPoint };
};

/**
 * 生成箭头坐标列表（按间隔沿路径采样）
 * @param {{x: number, y: number}[]} path 路径点
 * @param {number} [interval=5] 采样间隔
 * @returns {{x: number, y: number}[]} 采样点列表
 */
export const generateArrowPathLst = (path, interval = 5) => {
  const pathLst = [];

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i];
    const end = path[i + 1];

    // 计算线段长度
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 确保至少有一个点
    const steps = Math.max(1, Math.floor(distance / interval));

    // 生成线段上的点
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      pathLst.push({
        x: start.x + t * dx,
        y: start.y + t * dy,
      });
    }
  }

  return pathLst;
};

/**
 * 添加路径箭头图标及动画
 * @param {object} params 参数对象
 * @param {object} params.props 组件属性（router："lat,lng" 字符串数组）
 * @param {object} params.mapInfo 地图信息（Origin）
 * @param {object} params.MapConfigParams 地图配置参数
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.scale 缩放比例（ref）
 * @param {object} params.Map PixiMap 实例（render 触发渲染）
 * @param {Function} params.resetMap 重置地图的函数
 * @param {object} params.spriteState 精灵状态管理对象
 */
export async function drawRouterSprites({
  props,
  mapInfo,
  MapConfigParams,
  mapContainer,
  scale,
  Map,
  resetMap,
  spriteState,
}) {
  // 清空现有路由对象
  clearSprites(spriteState.routerObjs);
  resetMap?.();

  // 验证路径数据
  if (
    !props?.router ||
    !Array.isArray(props.router) ||
    props.router.length === 0
  ) {
    return;
  }

  // 获取箭头与车辆纹理（v8：TextureLoader 模块级缓存，未加载时幂等补载）
  let arrowTexture = getTexture("blueArrow");
  let carTexture = getTexture("pingbanche");
  if (!arrowTexture || !carTexture) {
    await loadAllTextures();
    arrowTexture = getTexture("blueArrow");
    carTexture = getTexture("pingbanche");
  }
  if (!arrowTexture || !carTexture) {
    console.error("路线纹理资源加载失败");
    return;
  }

  // 转换路径坐标
  const points = props.router.map(
    convertRouterPointToMapCoords(mapInfo, MapConfigParams)
  );

  // 生成箭头路径点
  const arrowPathLst = generateArrowPathLst(
    points,
    ROUTER_CONFIG.ARROW.INTERVAL
  );

  // 创建路径图形
  const path = createRouterPath(points);
  spriteState.routerObjs.push(path);
  mapContainer.addChild(path);

  // 创建箭头精灵
  createArrowSprites({ arrowPathLst, mapContainer, spriteState, texture: arrowTexture });

  // 创建车辆精灵
  const carSprite = createRouterCarSprite(carTexture);
  spriteState.routerObjs.push(carSprite);
  mapContainer.addChild(carSprite);

  // 创建起点和终点标记
  const { startPoint, endPoint } = createRoutePoints(points);
  spriteState.routerObjs.push(startPoint, endPoint);
  mapContainer.addChild(startPoint, endPoint);

  // 适配路径到视图
  fitPathToView({
    mapConfigParams: MapConfigParams,
    mapInfo,
    mapContainer,
    scale,
    routerProps: props.router,
    Map,
  });

  // 启动箭头动画
  startArrowAnimation(carSprite, arrowPathLst, Map);
}
