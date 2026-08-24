/**
 * FileName: material.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 物资精灵绘制（多边形 + 图片两种形态）。由源项目 CSS-Web
 *              public/js/map/sprite.js 的 drawMaterials（1178–1308 行）
 *              移植（v6 → v8）：
 *              - PIXI.Loader.shared + "加载器忙时递归等待"回调链 →
 *                Assets.load（按 URL 幂等，并发安全）；自建
 *                materialTextureCache 仅保留"过滤已加载项"用途
 *              - DisplayStyle===0 多边形分支复用 utils/mapUtils 的
 *                createPolygonGraphic（v8 重写版）；精灵分支复用 createSprite
 *              - 销毁清空改用 length = 0（保持 reactive 数组引用）
 * Version: 1.0.0
 */
import { Assets } from "pixi.js";
import {
  calculateBounds,
  processPolygonVertices,
  createPolygonGraphic,
  createSprite,
} from "../../utils/mapUtils";

// 图片类型映射（源 SPRITE_CONFIG.IMAGE_TYPE_MAP + MATERIAL.DEFAULT_IMAGE_TYPE）
const IMAGE_TYPE_MAP = {
  0: "svg",
  1: "png",
  2: "jpg",
};
const DEFAULT_IMAGE_TYPE = "png";

// 物资纹理缓存（ID → Texture；Assets.load 亦按 URL 幂等，
// 此缓存仅用于过滤已加载项，对齐移植计划 §5）
const materialTextureCache = new Map();

/**
 * 重置物资纹理缓存（仅供测试使用）
 */
export function resetMaterialTextureCache() {
  materialTextureCache.clear();
}

/**
 * 组装 data URL（ImageType → mime）
 * @param {object} element 图片资源（ImageType/ImageData）
 * @returns {string} data URL
 */
const getBase64ImageUrl = (element) => {
  const type = IMAGE_TYPE_MAP[element.ImageType] || DEFAULT_IMAGE_TYPE;
  return `data:image/${type};base64,${element.ImageData}`;
};

/**
 * 加载未缓存的物资纹理（v8：Assets.load 幂等，替代 Loader 忙时递归等待链）
 * @param {object[]} materialImgLst 图片资源列表
 * @returns {Promise<object>} resources 映射（ID → Texture）
 */
const loadMaterialTextures = async (materialImgLst) => {
  const unloaded = materialImgLst.filter(
    (element) => !materialTextureCache.has(element.ID)
  );

  if (unloaded.length) {
    await Promise.all(
      unloaded.map(async (element) => {
        try {
          const texture = await Assets.load(getBase64ImageUrl(element));
          materialTextureCache.set(element.ID, texture);
        } catch (e) {
          console.error(`物资图${element.ID}加载失败：`, e);
        }
      })
    );
  }

  // 组装 resources 映射（对齐源码 loader.resources 形态）
  const resources = {};
  materialImgLst.forEach((element) => {
    if (materialTextureCache.has(element.ID)) {
      resources[element.ID] = materialTextureCache.get(element.ID);
    }
  });
  return resources;
};

/**
 * 绘制物资精灵
 * @param {object} params 参数对象
 * @param {object} params.props 组件属性（materialMapLocationInfos）
 * @param {object} params.mapInfo 地图信息对象
 * @param {object} params.ConfigParams 配置参数（MaterialBoarder）
 * @param {object} params.mapContainer 地图容器
 * @param {Function} params.materialOnClick 物资点击事件处理函数
 * @param {object} params.spriteState 精灵状态管理对象
 * @param {object} params.Map PixiMap 实例（render 触发渲染）
 */
export async function drawMaterials({
  props,
  mapInfo,
  ConfigParams,
  mapContainer,
  materialOnClick,
  spriteState,
  Map,
}) {
  // 清空现有的物资图形（原地清空：赋新数组会断开 spriteState.destroy 的
  // 闭包引用，导致新数组内的图形在组件卸载时永不销毁）
  if (spriteState.materials.length) {
    spriteState.materials.forEach((item) => item.destroy());
    spriteState.materials.length = 0;
  }

  const materialImgLst = props?.materialMapLocationInfos?.ImageResources || [];
  const polygonLst =
    props?.materialMapLocationInfos?.MaterialMapLocations || [];

  // 加载物资图片纹理后创建图形
  const resources = await loadMaterialTextures(materialImgLst);

  polygonLst.forEach((item) => {
    if (item.DisplayStyle === 0) {
      // 多边形类型处理
      const { centerX, centerY } = calculateBounds(item.MapPoints, {
        xKey: "X",
        yKey: "Y",
        includeCenter: true,
      });
      item.centerX = centerX;
      item.centerY = centerY;

      const polygonVertices = processPolygonVertices(
        item.MapPoints,
        centerX,
        centerY
      );

      const graphic = createPolygonGraphic({
        item,
        polygonVertices,
        mapInfo,
        borderConfig: ConfigParams?.MaterialBoarder,
        fillColor: item.DefaultColor,
        transparency: item.Transparency,
      });

      graphic.Name = item.Name;
      graphic.on("pointerdown", () => materialOnClick(graphic, false));

      spriteState.materials.push(graphic);
      mapContainer.addChild(graphic);
    } else {
      // 精灵类型处理
      const sprite = createSprite(item, resources, mapInfo);
      if (!sprite) return;
      sprite.on("pointerdown", () => materialOnClick(sprite, true));
      mapContainer.addChild(sprite);
      spriteState.materials.push(sprite);
    }
  });

  // 优化性能：只在所有图形创建完成后渲染一次
  Map?.render?.();
}
