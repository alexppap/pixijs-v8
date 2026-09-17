/**
 * FileName: pbs.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: PBS（泊位）精灵绘制。由源项目 CSS-Web public/js/map/sprite.js
 *              的 drawPBSs / createPBS / generateGridTexture（1321–1683 行）
 *              移植（v6 → v8）：
 *              - 源码被注释的 PBS 实例复用分支（updatePBSProperties）为
 *                dead code，未移植；保留全量重建路径
 *              - lineStyle 覆盖语义（后设边框覆盖先设边框）→ borderStyle
 *                变量最终单次 stroke；beginFill/drawPolygon/endFill →
 *                poly()/fill()；beginTextureFill({texture}) →
 *                fill({ texture })
 *              - generateGridTexture：lineStyle+moveTo/lineTo → 构建路径后
 *                统一 stroke（源码 beginFill 后无闭合图形，填充不生效，
 *                实际仅网格线，保持该行为）；
 *                PIXI.RenderTexture.create → v8 同名 API；
 *                Map.renderer.render(g, rt) →
 *                renderer.render({ container, target })
 *              - interactive/buttonMode → eventMode="static"/cursor="pointer"
 * Version: 1.0.0
 */
import { Graphics, RenderTexture } from "pixi.js";
import {
  getOrCreateRenderTexture,
  releaseRenderTextures,
} from "../../core/RenderTextureCache";
import {
  lngLatToMapPixel,
  calculateBounds,
  processPolygonVertices,
} from "../../utils/mapUtils";

// 常量定义（源 SPRITE_CONFIG.GRID_TEXTURE）
const PBS_CONFIG = {
  GRID_TEXTURE: {
    GRID_SIZE: 2,
    TEXTURE_SIZE: 400,
  },
};

/**
 * 网格纹理缓存说明：高亮切换等场景会频繁重建 PBS，若每次都新建
 * RenderTexture 而旧纹理不随 Graphics 销毁释放，会持续累积 GPU 内存；
 * 按颜色+透明度缓存复用可将总量收敛到有限几种组合。缓存实现与按
 * renderer 分桶的生命周期管理见 core/RenderTextureCache。
 */

/**
 * 释放网格纹理缓存（由 PixiMap.destroy 统一调用；亦供测试重置）
 * @param {object} [pixiMap] PixiMap 实例
 */
export function resetGridTextureCache(pixiMap) {
  releaseRenderTextures(pixiMap);
}

/**
 * 创建图形纹理（网格线纹理，用于 PlanStatus===1 的 PBS 填充）
 * @param {number} color 网格线颜色
 * @param {number} opacity 透明度
 * @param {object} pixiMap PixiMap 实例（renderer 用于渲染到纹理）
 * @returns {object|null} PIXI.RenderTexture（无 renderer 时为 null）
 */
const generateGridTexture = (color, opacity, pixiMap) =>
  getOrCreateRenderTexture(pixiMap, `${color}-${opacity}`, (renderer) => {
    const gridGraphics = new Graphics();
    const gridSize = PBS_CONFIG.GRID_TEXTURE.GRID_SIZE;
    const textureSize = PBS_CONFIG.GRID_TEXTURE.TEXTURE_SIZE;

    for (let i = 0; i <= textureSize; i += gridSize) {
      gridGraphics.moveTo(i, 0);
      gridGraphics.lineTo(i, textureSize);
      gridGraphics.moveTo(0, i);
      gridGraphics.lineTo(textureSize, i);
    }
    gridGraphics.stroke({ width: 1, color, alpha: opacity });

    const renderTexture = RenderTexture.create({
      width: textureSize,
      height: textureSize,
    });

    // v8：renderer.render 参数对象
    renderer.render({ container: gridGraphics, target: renderTexture });
    // 网格已烘焙进 RenderTexture，中间 Graphics 不再需要
    gridGraphics.destroy();

    return renderTexture;
  });

/**
 * 创建PBS图形的函数（v8：poly/fill/stroke，边框覆盖语义对齐 lineStyle）
 * @param {object} params 参数对象
 * @param {object} params.item PBS 数据（MapPoints/PBSID/DefaultColor/PlanStatus 等）
 * @param {object} params.props 组件属性（Clickable/NowPBSs/NowLightPBSsID/showLightPBSs/oneDefaultColor）
 * @param {object} params.ConfigParams 配置参数（PBSBoarder）
 * @param {object} params.mapInfo 地图信息（Origin/Scale）
 * @param {object} params.Map PixiMap 实例（网格纹理渲染用）
 * @param {Function} params.PBSOnClick PBS点击事件处理函数
 * @param {Function} params.materialOnClick 物资点击事件处理函数
 * @returns {object} PIXI.Graphics
 */
