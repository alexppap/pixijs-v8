/**
 * FileName: RenderTextureCache.js
 * Author: alexppap
 * Date: 2026-08-24
 * Description: 按 renderer 分桶的 RenderTexture 缓存。RenderTexture 是绑定在
 *              特定 renderer 上的 GPU 资源，app.destroy() 后即失效；SPA 中
 *              路由切走再回来会新建 app，若用单一模块级缓存则会命中已失效的
 *              纹理导致填充异常。以 WeakMap<renderer, Map> 分桶：旧 renderer
 *              不可达时整桶随之回收，并由 PixiMap.destroy 显式释放 GPU 资源。
 *              归入 core（renderer 资源管理），使依赖方向保持 layers → core。
 * Version: 1.0.0
 */

/** renderer → Map<cacheKey, RenderTexture> */
const caches = new WeakMap();

/**
 * 从 PixiMap 实例或直接注入的 renderer 中取出 renderer
 * 注：形参不命名 Map —— 会 shadow 全局 Map 构造器，使内部 new Map() 失败
 * @param {object} pixiMap PixiMap 实例，或含 renderer / app.renderer 的对象
 * @returns {object|null} renderer，取不到为 null
 */
export function resolveRenderer(pixiMap) {
  return pixiMap?.renderer || pixiMap?.app?.renderer || null;
}

/**
 * 取缓存纹理，未命中则经 factory 创建并写入缓存
 * @param {object} pixiMap PixiMap 实例（定位 renderer 分桶）
 * @param {string} cacheKey 缓存键（如 `${color}-${opacity}`）
 * @param {Function} factory (renderer) => RenderTexture，仅未命中时调用
 * @returns {object|null} RenderTexture；无 renderer 或创建失败为 null
 */
export function getOrCreateRenderTexture(pixiMap, cacheKey, factory) {
  const renderer = resolveRenderer(pixiMap);
  if (!renderer) return null;

  let cache = caches.get(renderer);
  if (!cache) {
    cache = new Map();
    caches.set(renderer, cache);
  }

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const texture = factory(renderer);
  if (!texture) return null;

  cache.set(cacheKey, texture);
  return texture;
}

/**
 * 释放指定 renderer 的全部缓存纹理（PixiMap.destroy 调用，须早于
 * app.destroy——之后 renderer 已失效，分桶取不到，GPU 纹理会悬空）
 * @param {object} [pixiMap] PixiMap 实例；取不到 renderer 时无操作
 */
export function releaseRenderTextures(pixiMap) {
  const renderer = resolveRenderer(pixiMap);
  if (!renderer) return;

  const cache = caches.get(renderer);
  if (!cache) return;

  cache.forEach((texture) => {
    try {
      texture?.destroy?.(true);
    } catch (e) {
      console.warn("释放 RenderTexture 失败:", e);
    }
  });
  cache.clear();
  caches.delete(renderer);
}

export default {
  resolveRenderer,
  getOrCreateRenderTexture,
  releaseRenderTextures,
};
