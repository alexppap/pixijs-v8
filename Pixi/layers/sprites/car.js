/**
 * FileName: car.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 平板车精灵绘制。由源项目 CSS-Web public/js/map/sprite.js 的
 *              drawCarSprites（119–240 行）移植（v6 → v8）：
 *              - PIXI.Loader.shared.resources['pingbanchece'].texture →
 *                TextureLoader.getTexture（缺失时 await loadAllTextures 兜底）
 *              - PIXI.Text → v8 Text 直接可用
 *              - Map.render() → Map.render?.()
 * Version: 1.0.0
 */
import { Sprite, Text } from "pixi.js";
import { loadAllTextures, getTexture } from "../../core/TextureLoader";
import { lngLatToMercator } from "../../utils/mapUtils";
import { clearSprites } from "./animation";

// 常量定义（源 SPRITE_CONFIG.CAR）
const CAR_CONFIG = {
  WIDTH: 50,
  HEIGHT: 20,
  TEXT_STYLE: {
    fontSize: 50,
    backgroundColor: "#fff",
  },
  TEXT_OFFSET: {
    NAME: 15,
    NO: 22,
  },
  TEXT_SCALE: 0.1,
};

/** 车辆纹理键名（侧视平板车） */
const CAR_TEXTURE_NAME = "pingbanchece";

/**
 * 将经纬度坐标转换为地图像素坐标（参数顺序对齐源码调用）
 * @param {object} params 参数对象
 * @param {number} params.lng 经度
 * @param {number} params.lat 纬度
 * @param {object} params.mapInfo 地图信息对象（Origin）
 * @param {object} [params.offset] 偏移量 {x, y}
 * @returns {number[]} [x, y] 地图像素坐标
 */
const convertLngLatToMapPixel = ({ lng, lat, mapInfo, offset = {} }) => {
  const picCenter = lngLatToMercator(lat, lng);
  const x = picCenter[0] - mapInfo.Origin?.X + (offset.x || 0);
  const y = -(picCenter[1] + mapInfo.Origin?.Y + (offset.y || 0));
  return [x, y];
};

/**
 * 转换车辆坐标到地图坐标
 * @param {object} mapInfo 地图信息对象
 * @param {object} MapConfigParams 地图配置参数（routerOffsetX/Y）
 * @returns {Function} (it) => ({Name, No, x, y})
 */
const convertCarPointToMapCoords =
  (mapInfo, MapConfigParams) =>
  (it) => {
    const [x, y] = convertLngLatToMapPixel({
      lng: Number(it.x),
      lat: Number(it.y),
      mapInfo,
      offset: {
        x: MapConfigParams?.routerOffsetX || 0,
        y: MapConfigParams?.routerOffsetY || 0,
      },
    });

    return {
      Name: it.Name,
      No: it.No,
      x,
      y,
    };
  };

/**
 * 创建车辆精灵
 * @param {object} point 转换后的车辆点位（{Name, No, x, y}）
 * @param {number} angle 当前地图角度
 * @param {object} texture 车辆纹理
 * @returns {object} PIXI.Sprite
 */
const createCarSprite = (point, angle, texture) => {
  const carSprite = new Sprite(texture);

  carSprite.anchor.set(0.5, 0.5);
  carSprite.width = CAR_CONFIG.WIDTH;
  carSprite.height = CAR_CONFIG.HEIGHT;
  carSprite.x = point.x;
  carSprite.y = point.y;
  carSprite.angle = angle;

  return carSprite;
};

/**
 * 创建车辆文本标签（名称 + 编号）
 * @param {object} point 转换后的车辆点位
 * @param {number} angle 当前地图角度
 * @returns {{text1: object, text2: object}} 名称与编号 PIXI.Text
 */
const createCarLabels = (point, angle) => {
  const text1 = new Text(point.Name, CAR_CONFIG.TEXT_STYLE);
  const text2 = new Text(point.No, CAR_CONFIG.TEXT_STYLE);

  [text1, text2].forEach((text) => {
    text.anchor.set(0.5, 0.5);
    text.angle = angle;
    text.scale.set(CAR_CONFIG.TEXT_SCALE);
    text.x = point.x;
  });

  text1.y = point.y + CAR_CONFIG.TEXT_OFFSET.NAME;
  text2.y = point.y + CAR_CONFIG.TEXT_OFFSET.NO;

  return { text1, text2 };
};

/**
 * 生成车辆位置图标
 * @param {object} params 参数对象
 * @param {object} params.props 组件属性（CarLst）
 * @param {object} params.mapInfo 地图信息对象
 * @param {object} params.MapConfigParams 地图配置参数
 * @param {object} params.angle 角度对象（value 为当前角度）
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.Map PixiMap 实例（render 触发渲染）
 * @param {object} params.spriteState 精灵状态管理对象
 */
export async function drawCarSprites({
  props,
  mapInfo,
  MapConfigParams,
  angle,
  mapContainer,
  Map,
  spriteState,
}) {
  // 清空现有精灵
  clearSprites(spriteState.carSprites);

  // 验证数据
  if (
    !props?.CarLst ||
    !Array.isArray(props.CarLst) ||
    props.CarLst.length === 0
  ) {
    return;
  }

  // 获取车辆纹理（v8：TextureLoader 模块级缓存，未加载时幂等补载）
  let texture = getTexture(CAR_TEXTURE_NAME);
  if (!texture) {
    await loadAllTextures();
    texture = getTexture(CAR_TEXTURE_NAME);
  }
  if (!texture) {
    console.error("车辆纹理资源加载失败");
    return;
  }

  // 转换坐标并创建车辆精灵
  const points = props.CarLst.map(
    convertCarPointToMapCoords(mapInfo, MapConfigParams)
  );

  points.forEach((point) => {
    // 创建车辆精灵
    const carSprite = createCarSprite(point, angle.value, texture);
    spriteState.carSprites.push(carSprite);
    mapContainer.addChild(carSprite);

    // 创建车辆文本标签
    const { text1, text2 } = createCarLabels(point, angle.value);
    spriteState.carSprites.push(text1, text2);
    mapContainer.addChild(text1, text2);
  });

  Map.render?.();
}
