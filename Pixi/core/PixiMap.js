/**
 * FileName: PixiMap.js
 * Author: alexppap
 * Date: 2026-08-18
 * Description: PixiJS v8 应用封装类。负责 PIXI Application 的创建、初始化、
 *              画布挂载、容器尺寸适配、场景容器（mapContainer）创建与资源销毁，
 *              供地图类组件（如 MapTemplate.vue）复用。2026-08-21 新增
 *              exportAsPNG（移植自源 exportMapAsPNG，v8 app.extract.canvas）。
 * Version: 1.4.0
 */
import { Application, Container } from "pixi.js";
import { createMapInteraction } from "./MapInteraction";
import { releaseRenderTextures } from "./RenderTextureCache";

class PixiMap {
  /**
   * @param {Object} options - 应用配置
   * @param {Number} options.width - 画布初始宽度
   * @param {Number} options.height - 画布初始高度
   * @param {Number} options.backgroundColor - 画布背景色
   * @param {Boolean} options.antialias - 是否开启抗锯齿
   * @param {Object} options.interaction - 地图交互配置（传 false 可禁用自动交互），
   *   见 MapInteraction.js DEFAULT_OPTIONS（minScale/maxScale/onScaleChange/onDrag 等）
   */
  constructor(options = {}) {
    this.options = options; // 应用配置
    this.app = null; // PIXI 应用实例
    this.mapContainer = null; // 地图场景容器（图形绘制与交互变换均在此容器上）
    this.interaction = null; // 地图交互实例（拖拽/缩放，init 时自动创建）
  }

  /**
   * 创建并初始化 PIXI 应用，挂载画布到指定容器元素，
   * 并按容器实际尺寸适配画布、创建场景容器
   * @param {String} containerId - 容器元素ID
   * @returns {Promise<Boolean>} 初始化是否成功
   */
  async init(containerId) {
    const containerEl = document.getElementById(containerId);
    if (!containerEl) {
      console.error(`未找到ID为${containerId}的容器元素`);
      return false;
    }
    this.app = new Application();
    await this.app.init({
      width: this.options.width || 100,
      height: this.options.height || 100,
      background: this.options.backgroundColor ?? 0x062947,
      antialias: this.options.antialias ?? true,
      // 常驻渲染：ticker 每帧自动渲染，全库不再手动调用 render()
      autoStart: true,
      // 跟随显示器 DPR，上限 2：DPR=1 的屏幕不白付 4 倍像素填充，
      // DPR=3 的移动端也不因固定 2 而模糊
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true, // canvas 的 CSS 尺寸自动保持逻辑像素，resize/交互坐标不受影响
    });
    containerEl.appendChild(this.app.canvas);

    // 用容器实际尺寸初始化画布，避免硬编码尺寸导致下方留白
    const rect = containerEl.getBoundingClientRect();
    this.resize(
      Math.max(1, Math.floor(rect.width)),
      Math.max(1, Math.floor(rect.height))
    );

    // 创建中间场景容器：图形绘制与拖拽/缩放变换均在 mapContainer 上，
    // 与 stage（画布根）解耦，便于后续叠加 HUD/覆盖层等不随地图联动的元素
    this.mapContainer = new Container();
    this.mapContainer.sortableChildren = true;
    this.mapContainer.eventMode = "static";
    this.app.stage.addChild(this.mapContainer);

    // 初始化完成后自动绑定地图交互（拖拽/滚轮缩放/触摸捏合），传 false 可禁用
    if (this.options.interaction !== false) {
      this.interaction = createMapInteraction(
        this,
        this.options.interaction || {}
      );
    }

    return true;
  }

  /**
   * 画布逻辑尺寸（渲染器屏幕尺寸，单位为逻辑像素，与CSS尺寸一致）
   * 注：init/resize 已按容器实际尺寸适配画布，坐标适配计算应以此为准
   */
  get screenSize() {
    return this.app?.screen ?? null;
  }

  /**
   * 画布元素（用于绑定/移除DOM交互事件）
   * 注：Pixi v8 中 Application.view 已弃用，等价属性为 canvas
   */
  get view() {
    return this.app?.canvas ?? null;
  }

  /**
   * 调整画布尺寸
   * @param {Number} width - 目标宽度
   * @param {Number} height - 目标高度
   */
  resize(width, height) {
    if (!this.app) return;
    this.app.renderer.resize(width, height);
  }