const createPBS = ({
  item,
  props,
  ConfigParams,
  mapInfo,
  Map,
  PBSOnClick,
  materialOnClick,
}) => {
  // 计算并添加centerX和centerY（确保后续使用时不报错）
  const { centerX, centerY } = calculateBounds(item.MapPoints, {
    xKey: "X",
    yKey: "Y",
    includeCenter: true,
  });
  item.centerX = centerX;
  item.centerY = centerY;

  const polygonVertices = processPolygonVertices(
    item.MapPoints,
    item.centerX,
    item.centerY
  );
  // 确定颜色
  let color = props.NowLightPBSsID.includes(item.PBSID)
    ? props.oneDefaultColor &&
      props.NowPBSs.length !== props.NowLightPBSsID.length
      ? 0xffffff
      : item.DefaultColor
    : 0xaaaaaa;

  // 处理显示高亮逻辑
  if (props.showLightPBSs.length) {
    color =
      props.NowPBSs.length === props.showLightPBSs.length ||
      props.showLightPBSs.includes(item.PBSID)
        ? item.DefaultColor
        : 0xaaaaaa;
  }

  // 创建基础图形
  const PBS = new Graphics();

  // 设置边框（lineStyle 后设覆盖先设 → borderStyle 单次 stroke）
  let borderStyle = null;
  if (ConfigParams?.PBSBoarder === 1) {
    borderStyle = { width: 1, color: 0x000000, alpha: 1 };
  }

  // 高亮边框处理（覆盖普通边框）
  if (
    props.showLightPBSs.length !== props.NowPBSs.length &&
    props.showLightPBSs.includes(item.PBSID)
  ) {
    borderStyle = { width: 3, color: 0xdc143c, alpha: 1 };
  }

  // 计算中心坐标（Origin 缺失按 0，避免 NaN 坐标导致 PBS 静默不渲染）
  const [pbsX, pbsY] = lngLatToMapPixel({
    lng: Number(item.CenterX),
    lat: Number(item.CenterY),
    mapInfo,
  });

  // 设置位置和变换
  PBS.x = pbsX;
  PBS.y = pbsY;
  PBS.angle = item.Angle;
  PBS.scale.x = mapInfo.Scale
    ? item.Mirror
      ? -mapInfo.Scale
      : mapInfo.Scale
    : 1;
  PBS.scale.y = mapInfo.Scale || 1;
  PBS.CenterY = item.CenterY;
  PBS.CenterX = item.CenterX;

  // 构建多边形路径并填充（网格纹理或纯色）
  PBS.poly(polygonVertices);
  const gridTexture =
    item.PlanStatus === 1
      ? generateGridTexture(color, item.Transparency, Map)
      : null;
  if (gridTexture) {
    PBS.fill({ texture: gridTexture });
  } else {
    // 无 renderer 导致网格纹理生成失败时降级为纯色，避免 fill(undefined)
    PBS.fill({ color, alpha: item.Transparency });
  }

  // 描边（v8：基于已构建路径）
  if (borderStyle) {
    PBS.stroke(borderStyle);
  }

  // 设置交互属性（v8：eventMode + cursor）
  PBS.eventMode = "static";
  PBS.cursor = "pointer";

  // PBS特有属性（命中检测/弹窗依赖字段，勿删）
  PBS.PBSID = item.PBSID;
  PBS.MyPolygonVertices = polygonVertices;
  PBS.MyAngle = item.Angle;
  PBS.MyMirror = item.Mirror;
  PBS.FillColor = color;
  PBS.RefObjectType = item.RefObjectType;
  PBS.PBSCode = item.PBSCode;

  // 设置点击事件
  if (props.Clickable) {
    if (PBS.RefObjectType === 0) {
      PBS.on("pointerdown", () => PBSOnClick(PBS));
    } else if (PBS.RefObjectType === 1) {
      PBS.on("pointerdown", () => materialOnClick(PBS, false));
    }
  }

  return PBS;
};

/**
 * 绘制PBS（泊位）精灵
 * @param {object} params 参数对象
 * @param {object} params.props 组件属性（NowPBSs/showLightPBSs/Clickable 等）
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.Map PixiMap 实例（网格纹理渲染用）
 * @param {object} params.ConfigParams 配置参数（PBSBoarder）
 * @param {object} params.mapInfo 地图信息对象
 * @param {Function} params.PBSOnClick PBS点击事件处理函数
 * @param {Function} params.materialOnClick 物资点击事件处理函数
 * @param {object} params.spriteState 精灵状态管理对象
 */
export function drawPBSs({
  props,
  mapContainer,
  Map,
  ConfigParams,
  mapInfo,
  PBSOnClick,
  materialOnClick,
  spriteState,
}) {
  // 清空现有的PBSs图形（原地清空：赋新数组会断开 spriteState.destroy 的
  // 闭包引用，导致新数组内的图形在组件卸载时永不销毁）
  spriteState.PBSs.forEach((item) => item.destroy());
  spriteState.PBSs.length = 0;

  // 过滤并处理每个PBS
  props.NowPBSs?.filter((it) => it?.MapPoints?.length)?.forEach((item) => {
    // 使用公共函数计算边界和中心
    const { centerX, centerY } = calculateBounds(item.MapPoints, {
      xKey: "X",
      yKey: "Y",
      includeCenter: true,
    });
    item.centerX = centerX;
    item.centerY = centerY;

    // 创建PBS图形
    const PBS = createPBS({
      item,
      props,
      ConfigParams,
      mapInfo,
      Map,
      PBSOnClick,
      materialOnClick,
    });

    spriteState.PBSs.push(PBS);
  });

  // 排序并添加到容器
  spriteState.PBSs
    .sort((a, b) => a.FillColor - b.FillColor)
    .forEach((it) => {
      mapContainer.addChild(it);

      // 处理高亮PBS
      if (
        props.showLightPBSs.length === 1 &&
        it.PBSID === props.showLightPBSs[0]
      ) {
        PBSOnClick(it);
      }
    });
}
