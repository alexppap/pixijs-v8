/**
 * FileName: ship.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 船体/部门定位精灵绘制。由源项目 CSS-Web public/js/map/sprite.js
 *              的 drawShipSprites（520–1177 行）移植（v6 → v8）：
 *              - new PIXI.Loader() + 回调式船图加载 → Assets.load（按 URL
 *                幂等）；自建 shipTextureCache 仅保留"过滤已加载项"用途
 *              - new PIXI.Texture(baseTexture, frame) →
 *                new Texture({ source: texture.source, frame })
 *              - position 60 帧动画：SPRITE_FRAMES 参数注入优先，
 *                缺失时 TextureLoader.getPositionFrames() 兜底，
 *                PIXI.AnimatedSprite → v8 AnimatedSprite 直接可用
 *              - interactive/buttonMode → eventMode="static"/cursor="pointer"
 *              - 定位纹理（shipPisiton/departmentPosition）经 TextureLoader
 *                获取，未加载时幂等补载
 * Version: 1.0.0
 */
import {
  Assets,
  AnimatedSprite,
  Container,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import { loadAllTextures, getTexture, getPositionFrames } from "../../core/TextureLoader";
import { lngLatToMercator } from "../../utils/mapUtils";
import { clearSprites } from "./animation";

// 常量定义（源 SPRITE_CONFIG）
const SHIP_CONFIG = {
  IMAGE_TYPE_MAP: {
    0: "svg",
    1: "png",
    2: "jpg",
  },
  POSITION_SPRITE: {
    WIDTH: 85,
    HEIGHT: 90,
    X_OFFSET: 7,
    Y_OFFSET: -30,
  },
  LABEL: {
    FONT_SIZE: 15,
    BACKGROUND_COLOR: "#fff",
    FILL: 0xffffff,
    X_OFFSET: 1,
    Y_OFFSET: -65,
  },
  HOVER_EFFECT: {
    JUMP_HEIGHT: 10,
    JUMP_DURATION: 1500,
    Z_INDEX_TOP: 9999,
  },
  DEFAULT_IMAGE_TYPE: "png",
};

// 动态船图纹理缓存（data URL → Texture；Assets.load 亦按 URL 幂等，
// 此缓存仅用于过滤已加载项，对齐移植计划 §5）
const shipTextureCache = new Map();

/**
 * 重置船图纹理缓存（仅供测试使用）
 */
export function resetShipTextureCache() {
  shipTextureCache.clear();
}

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
 * 获取base64图片URL
 * @param {object} element 图片元素（ImageType/ImageData）
 * @returns {string} data URL
 */
const getBase64ImageUrl = (element) => {
  const type =
    SHIP_CONFIG.IMAGE_TYPE_MAP[element.ImageType] ||
    SHIP_CONFIG.DEFAULT_IMAGE_TYPE;
  return `data:image/${type};base64,${element.ImageData}`;
};

/**
 * 绘制船体图片精灵
 * @param {object} params 参数对象
 * @param {object} params.props 组件属性（projectMapLocationInfos/projectImgLst/Clickable）
 * @param {object} params.mapInfo 地图信息对象
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.Map PixiMap 实例（render 触发渲染）
 * @param {Function} params.shipSpritesOnClick 船体点击事件处理函数
 * @param {Function} params.departmentSpritesOnClick 部门点击事件处理函数
 * @param {object} params.spriteState 精灵状态管理对象
 * @param {number} params.angle 当前角度
 * @param {object} params.interactionState 交互状态对象（isDragging/isPinching）
 * @param {object} [params.SPRITE_FRAMES] position 帧数据（{positionSprite: Texture[]}），
 *        省略时从 TextureLoader.getPositionFrames() 获取
 */
export async function drawShipSprites({
  props,
  mapInfo,
  mapContainer,
  Map,
  shipSpritesOnClick,
  departmentSpritesOnClick,
  spriteState,
  angle,
  interactionState,
  SPRITE_FRAMES,
}) {
  // 清空现有精灵
  clearSprites(spriteState.spritesList);
  spriteState.imgLst.length = 0;
  // 验证数据
  if (!props?.projectMapLocationInfos || !props?.projectImgLst) {
    return;
  }
  // 定位纹理与帧数据兜底（幂等：已加载立即返回）
  await loadAllTextures();
  // 准备图片数据
  const imageDataList = prepareShipImageData(props, mapInfo);
  // 加载并绘制船体精灵（共享 ctx 透传，字段与函数签名一一对应）
  await loadAndDrawShipSprites({
    imageDataList,
    projectImgLst: props.projectImgLst,
    spritesList: spriteState.spritesList,
    mapContainer,
    Map,
    mapInfo,
    shipSpritesOnClick,
    departmentSpritesOnClick,
    props,
    spriteState,
    angle,
    interactionState,
    SPRITE_FRAMES: SPRITE_FRAMES || { positionSprite: getPositionFrames() },
  });
}

/**
 * 准备船体图片数据，转换为地图坐标
 * @param {object} props 包含船体位置信息的属性对象
 * @param {object} mapInfo 地图信息对象
 * @returns {object[]} 转换后的船体图片数据数组
 */
const prepareShipImageData = (props, mapInfo) => {
  return props.projectMapLocationInfos.map((element) => {
    const [x, y] = convertLngLatToMapPixel({
      lng: Number(element.CenterX),
      lat: Number(element.CenterY),
      mapInfo,
    });

    return {
      ...element,
      name: element.ShipNo,
      x,
      y,
      shipDirection: element.ShipDirection,
      shipDisplayRatio: element.ShipDisplayRatio,
      shipDisplayRatioEnd: element.ShipDisplayRatioEnd,
      Length: element.Length,
      Width: element.Width,
      Mirror: element.Mirror,
      ProjectInfoID: element.ProjectInfoID,
      Angle: element.Angle,
      ImageID: element.ImageID,
      showPositionSprite: element.showPositionSprite,
    };
  });
};

/**
 * 创建positionSprite动画精灵（v8 AnimatedSprite 直接可用）
 * @param {object} params 参数对象
 * @param {object} params.item 位置数据（ProjectInfoID）
 * @param {object} params.mapInfo 地图信息（Scale）
 * @param {number} params.angle 角度
 * @param {object} params.SPRITE_FRAMES 帧数据（{positionSprite: Texture[]}）
 * @returns {object|null} PIXI.AnimatedSprite
 */
function createPositionSprite({ item, mapInfo, angle, SPRITE_FRAMES }) {
  // 检查帧数据是否存在
  if (
    !SPRITE_FRAMES?.positionSprite ||
    SPRITE_FRAMES.positionSprite.length === 0
  ) {
    console.error("positionSprite帧数据未加载");
    return null;
  }

  // 创建动画精灵
  const animSprite = new AnimatedSprite(SPRITE_FRAMES.positionSprite);
  animSprite.animationSpeed = 0.2;
  animSprite.loop = true;
  animSprite.anchor.set(0.5, 0.5); // 锚点居中（关键）
  animSprite.angle = angle || 0;

  animSprite.x = 2; // 容器已设为item.x，精灵在容器内居中
  animSprite.y = 15; // 仅偏移，不设全局坐标

  animSprite.scale.set(mapInfo?.Scale || 1); // 先应用地图缩放
  animSprite.scale.x *= 50 / animSprite.texture.width; // 固定宽度50（按纹理原始尺寸缩放）
  animSprite.scale.y *= 50 / animSprite.texture.height; // 固定高度50

  // 设置交互属性（v8：eventMode + cursor）与业务字段
  animSprite.projectInfoID = item.ProjectInfoID;
  animSprite.eventMode = "static";
  animSprite.cursor = "pointer";
  animSprite.play();
  return animSprite;
}

/**
 * 获取未加载的纹理元素
 * @param {object[]} projectImgLst 图片列表
 * @returns {object[]} 未加载的元素
 */
const getUnloadedTextureElements = (projectImgLst) => {
  return projectImgLst.filter(
    (element) => !shipTextureCache.has(element.ImageID || element.ID)
  );
};

/**
 * 加载船体纹理（v8：Assets.load 幂等，替代 new PIXI.Loader() 回调链）
 * @param {object[]} unloadedElements 未加载元素
 */
const loadShipTextures = async (unloadedElements) => {
  await Promise.all(
    unloadedElements.map(async (element) => {
      const cacheKey = element.ImageID || element.ID;
      const url = getBase64ImageUrl(element);
      try {
        const texture = await Assets.load(url);
        shipTextureCache.set(cacheKey, texture);
      } catch (e) {
        console.error(`船图${cacheKey}加载失败：`, e);
      }
    })
  );
};

/**
 * 加载并绘制船体精灵
 * @param {object} ctx 透传上下文（字段与 drawShipSpritesInternal 签名一致）
 * @param {object[]} ctx.imageDataList 转换后的船体图片数据
 * @param {object[]} ctx.projectImgLst 图片资源列表
 * @param {object[]} ctx.spritesList 精灵列表
 * @param {object} ctx.mapContainer 地图容器
 * @param {object} ctx.Map PixiMap 实例
 * @param {object} ctx.mapInfo 地图信息
 * @param {Function} ctx.shipSpritesOnClick 船体点击回调
 * @param {Function} ctx.departmentSpritesOnClick 部门点击回调
 * @param {object} ctx.props 组件属性
 * @param {object} ctx.spriteState 精灵状态
 * @param {number} ctx.angle 当前角度
 * @param {object} ctx.interactionState 交互状态
 * @param {object} ctx.SPRITE_FRAMES position 帧数据
 */
const loadAndDrawShipSprites = async ({
  imageDataList,
  projectImgLst,
  spritesList,
  mapContainer,
  Map,
  mapInfo,
  shipSpritesOnClick,
  departmentSpritesOnClick,
  props,
  spriteState,
  angle,
  interactionState,
  SPRITE_FRAMES,
}) => {
  // 获取未加载的纹理元素并补载（幂等）
  const unloadedElements = getUnloadedTextureElements(projectImgLst);
  if (unloadedElements.length > 0) {
    await loadShipTextures(unloadedElements);
  }
  drawShipSpritesInternal({
    imageDataList,
    spritesList,
    mapContainer,
    Map,
    mapInfo,
    shipSpritesOnClick,
    departmentSpritesOnClick,
    props,
    spriteState,
    angle,
    interactionState,
    SPRITE_FRAMES,
  });
};

/**
 * 绘制船体精灵
 * @param {object} ctx 透传上下文（字段与 loadAndDrawShipSprites 一致，除 projectImgLst）
 */
const drawShipSpritesInternal = ({
  imageDataList,
  spritesList,
  mapContainer,
  Map,
  mapInfo,
  shipSpritesOnClick,
  departmentSpritesOnClick,
  props,
  spriteState,
  angle,
  interactionState,
  SPRITE_FRAMES,
}) => {
  imageDataList.forEach((item) => {
    let sprite;

    // 绘制船体精灵
    if (!item.type) {
      sprite = createAndAddShipSprite({
        item,
        spriteState,
        spritesList,
        mapContainer,
        mapInfo,
        props,
        shipSpritesOnClick,
      });
    }

    // 绘制位置标记
    if (item.showPositionSprite) {
      createAndAddShipPositionMarkers({
        item,
        sprite,
        spritesList,
        mapContainer,
        Map,
        mapInfo,
        angle,
        props,
        shipSpritesOnClick,
        departmentSpritesOnClick,
        interactionState,
        SPRITE_FRAMES,
      });
    }
  });

  Map.render?.();
};

/**
 * 创建并添加船体精灵
 * @param {object} params 参数对象
 * @param {object} params.item 船体数据
 * @param {object} params.spriteState 精灵状态管理对象
 * @param {object[]} params.spritesList 精灵列表
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.mapInfo 地图信息
 * @param {object} params.props 组件属性（Clickable）
 * @param {Function} params.shipSpritesOnClick 船体点击回调
 * @returns {object|undefined} 船体精灵（创建失败为 undefined）
 */
const createAndAddShipSprite = ({
  item,
  spriteState,
  spritesList,
  mapContainer,
  mapInfo,
  props,
  shipSpritesOnClick,
}) => {
  spriteState.imgLst.push(item);

  // 获取纹理
  const textureKey = item.ImageID;
  const finalTexture = shipTextureCache.get(textureKey);

  // 创建精灵
  const spriteResources = { [textureKey]: { texture: finalTexture } };
  const sprite = createShipSprite(item, spriteResources, mapInfo);

  // 添加到容器
  if (sprite) {
    if (props.Clickable) {
      sprite.on("pointerdown", () => shipSpritesOnClick(sprite));
    }
    spritesList.push(sprite);
    mapContainer.addChild(sprite);
  } else {
    console.warn("跳过创建失败的船体精灵", item);
  }

  return sprite;
};

/**
 * 创建并添加船体位置标记（静态帧容器 + 定位图标容器）
 * @param {object} params 参数对象
 * @param {object} params.item 位置数据
 * @param {object} [params.sprite] 船体精灵（船体创建失败时为 undefined）
 * @param {object[]} params.spritesList 精灵列表
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.Map PixiMap 实例
 * @param {object} params.mapInfo 地图信息
 * @param {number} params.angle 当前角度
 * @param {object} params.props 组件属性（Clickable）
 * @param {Function} params.shipSpritesOnClick 船体点击回调
 * @param {Function} params.departmentSpritesOnClick 部门点击回调
 * @param {object} params.interactionState 交互状态（isDragging/isPinching）
 * @param {object} params.SPRITE_FRAMES position 帧数据
 */
const createAndAddShipPositionMarkers = ({
  item,
  sprite,
  spritesList,
  mapContainer,
  Map,
  mapInfo,
  angle,
  props,
  shipSpritesOnClick,
  departmentSpritesOnClick,
  interactionState,
  SPRITE_FRAMES,
}) => {
  // 创建容器
  const combinedContainer = new Container();
  const staticContainer = new Container();

  // 设置容器位置和角度
  combinedContainer.x = staticContainer.x = item.x;
  combinedContainer.y = staticContainer.y = item.y;
  combinedContainer.angle = staticContainer.angle = angle || 0;

  // 创建位置精灵
  const positionSprite = createShipPositionSprite(item, mapInfo, 0);
  const positionGifSprite = createPositionSprite({
    item,
    mapInfo,
    angle: 0,
    SPRITE_FRAMES,
  });

  // 设置位置精灵位置
  positionSprite.x = 0;
  positionSprite.y = -35;

  // 创建文本标签
  const text = createShipLabel(item, mapInfo);

  // 添加到容器
  staticContainer.addChild(positionGifSprite);
  combinedContainer.addChild(positionSprite);
  combinedContainer.addChild(text);

  // 设置交互事件
  if (props.Clickable) {
    setContainerInteraction({
      combinedContainer,
      staticContainer,
      item,
      sprite,
      shipSpritesOnClick,
      departmentSpritesOnClick,
    });
  }

  // 添加到地图
  spritesList.push(staticContainer, combinedContainer);
  mapContainer.addChild(staticContainer, combinedContainer);

  // 添加悬停效果
  addSpriteHoverEffect({
    Map,
    parentContainer: mapContainer,
    sprite: combinedContainer,
    state: interactionState,
    options: {
      jumpHeight: SHIP_CONFIG.HOVER_EFFECT.JUMP_HEIGHT,
      jumpDuration: SHIP_CONFIG.HOVER_EFFECT.JUMP_DURATION,
    },
  });
};

/**
 * 创建船体标签
 * @param {object} item 船体数据（name）
 * @param {object} mapInfo 地图信息（Scale）
 * @returns {object} PIXI.Text
 */
const createShipLabel = (item, mapInfo) => {
  const text = new Text(item.name, {
    fontSize: SHIP_CONFIG.LABEL.FONT_SIZE,
    backgroundColor: SHIP_CONFIG.LABEL.BACKGROUND_COLOR,
    fill: SHIP_CONFIG.LABEL.FILL,
  });

  text.anchor.set(0.5, 0.5);
  text.x = SHIP_CONFIG.LABEL.X_OFFSET;
  text.y = SHIP_CONFIG.LABEL.Y_OFFSET;

  if (mapInfo?.Scale) {
    text.scale.x *= mapInfo.Scale;
    text.scale.y *= mapInfo.Scale;
  }

  return text;
};

/**
 * 设置容器交互事件（v8：eventMode + cursor）
 * @param {object} params 参数对象
 * @param {object} params.combinedContainer 组合容器
 * @param {object} params.staticContainer 静态容器
 * @param {object} params.item 位置数据（type）
 * @param {object} [params.sprite] 船体精灵
 * @param {Function} params.shipSpritesOnClick 船体点击回调
 * @param {Function} params.departmentSpritesOnClick 部门点击回调
 */
const setContainerInteraction = ({
  combinedContainer,
  staticContainer,
  item,
  sprite,
  shipSpritesOnClick,
  departmentSpritesOnClick,
}) => {
  combinedContainer.eventMode = staticContainer.eventMode = "static";
  combinedContainer.cursor = staticContainer.cursor = "pointer";

  if (!item.type) {
    combinedContainer.on("pointerdown", () => shipSpritesOnClick(sprite));
    staticContainer.on("pointerdown", () => shipSpritesOnClick(sprite));
  } else if (item.type === "department") {
    combinedContainer.on("pointerdown", () =>
      departmentSpritesOnClick(combinedContainer, item)
    );
    staticContainer.on("pointerdown", () =>
      departmentSpritesOnClick(staticContainer, item)
    );
  }
};

/**
 * 添加精灵悬停跳动效果（悬停置顶 + 沿自身角度方向正弦跳动）
 * @param {object} params 参数对象
 * @param {object} params.Map PixiMap 实例（render 触发渲染）
 * @param {object} params.parentContainer 父容器（层级置顶用）
 * @param {object} params.sprite 目标精灵/容器
 * @param {object} params.state 交互状态（isDragging/isPinching）
 * @param {object} [params.options] 跳动参数 {jumpHeight, jumpDuration, zIndexTop}
 * @returns {{destroy: Function}} 效果销毁句柄
 */
function addSpriteHoverEffect({
  Map,
  parentContainer,
  sprite,
  state,
  options = {},
}) {
  const {
    jumpHeight = SHIP_CONFIG.HOVER_EFFECT.JUMP_HEIGHT,
    jumpDuration = SHIP_CONFIG.HOVER_EFFECT.JUMP_DURATION,
    zIndexTop = SHIP_CONFIG.HOVER_EFFECT.Z_INDEX_TOP,
  } = options;

  const render = () => Map?.render?.();

  // 保存初始状态（含初始角度，确保旋转后跳动方向一致）
  const initialState = {
    zIndex: sprite.zIndex,
    x: sprite.x, // 保存初始X坐标（因为斜向跳动会修改x）
    y: sprite.y,
    angle: sprite.angle, // 保存Sprite初始旋转角度（避免动态旋转影响）
    eventMode: sprite.eventMode,
  };

  let isHovering = false;
  let isJumping = false;
  let animationFrame = null;
  const frameCount = Math.floor(jumpDuration / (1000 / 60));

  sprite.eventMode = "static";
  sprite.cursor = "pointer";

  // 辅助函数：角度转弧度（PIXI的angle是度，数学计算需弧度）
  const degToRad = (deg) => deg * (Math.PI / 180);

  // 核心：根据Sprite角度，计算跳动方向向量（适配任意angle）
  function calculateJumpOffset(progress, jumpHeight) {
    // 1. 计算跳动高度（随缩放自适应）
    const adaptiveJumpHeight = jumpHeight;
    // 2. Sprite旋转角度（转弧度）
    const spriteAngleRad = degToRad(initialState.angle);
    // 3. 计算跳动方向向量：沿Sprite自身Y轴向上（旋转后的「视觉上方」）
    // 原理：旋转角度的垂直方向（Y轴向上）对应向量为 (sinθ, -cosθ)
    const offsetX = Math.sin(spriteAngleRad) * progress * adaptiveJumpHeight;
    const offsetY = -Math.cos(spriteAngleRad) * progress * adaptiveJumpHeight;
    return { offsetX, offsetY };
  }

  function startJumpLoop() {
    // 双重保险：取消旧动画帧
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    if (
      !isHovering ||
      state.isDragging ||
      state.isPinching ||
      sprite.destroyed
    ) {
      isJumping = false;
      // 恢复初始位置（x和y都要恢复，因为斜向跳动修改了x）
      if (!sprite.destroyed) {
        sprite.x = initialState.x;
        sprite.y = initialState.y;
        render();
      }
      return;
    }

    isJumping = true;
    let currentFrame = 0;

    function animateSingleJump() {
      // 中途状态变化，或精灵已销毁（clearSprites 销毁前会移除监听，
      // mouseout 不再触发、isHovering 恒为 true），立即停止避免 rAF 泄漏
      if (
        !isHovering ||
        state.isDragging ||
        state.isPinching ||
        sprite.destroyed
      ) {
        isJumping = false;
        cancelAnimationFrame(animationFrame);
        if (!sprite.destroyed) {
          sprite.x = initialState.x;
          sprite.y = initialState.y;
          render();
        }
        return;
      }

      currentFrame++;
      // 正弦曲线：0→2π 弧度（上跳→下落→回归）
      const progress = Math.sin((currentFrame / frameCount) * Math.PI);
      // 计算适配角度的跳动偏移量
      const { offsetX, offsetY } = calculateJumpOffset(progress, jumpHeight);

      // 更新Sprite位置（基于初始位置+偏移量，避免累积误差）
      sprite.x = initialState.x + offsetX;
      sprite.y = initialState.y + offsetY;

      render();

      // 循环跳动
      animationFrame = requestAnimationFrame(animateSingleJump);
    }

    animateSingleJump();
  }

  sprite.on("mouseover", () => {
    if (state.isDragging || state.isPinching) return;

    isHovering = true;
    isJumping = false; // 重置状态

    // 层级置顶
    parentContainer.sortableChildren = true;
    sprite.zIndex = zIndexTop;
    render();

    if (!isJumping) {
      startJumpLoop();
    }
  });

  sprite.on("mouseout", () => {
    isHovering = false;
    isJumping = false; // 重置状态

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    // 恢复初始位置和层级
    if (!state.isDragging && !state.isPinching) {
      sprite.x = initialState.x;
      sprite.y = initialState.y;
      sprite.zIndex = initialState.zIndex;
      render();
    }
  });

  return {
    destroy: () => {
      isHovering = false;
      isJumping = false;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      sprite.removeAllListeners("mouseover");
      sprite.removeAllListeners("mouseout");
      // 恢复所有初始状态
      sprite.x = initialState.x;
      sprite.y = initialState.y;
      sprite.zIndex = initialState.zIndex;
      sprite.eventMode = initialState.eventMode;
      render();
    },
  };
}

/**
 * 创建船体/部门定位图标精灵
 * @param {object} item 位置数据（type/ProjectInfoID）
 * @param {object} mapInfo 地图信息（Scale）
 * @param {number} angle 角度
 * @returns {object|undefined} PIXI.Sprite（纹理缺失为 undefined，对齐源码）
 */
const createShipPositionSprite = (item, mapInfo, angle) => {
  // 验证资源是否存在（shipPisiton 为源码原拼写）
  let textureKey = "shipPisiton";
  if (item.type === "department") {
    textureKey = "departmentPosition";
  }
  const texture = getTexture(textureKey);
  if (!texture) {
    console.error("船体位置纹理资源未找到");
    return;
  }

  // 创建精灵
  const sprite = new Sprite(texture);
  sprite.x = item.x + SHIP_CONFIG.POSITION_SPRITE.X_OFFSET;
  sprite.y = item.y + SHIP_CONFIG.POSITION_SPRITE.Y_OFFSET;
  sprite.width = SHIP_CONFIG.POSITION_SPRITE.WIDTH;
  sprite.height = SHIP_CONFIG.POSITION_SPRITE.HEIGHT;

  // 应用地图缩放比例（如果需要）
  if (mapInfo?.Scale) {
    sprite.scale.x *= mapInfo.Scale;
    sprite.scale.y *= mapInfo.Scale;
  }

  sprite.anchor.set(0.5, 0.5);
  sprite.angle = angle || 0;

  // 设置交互属性（v8：eventMode + cursor）与业务字段
  sprite.projectInfoID = item.ProjectInfoID;
  sprite.eventMode = "static";
  sprite.cursor = "pointer";

  return sprite;
};

/**
 * 创建船体精灵（纹理裁剪 + 镜像 + 缩放）
 * @param {object} item 船体数据
 * @param {object} resources 纹理资源映射（{[ImageID]: {texture}}）
 * @param {object} mapInfo 地图信息（Scale）
 * @returns {object|null} PIXI.Sprite
 */
const createShipSprite = (item, resources, mapInfo) => {
  // 先校验ImageID是否存在
  if (!item.ImageID) {
    console.warn("创建船体精灵失败：item缺少ImageID", item);
    return null;
  }

  // 取纹理（兼容缓存逻辑的入参）
  const texture = resources[item.ImageID]?.texture;
  if (!texture) {
    console.warn(`未找到ID为${item.ImageID}的船体纹理`, {
      itemImageID: item.ImageID,
      availableResources: Object.keys(resources),
    });
    return null;
  }

  try {
    // 包裹裁剪逻辑，防止裁剪失败导致报错
    const percentage = item.shipDisplayRatioEnd - item.shipDisplayRatio;
    const { croppedTexture } = getCroppedShipTexture(texture, item, percentage);

    // 校验裁剪后的纹理
    if (!croppedTexture) {
      console.warn(`ID为${item.ImageID}的纹理裁剪失败`, item);
      return null;
    }

    // 创建精灵
    const sprite = new Sprite(croppedTexture);
    sprite.x = item.x;
    sprite.y = item.y;

    // 修复大小计算 - 确保与原始行为一致
    const scaleFactor = item.Length / texture.width;
    sprite.scale.x = scaleFactor;
    sprite.scale.y = item.Width / texture.height;

    // 应用镜像和地图缩放
    if (item.Mirror) {
      sprite.scale.x = -sprite.scale.x;
    }

    if (mapInfo?.Scale) {
      sprite.scale.x *= mapInfo.Scale;
      sprite.scale.y *= mapInfo.Scale;
    }

    sprite.anchor.set(0.5, 0.5);
    sprite.angle = item.Angle || 0;

    // 设置交互属性（v8：eventMode + cursor）与业务字段
    sprite.projectInfoID = item.ProjectInfoID;
    sprite.eventMode = "static";
    sprite.cursor = "pointer";

    return sprite;
  } catch (e) {
    // 捕获创建过程中的异常，避免方法直接崩溃
    console.error(`创建ID为${item.ImageID}的船体精灵失败`, e, item);
    return null;
  }
};

/**
 * 获取裁剪后的船体纹理
 * v6 new PIXI.Texture(baseTexture, frame) → v8 new Texture({ source, frame })
 * @param {object} texture 原纹理
 * @param {object} item 船体数据（shipDirection/shipDisplayRatio/shipDisplayRatioEnd）
 * @param {number} percentage 裁剪比例
 * @returns {{croppedTexture: object, cropWidth: number}} 裁剪结果
 */
const getCroppedShipTexture = (texture, item, percentage) => {
  const textureWidth = texture.width;
  const textureHeight = texture.height;

  // 计算裁剪区域
  const cropWidth = textureWidth * percentage;
  const cropHeight = textureHeight;
  const cropX = item.shipDirection
    ? textureWidth * item.shipDisplayRatio
    : textureWidth * (1 - item.shipDisplayRatioEnd);
  const cropY = 0;

  // 创建裁剪区域（v8：Texture 构造参数对象）
  const cropRect = new Rectangle(cropX, cropY, cropWidth, cropHeight);
  return {
    croppedTexture: new Texture({ source: texture.source, frame: cropRect }),
    cropWidth,
  };
};
