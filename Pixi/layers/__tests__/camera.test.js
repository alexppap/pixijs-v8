/**
 * FileName: camera.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 3.4 —— layers/camera.js 移植测试。验收点：
 *              drawCamera 数据统一（cameraLst / LayerInfos Camera 元素）、
 *              纹理经 TextureLoader 获取（未加载时幂等补载）、精灵位置/
 *              缩放/回填字段、props.ShouldDrawCamera 与 Clickable 分支、
 *              点击弹窗（预览 URL 注入 + 弹窗定位 v8 事件字段）、
 *              deleteCameraLst 的 disposeCamera 注入。
 * Version: 1.0.0
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Container, Texture } from "pixi.js";
import { toRaw } from "vue";

// TextureLoader 打桩：避免真实纹理网络加载
vi.mock("../../core/TextureLoader", () => ({
  loadAllTextures: vi.fn().mockResolvedValue(undefined),
  getTexture: vi.fn(() => Texture.WHITE),
}));

import { loadAllTextures, getTexture } from "../../core/TextureLoader";
import { drawCamera, deleteCameraLst } from "@/components/Pixi/layers/camera";
import { createCameraLstState } from "@/components/Pixi/state/cameraState";

const MAP_INFO = { Origin: { X: 0, Y: 0 }, Scale: 1 };
const DIALOG_DATA = { zoomX: 1, zoomY: 1 };

const buildCamera = () => ({
  id: "cam-1",
  CameraName: "CAM-01",
  Angle: 0,
  MapPoints: [{ X: 10, Y: 20 }],
});

const buildDeps = () => ({
  mapContainer: new Container(),
  cameraLst: [buildCamera()],
  mapInfo: MAP_INFO,
  originScale: { value: 2 },
  scale: { value: 1 },
  DialogData: DIALOG_DATA,
  Map: { render: vi.fn() },
  props: { ShouldDrawCamera: true, Clickable: false },
  cameraLstState: createCameraLstState(),
});

beforeEach(() => {
  vi.clearAllMocks();
  getTexture.mockReturnValue(Texture.WHITE);
});

describe("drawCamera", () => {
  it("绘制摄像头精灵：位置覆盖、缩放按 originScale/2/scale、容器挂载", async () => {
    const deps = buildDeps();

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: deps.cameraLst,
      mapInfo: deps.mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
    });

    expect(deps.cameraLstState.CameraLstPIXI.length).toBe(1);
    // state 数组为 reactive 代理，取原始对象断言
    const sprite = toRaw(deps.cameraLstState.CameraLstPIXI[0]);
    expect(sprite.x).toBe(10);
    expect(sprite.y).toBe(20);
    // scale.set(originScale / 2 / scale)
    expect(sprite.scale.x).toBeCloseTo(1);
    expect(sprite.scale.y).toBeCloseTo(1);
    // 业务字段回填
    expect(sprite.RefObjectID).toBe("cam-1");
    expect(sprite.Name).toBe("CAM-01");
    expect(deps.mapContainer.children).toContain(sprite);
    expect(deps.Map.render).toHaveBeenCalled();
  });

  it("纹理未加载时先 await loadAllTextures 再绘制", async () => {
    const deps = buildDeps();
    getTexture.mockReturnValueOnce(null).mockReturnValue(Texture.WHITE);

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: deps.cameraLst,
      mapInfo: deps.mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
    });

    expect(loadAllTextures).toHaveBeenCalledTimes(1);
    expect(deps.cameraLstState.CameraLstPIXI.length).toBe(1);
  });

  it("ShouldDrawCamera 为 false 时销毁旧实例且不绘制", async () => {
    const deps = buildDeps();

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: deps.cameraLst,
      mapInfo: deps.mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
    });
    expect(deps.cameraLstState.CameraLstPIXI.length).toBe(1);

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: deps.cameraLst,
      mapInfo: deps.mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: { ...deps.props, ShouldDrawCamera: false },
      cameraLstState: deps.cameraLstState,
    });

    expect(deps.cameraLstState.CameraLstPIXI.length).toBe(0);
  });

  it("无摄像头数据（从 LayerInfos 提取亦为空）时仅清理", async () => {
    const deps = buildDeps();

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: [],
      mapInfo: { LayerInfos: [{ Elements: [{ Type: "Polygon" }] }] },
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
    });

    expect(deps.cameraLstState.CameraLstPIXI.length).toBe(0);
    expect(deps.Map.render).not.toHaveBeenCalled();
  });

  it("从 LayerInfos 提取 Type=Camera 元素绘制", async () => {
    const deps = buildDeps();
    const mapInfo = {
      ...MAP_INFO,
      LayerInfos: [
        {
          Elements: [
            {
              Type: "Camera",
              MapPoints: [{ X: 5, Y: 6 }],
              Angle: 0,
              ExtendInfo: { CameraID: "ext-1", CameraName: "EXT-CAM" },
            },
          ],
        },
      ],
    };

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: [],
      mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
    });

    expect(deps.cameraLstState.CameraLstPIXI.length).toBe(1);
    expect(deps.cameraLstState.CameraLstPIXI[0].Name).toBe("EXT-CAM");
  });
});

describe("drawCamera 点击弹窗", () => {
  const drawClickable = async () => {
    const deps = buildDeps();
    deps.props = { ShouldDrawCamera: true, Clickable: true };
    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: deps.cameraLst,
      mapInfo: deps.mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
    });
    return deps;
  };

  it("Clickable 时绑定 pointerdown；未注入查询接口点击不打开浮窗", async () => {
    const deps = await drawClickable();
    const sprite = deps.cameraLstState.CameraLstPIXI[0];
    expect(sprite.listenerCount("pointerdown")).toBe(1);

    sprite.emit("pointerdown", {
      global: { x: 100, y: 200 },
      nativeEvent: { clientX: 500, clientY: 600 },
    });

    await new Promise((r) => setTimeout(r));
    expect(deps.cameraLstState.showCameraLst.length).toBe(0);
  });

  it("注入 deps 后点击打开浮窗并初始化视频（预留回调）", async () => {
    const deps = buildDeps();
    deps.props = { ShouldDrawCamera: true, Clickable: true };
    const queryCameraViewUrl = vi.fn().mockResolvedValue("http://stream/cam1");
    const initVideo = vi.fn();
    const injected = { queryCameraViewUrl, initVideo };

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: deps.cameraLst,
      mapInfo: deps.mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
      deps: injected,
    });

    const sprite = deps.cameraLstState.CameraLstPIXI[0];
    expect(sprite.listenerCount("pointerdown")).toBe(1);

    sprite.emit("pointerdown", {
      global: { x: 100, y: 200 },
      nativeEvent: { clientX: 500, clientY: 600 },
    });

    await new Promise((r) => setTimeout(r));

    expect(queryCameraViewUrl).toHaveBeenCalledWith(deps.cameraLst[0]);
    expect(deps.cameraLstState.showCameraLst.length).toBe(1);
    const panel = deps.cameraLstState.showCameraLst[0];
    // global.x 分支：left = 100 + 20
    expect(panel.left).toBe(120);
    // nativeEvent.clientY 分支：top = 600/1 - 100
    expect(panel.top).toBe(500);
    expect(panel.zIndex).toBe(9999);
    expect(panel.IPAddress).toBe("http://stream/cam1");
    expect(panel.show).toBe(true);
    expect(deps.cameraLst[0].IPAddress).toBe("http://stream/cam1");
    expect(initVideo).toHaveBeenCalledWith(deps.cameraLst[0]);
  });

  it("预览 URL 为空时不打开浮窗", async () => {
    const deps = buildDeps();
    deps.props = { ShouldDrawCamera: true, Clickable: true };

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: deps.cameraLst,
      mapInfo: deps.mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
      deps: { queryCameraViewUrl: vi.fn().mockResolvedValue(null) },
    });

    deps.cameraLstState.CameraLstPIXI[0].emit("pointerdown", {
      global: { x: 1, y: 1 },
      nativeEvent: { clientX: 1, clientY: 1 },
    });
    await new Promise((r) => setTimeout(r));

    expect(deps.cameraLstState.showCameraLst.length).toBe(0);
  });

  it("重复点击已显示摄像头：置 show 并重初始化视频", async () => {
    const deps = buildDeps();
    deps.props = { ShouldDrawCamera: true, Clickable: true };
    const initVideo = vi.fn();
    const queryCameraViewUrl = vi.fn().mockResolvedValue("http://stream/cam1");

    await drawCamera({
      mapContainer: deps.mapContainer,
      cameraLst: deps.cameraLst,
      mapInfo: deps.mapInfo,
      originScale: deps.originScale,
      scale: deps.scale,
      DialogData: deps.DialogData,
      Map: deps.Map,
      props: deps.props,
      cameraLstState: deps.cameraLstState,
      deps: { queryCameraViewUrl, initVideo },
    });

    const sprite = deps.cameraLstState.CameraLstPIXI[0];
    const event = { global: { x: 1, y: 1 }, nativeEvent: { clientX: 1, clientY: 1 } };
    sprite.emit("pointerdown", event);
    await new Promise((r) => setTimeout(r));
    expect(queryCameraViewUrl).toHaveBeenCalledTimes(1);

    // 第二次点击走已存在分支：不再请求 URL
    sprite.emit("pointerdown", event);
    await new Promise((r) => setTimeout(r));
    expect(queryCameraViewUrl).toHaveBeenCalledTimes(1);
    expect(initVideo).toHaveBeenCalledTimes(2);
    expect(deps.cameraLstState.showCameraLst.length).toBe(1);
    expect(deps.cameraLstState.showCameraLst[0].show).toBe(true);
  });
});

describe("deleteCameraLst", () => {
  it("置 show=false 并按注入回调销毁播放器", () => {
    const cameraLstState = createCameraLstState();
    cameraLstState.showCameraLst.push({
      CameraName: "CAM-01",
      IPAddress: "http://s",
      show: true,
    });
    const disposeCamera = vi.fn();

    deleteCameraLst(
      { CameraName: "CAM-01", IPAddress: "http://s" },
      cameraLstState,
      disposeCamera
    );

    expect(cameraLstState.showCameraLst[0].show).toBe(false);
    expect(disposeCamera).toHaveBeenCalledWith({ CameraName: "CAM-01", IPAddress: "http://s" });
  });

  it("无 IPAddress 不触发播放器销毁（video.js 预留）", () => {
    const cameraLstState = createCameraLstState();
    cameraLstState.showCameraLst.push({ CameraName: "CAM-02", show: true });
    const disposeCamera = vi.fn();

    deleteCameraLst({ CameraName: "CAM-02" }, cameraLstState, disposeCamera);

    expect(cameraLstState.showCameraLst[0].show).toBe(false);
    expect(disposeCamera).not.toHaveBeenCalled();
  });
});
