/**
 * FileName: WebGLGuard.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: WebGL 稳定性保障（PixiJS v8）。由源项目 CSS-Web MapTemplate.vue 的
 *              webglcontextlost/restored 监听（789–799）、keepAlive 定时渲染
 *              （1318–1323）、visibilitychange 长时间隐藏重载（2730–2741）、
 *              __webglDebug 调试对象（1325–1363）移植而来。差异说明：
 *              contextrestored 沿用源码 location.reload() 整页重载策略；
 *              keepAlive 渲染在 autoStart 常驻渲染模式下冗余但无害，保留以
 *              兼容按需渲染切换；__webglDebug 仅开发环境（DEV）挂载。
 * Version: 1.0.0
 */

/** 页面隐藏超过该时长（2小时）恢复时整页重载 */
const HIDDEN_RELOAD_THRESHOLD = 2 * 60 * 60 * 1000;

/** keepAlive 定时渲染间隔（1分钟） */
const KEEP_ALIVE_INTERVAL = 1 * 60 * 1000;

/**
 * 创建 WebGL 稳定性保障实例
 * @param {Object} pixiMap - PixiMap 实例（须已完成 init）
 * @returns {Object|null} { destroy }，依赖缺失返回 null
 */
export function createWebGLGuard(pixiMap) {
  if (!pixiMap?.app || !pixiMap.view) {
    console.error("createWebGLGuard: PixiMap 未完成初始化");
    return null;
  }

  const canvas = pixiMap.view;
  let keepAliveInterval = null; // keepAlive 定时器
  let hiddenTime = null; // 页面隐藏起始时间戳（null 表示未经历过隐藏）

  // ------------------------------
  // WebGL 上下文丢失/恢复
  // ------------------------------
  const handleContextLost = (e) => {
    e.preventDefault(); // 阻止默认行为，允许恢复
    console.warn("WebGL 上下文丢失，等待恢复...");
  };

  const handleContextRestored = () => {
    console.log("WebGL 上下文已恢复，重新渲染地图...");
    // 沿用源码策略：整页重载，保证所有纹理与渲染状态一致
    location.reload();
  };

  // ------------------------------
  // keepAlive 定时渲染
  // ------------------------------
  keepAliveInterval = setInterval(() => {
    if (pixiMap.app) {
      pixiMap.render();
    }
  }, KEEP_ALIVE_INTERVAL);

  // ------------------------------
  // 页面长时间隐藏后重载
  // ------------------------------
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      hiddenTime = Date.now();
    } else if (document.visibilityState === "visible") {
      // 未经历过隐藏（如隐藏状态下预加载）时不触发重载
      if (hiddenTime === null) return;
      const elapsed = Date.now() - hiddenTime;
      if (elapsed > HIDDEN_RELOAD_THRESHOLD) {
        location.reload();
      }
    }
  };

  // ------------------------------
  // 事件绑定
  // ------------------------------
  canvas.addEventListener("webglcontextlost", handleContextLost);
  canvas.addEventListener("webglcontextrestored", handleContextRestored);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // ------------------------------
  // 调试对象（仅 DEV 挂载，供模拟上下文丢失/恢复验证）
  // 用法：window.__webglDebug.lose() / window.__webglDebug.restore()
  // ------------------------------
  if (import.meta.env.DEV) {
    window.__webglDebug = {
      // 缓存扩展对象，避免重复调用 getExtension
      _ext: null,

      // 初始化：获取扩展并校验 WebGL 上下文
      _init() {
        const gl = pixiMap.app?.renderer?.gl;
        if (!gl) {
          console.error("WebGL 上下文获取失败：renderer.gl 不存在");
          return null;
        }
        this._ext = gl.getExtension("WEBGL_lose_context");
        if (!this._ext) {
          console.warn(
            "WEBGL_lose_context 扩展不受支持：当前浏览器/环境不支持该调试扩展"
          );
        }
        return this._ext;
      },

      // 主动丢失上下文
      lose() {
        const ext = this._init();
        if (ext) {
          ext.loseContext();
          console.log("已主动触发 WebGL 上下文丢失");
        }
      },

      // 主动恢复上下文
      restore() {
        const ext = this._init();
        if (ext) {
          ext.restoreContext();
          console.log("已恢复 WebGL 上下文");
        }
      },
    };
  }

  return {
    /**
     * 移除全部监听与定时器，清理调试对象，释放资源
     */
    destroy() {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      if (import.meta.env.DEV && window.__webglDebug) {
        delete window.__webglDebug;
      }
    },
  };
}

export default createWebGLGuard;
