/**
 * FileName: TextureLoader.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: PixiJS v8 纹理与雪碧图加载器（模块级缓存）。由源项目
 *              CSS-Web MapTemplate.vue 的 loadTextures / initPositionSpritesheet /
 *              INTERACTION_CONFIG.TEXTURES 逻辑移植而来，v6 → v8 差异：
 *              PIXI.Loader.shared → Assets.load（按 URL 天然幂等）、
 *              PIXI.Spritesheet(baseTexture, config) → new Spritesheet({ texture, data })、
 *              PIXI.utils.TextureCache → 模块级 Map 缓存。键名与源码
 *              INTERACTION_CONFIG.TEXTURES 保持一致（含 shipPisiton 原拼写）。
 * Version: 1.0.0
 */
import { Assets, Spritesheet } from "pixi.js";
import cameraUrl from "../assets/imgs/camera.png";
import shipPositionUrl from "../assets/imgs/shipPosition.png";
import departmentPositionUrl from "../assets/imgs/departmentPosition.png";
import pingbancheUrl from "../assets/imgs/pingbanche.png";
import pingbancheceUrl from "../assets/imgs/pingbanchece.png";
import arrowBlueUrl from "../assets/imgs/arrow-blue.png";
import positionPngUrl from "../assets/imgs/position.png";
import positionJson from "../assets/imgs/position.json";

// ------------------------------
// 常量定义
// ------------------------------
/**
 * 普通单张纹理键 → 资源 URL 映射
 * （键名对齐源项目 INTERACTION_CONFIG.TEXTURES，shipPisiton 为源码原拼写）
 */
const TEXTURE_URLS = {
  camera: cameraUrl,                       // 摄像头图标
  shipPisiton: shipPositionUrl,            // 船舶定位图标
  departmentPosition: departmentPositionUrl, // 部门定位图标
  pingbanche: pingbancheUrl,               // 平板车（正）
  pingbanchece: pingbancheceUrl,           // 平板车（侧）
  blueArrow: arrowBlueUrl,                 // 路线箭头
};

/** position 雪碧图目标帧数量（frame1..frame60 有序） */
const POSITION_FRAME_COUNT = 60;

// ------------------------------
// 模块级缓存
// ------------------------------
const textureCache = new Map(); // 已加载纹理：key → Texture
let positionFrames = null; // position 雪碧图帧纹理有序数组（初始化失败为 null）
let loadAllPromise = null; // loadAllTextures 进行中的 Promise（幂等）
let spritesheetPromise = null; // initPositionSpritesheet 进行中的 Promise（幂等）

// ------------------------------
// 单张纹理加载
// ------------------------------
/**
 * 加载全部普通单张纹理（幂等：进行中/已完成时重复调用复用同一 Promise，
 * Assets.load 亦按 URL 幂等，不产生重复网络请求）。
 * 单张失败不阻断其余纹理，失败项以 warn 记录且不写入缓存。
 * @returns {Promise<Map<String, Texture>>} 纹理缓存（key → Texture）
 */
export async function loadAllTextures() {
  if (loadAllPromise) return loadAllPromise;

  loadAllPromise = (async () => {
    const entries = await Promise.all(
      Object.entries(TEXTURE_URLS).map(async ([key, url]) => {
        try {
          const texture = await Assets.load(url);
          return [key, texture];
        } catch (err) {
          console.error(`纹理${key}加载失败：`, err);
          return null;
        }
      })
    );
    entries.forEach((entry) => {
      if (entry) textureCache.set(entry[0], entry[1]);
    });
    return textureCache;
  })();

  return loadAllPromise;
}

/**
 * 同步获取已加载的纹理
 * @param {String} key - 纹理键（TEXTURE_URLS 的键，如 'camera'）
 * @returns {import('pixi.js').Texture|null} 纹理对象，未加载/加载失败返回 null
 */
export function getTexture(key) {
  const texture = textureCache.get(key);
  if (!texture) {
    console.warn(`纹理"${key}"尚未加载，请先调用 loadAllTextures()`);
  }
  return texture ?? null;
}

// ------------------------------
// position 雪碧图
// ------------------------------
/**
 * 初始化 position 雪碧图并解析 60 帧纹理（幂等：重复调用复用同一 Promise）
 * v8 写法：new Spritesheet({ texture, data }) + await sheet.parse()
 * @returns {Promise<Array<Texture>|null>} 帧纹理有序数组（frame1..frame60），
 *                                          初始化失败返回 null
 */
export async function initPositionSpritesheet() {
  if (positionFrames) return positionFrames;
  if (spritesheetPromise) return spritesheetPromise;

  spritesheetPromise = (async () => {
    try {
      // 加载雪碧图底图纹理（Assets 按 URL 幂等，重复调用不重复请求）
      const baseTexture = await Assets.load(positionPngUrl);

      const spritesheet = new Spritesheet({
        texture: baseTexture,
        data: {
          frames: positionJson.frames,
          meta: positionJson.meta,
        },
      });
      await spritesheet.parse();

      // 按 frame1..frame60 顺序收集帧纹理
      const frames = [];
      for (let i = 1; i <= POSITION_FRAME_COUNT; i++) {
        const frameTexture = spritesheet.textures[`frame${i}`];
        if (frameTexture) {
          frames.push(frameTexture);
        } else {
          console.warn(`position雪碧图缺少帧：frame${i}`);
        }
      }

      positionFrames = frames.length ? frames : null;
      if (!positionFrames) {
        console.error("position雪碧图帧初始化失败：未解析到任何帧");
      }
      return positionFrames;
    } catch (error) {
      console.error("position雪碧图初始化失败：", error);
      positionFrames = null;
      return null;
    }
  })();

  return spritesheetPromise;
}

/**
 * 同步获取 position 雪碧图帧纹理（须先 await initPositionSpritesheet()）
 * @returns {Array<Texture>|null} 帧纹理有序数组，未初始化/失败返回 null
 */
export function getPositionFrames() {
  return positionFrames;
}

/**
 * 重置模块级缓存（仅供测试使用，运行期一般无需调用）
 */
export function resetTextureCache() {
  textureCache.clear();
  positionFrames = null;
  loadAllPromise = null;
  spritesheetPromise = null;
}

export default {
  loadAllTextures,
  getTexture,
  initPositionSpritesheet,
  getPositionFrames,
  resetTextureCache,
};