  /**
   * 将 displayObject 居中到画布可见区域（基于 pivot），
   * 可选等比缩放至适配页面。保留对象自身旋转（angle），
   * 适配与居中均按旋转后的实际包围盒计算：
   * 1. 将未旋转局部包围盒按 angle 旋转，求轴对齐包围盒（AABB）尺寸；
   * 2. 以该尺寸对页面宽高做 fitScale 适配（取宽高较小缩放比）；
   * 3. 将旋转后的包围盒中心（绕 pivot 旋转后的原中心）对准画布中心。
   * 注：居中计算基于 mapContainer 的变换（拖拽/缩放作用于该容器）
   * @param {Object} params - 参数对象
   * @param {import('pixi.js').Container} params.displayObject - 要居中的对象（应添加到 mapContainer）
   * @param {Number} [params.pivotX] - 可选：指定 pivot.x，省略则保留对象当前 pivot
   * @param {Number} [params.pivotY] - 可选：指定 pivot.y，省略则保留对象当前 pivot
   * @param {Number} [params.fitScale] - 可选：0~1，按旋转后包围盒等比缩放使对象在此比例内
   *                              完全可见（取宽高较小缩放比）
   */
  centerOnCanvas({ displayObject, pivotX, pivotY, fitScale }) {
    if (!this.mapContainer || !displayObject) return;

    const screen = this.screenSize;
    const container = this.mapContainer;
    const sx = container.scale.x || 1;
    const sy = container.scale.y || 1;

    // 设置 pivot（同时也是旋转的中心）
    if (pivotX !== undefined && pivotY !== undefined) {
      displayObject.pivot.set(pivotX, pivotY);
    }

    // 画布中心 → mapContainer 局部坐标（反算容器的位移和缩放）
    const centerLocalX = (screen.width / 2 - container.position.x) / sx;
    const centerLocalY = (screen.height / 2 - container.position.y) / sy;

    const bounds = displayObject.getLocalBounds();
    if (bounds.width <= 0 || bounds.height <= 0) {
      // 无有效包围盒时仅按 pivot 居中
      displayObject.position.set(centerLocalX, centerLocalY);
      return;
    }

    const rad = displayObject.rotation;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const pivotXNow = displayObject.pivot.x;
    const pivotYNow = displayObject.pivot.y;

    // 按旋转后包围盒做整个页面宽高 fitScale 适配（|cos|/|sin| 求 AABB 尺寸）
    if (fitScale !== undefined && fitScale > 0) {
      const absCos = Math.abs(cos);
      const absSin = Math.abs(sin);
      const rotatedW = bounds.width * absCos + bounds.height * absSin;
      const rotatedH = bounds.width * absSin + bounds.height * absCos;
      const ratio = Math.min(
        (screen.width * fitScale) / (rotatedW * sx),
        (screen.height * fitScale) / (rotatedH * sy)
      );
      displayObject.scale.set(ratio);
    }

    // 旋转后的包围盒中心（局部坐标）：原中心绕 pivot 旋转得到，
    // 再乘 scale 得到相对 position 的偏移，用画布中心减去该偏移即完成居中
    const dx = bounds.x + bounds.width / 2 - pivotXNow;
    const dy = bounds.y + bounds.height / 2 - pivotYNow;
    const scaleNow = displayObject.scale.x;
    const offsetRotX = (dx * cos - dy * sin) * scaleNow;
    const offsetRotY = (dx * sin + dy * cos) * scaleNow;

    displayObject.position.set(
      centerLocalX - offsetRotX,
      centerLocalY - offsetRotY
    );
  }

  /**
   * 强制同步渲染一帧。
   * 应用以 autoStart: true 创建（常驻渲染），ticker 每帧自动渲染，
   * 因此业务代码无需调用本方法——状态改完等下一帧即可。
   * 仅在需要"此刻画面已落到 GPU"的同步场景使用（如 exportAsPNG 前）。
   */
  render() {
    if (!this.app) return;
    this.app.render();
  }

  /**
   * 将指定容器导出为 PNG 并触发下载
   * 移植自源 MapTemplate.vue exportMapAsPNG（v6 renderer.extract.canvas()
   * → v8 app.extract.canvas(container)）
   * @param {import('pixi.js').Container} [container] - 要导出的容器，
   *        省略时导出地图场景容器 mapContainer
   * @param {String} [fileName] - 下载文件名（默认 map.png）
   * @returns {Promise<Boolean>} 导出是否成功
   */
  async exportAsPNG(container, fileName = "map.png") {
    if (!this.app) {
      console.error("exportAsPNG: 未找到渲染器实例");
      return false;
    }

    const target = container || this.mapContainer;
    if (!target) {
      console.error("exportAsPNG: 未找到导出目标容器");
      return false;
    }

    try {
      // 强制渲染一帧，确保导出内容包含本轮所有状态变更
      // （常驻渲染每帧自动出图，但 extract 是同步调用，需先落帧）
      this.app.render();

      // 使用 canvas 提取方式，兼容性更好
      const canvas = this.app.extract.canvas(target);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error("生成图片失败");
            resolve(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();

          // 清理资源
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          resolve(true);
        }, "image/png");
      });
    } catch (error) {
      console.error("导出PNG失败：", error);
      return false;
    }
  }

  /**
   * 销毁交互实例、场景容器与PIXI应用，释放资源
   */
  destroy() {
    if (this.interaction) {
      this.interaction.destroy();
      this.interaction = null;
    }
    // 释放绑定在本 renderer 上的 RenderTexture 缓存。必须早于
    // app.destroy()——之后 renderer 已失效，按 renderer 分桶的缓存取不到，
    // GPU 纹理会悬空并在 SPA 路由往返时被误命中
    releaseRenderTextures(this);
    if (this.mapContainer) {
      this.mapContainer.removeAllListeners();
      this.mapContainer.destroy({ children: true });
      this.mapContainer = null;
    }
    if (this.app) {
      this.app.destroy(true, {
        children: true,
        texture: true,
        textureSource: true,
      });
      this.app = null;
    }
  }
}

export default PixiMap;
