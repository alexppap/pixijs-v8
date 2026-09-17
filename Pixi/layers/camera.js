/**
 * FileName: camera.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 摄像头绘制层。由源项目 CSS-Web public/js/map/camera.js
 *              （415 行）移植（v6 → v8）：
 *              - PIXI.Loader.shared.resources['camera'] / 回调式重载 →
 *                TextureLoader.getTexture('camera') + await loadAllTextures()
 *                （幂等，无需源码的防重复添加逻辑）
 *              - event.data.global / event.data.originalEvent →
 *                event.global / event.nativeEvent（v8 FederatedEvent 字段更名）
 *              - 源 getCameraPositionTop 首分支 event.data.global.y?.clientY
 *                恒为 undefined（死分支），移植其生效路径
 *              - hls.js / video.js 不引入（移植计划 §7）：视频初始化以
 *                deps.initVideo 回调注入（阶段 6 CameraPanel.vue 接入），
 *                预览 URL 查询以 deps.queryCameraViewUrl 注入
 *              - destroyAllCameras 清空改用 length = 0（保持 reactive 数组引用）
 * Version: 1.0.0
 */
import { createSprite } from "../utils/mapUtils";
import { loadAllTextures, getTexture } from "../core/TextureLoader";

// 常量定义
const CAMERA_WIDTH = 100;
const CAMERA_HEIGHT = 100;
const CAMERA_ZINDEX_START = 9999;
const CAMERA_TEXTURE_NAME = "camera";

/**
 * 获取摄像头数据（统一处理不同来源的数据）
 * @param {object[]} cameraLst 摄像头数据列表
 * @param {object} mapInfo 地图信息（LayerInfos）
 * @returns {object[]} 统一格式的摄像头数据列表
 */
const getCameraData = (cameraLst, mapInfo) => {
  if (cameraLst && cameraLst.length) {
    return cameraLst;
  }

  // 从图层信息中提取摄像头数据
  if (mapInfo.LayerInfos && Array.isArray(mapInfo.LayerInfos)) {
    return mapInfo.LayerInfos.map((layer) => {
      const cameraElements = (layer.Elements || []).filter(
        (element) => element.Type === "Camera"
      );

      // 统一数据格式
      return cameraElements.map((item) => ({
        ...item,
        id: item.ExtendInfo?.CameraID,
        CameraName: item.ExtendInfo?.CameraName,
      }));
    })
      .flat()
      .filter(Boolean); // 过滤无效数据
  }

  return [];
};

/**
 * 销毁所有摄像头实例（保持 reactive 数组引用，用 length 清空）
 * @param {object} cameraLstState 摄像头状态
 */
const destroyAllCameras = (cameraLstState) => {
  if (cameraLstState.CameraLstPIXI && cameraLstState.CameraLstPIXI.length) {
    cameraLstState.CameraLstPIXI.forEach((item) => {
      if (item && typeof item.destroy === "function") {
        item.destroy();
      }
    });
    cameraLstState.CameraLstPIXI.length = 0;
  }
};

/**
 * 创建摄像头精灵
 * @param {object} params 参数对象
 * @param {object} params.camera 摄像头数据
 * @param {object} params.texture 摄像头纹理
 * @param {object} params.originScale 原始缩放比例（ref）
 * @param {object} params.scale 当前缩放比例（ref）
 * @param {object} params.mapInfo 地图信息
 * @param {object} params.DialogData 对话框数据
 * @param {object} params.props 组件属性
 * @param {object} params.cameraLstState 摄像头状态
 * @param {object} params.deps 注入依赖
 * @returns {object|null} PIXI.Sprite 摄像头精灵实例
 */
const createCameraSprite = ({
  camera,
  texture,
  originScale,
  scale,
  mapInfo,
  DialogData,
  props,
  cameraLstState,
  deps,
}) => {
  // 准备createSprite方法所需的数据格式
  const spriteItem = {
    ...camera,
    // 确保包含createSprite方法所需的属性
    ImageID: CAMERA_TEXTURE_NAME,
    Length: CAMERA_WIDTH,
    Width: CAMERA_HEIGHT,
    CenterY: camera.CenterY || camera.Latitude || camera.MapPoints[0].Y,
    CenterX: camera.CenterX || camera.Longitude || camera.MapPoints[0].X,
    Mirror: false,
    Angle: camera.Angle || 0,
    RefObjectID: camera.id || camera.RefObjectID,
    Name: camera.CameraName || camera.Name,
  };

  // 使用mapUtils.js中的createSprite方法创建精灵
  const iconSprite = createSprite(spriteItem, { [CAMERA_TEXTURE_NAME]: texture }, mapInfo);
  if (!iconSprite) return null;

  // 调整精灵的缩放比例，以适应camera.js中的需求
  iconSprite.scale.set(originScale.value / 2 / scale.value);

  // 如果有MapPoints，覆盖位置
  if (camera.MapPoints && camera.MapPoints[0]) {
    iconSprite.x = camera.MapPoints[0].X;
    iconSprite.y = camera.MapPoints[0].Y;
  }

  // 绑定点击事件
  if (props.Clickable) {
    iconSprite.on("pointerdown", (event) =>
      handleCameraClick({ event, camera, DialogData, cameraLstState, deps })
    );
  }

  return iconSprite;
};

/**
 * 计算摄像头弹窗左侧位置
 * v8 差异：event.data.global → event.global
 * @param {object} event v8 FederatedPointerEvent
 * @param {object} DialogData 对话框数据
 * @returns {number} 弹窗左侧位置
 */
const getCameraPositionLeft = (event, DialogData) => {
  if (event.global?.x) {
    return (event.global.x || 0) + 20;
  }
  if (event.nativeEvent?.clientX) {
    return event.nativeEvent.clientX / (DialogData.zoomX || 1);
  }
  return 0;
};

/**
 * 计算摄像头弹窗顶部位置
 * 源码首分支 event.data.global.y?.clientY 恒为 undefined（死分支），
 * 此处直接移植生效路径：clientY / zoomY - 100
 * @param {object} event v8 FederatedPointerEvent
 * @param {object} DialogData 对话框数据
 * @returns {number} 弹窗顶部位置
 */
const getCameraPositionTop = (event, DialogData) => {
  if (event.nativeEvent?.clientY) {
    return event.nativeEvent.clientY / (DialogData.zoomY || 1) - 100;
  }
  return 0;
};

/**
 * 处理摄像头点击事件
 * @param {object} params 参数对象
 * @param {object} params.event v8 FederatedPointerEvent
 * @param {object} params.camera 摄像头数据
 * @param {object} params.DialogData 对话框数据
 * @param {object} params.cameraLstState 摄像头状态
 * @param {object} params.deps 注入依赖
 * @param {Function} [params.deps.queryCameraViewUrl] 预览 URL 查询 (camera) => Promise<string|null>
 * @param {Function} [params.deps.initVideo] 视频播放初始化（hls.js/video.js 未引入，预留）
 */
const handleCameraClick = ({
  event,
  camera,
  DialogData,
  cameraLstState,
  deps,
}) => {
  // 检查是否已在显示列表中
  const existingCamera = cameraLstState.showCameraLst.find(
    (item) => item.CameraName === camera.CameraName
  );

  if (existingCamera) {
    // 如果已存在，显示它
    existingCamera.show = true;
    if (camera.IPAddress) {
      deps?.initVideo?.(camera);
    }
    return;
  }

  // 新摄像头，获取预览URL（接口经依赖注入，源 API.QueryMapCameraViewUrl）
  if (typeof deps?.queryCameraViewUrl !== "function") {
    console.warn("未注入 queryCameraViewUrl，忽略摄像头点击");
    return;
  }

  deps
    .queryCameraViewUrl(camera)
    .then((previewUrl) => {
      if (!previewUrl) {
        console.error("获取摄像头预览URL失败");
        return;
      }

      camera.IPAddress = previewUrl;

      // 添加到显示列表
      cameraLstState.showCameraLst.push({
        zIndex: cameraLstState.showCameraLst.length + CAMERA_ZINDEX_START,
        id: camera.CameraName,
        CameraName: camera.CameraName,
        IPAddress: previewUrl,
        width: 370,
        left: getCameraPositionLeft(event, DialogData),
        top: getCameraPositionTop(event, DialogData),
        show: true,
      });

      // 初始化视频播放（预留）
      deps?.initVideo?.(camera);
    })
    .catch((error) => {
      console.error("获取摄像头预览URL异常:", error);
    });
};

/**
 * 绘制摄像头到地图上（含纹理加载，幂等）
 * @param {object} params 参数对象
 * @param {object} params.mapContainer 地图容器
 * @param {object[]} params.cameraLst 摄像头数据列表
 * @param {object} params.mapInfo 地图信息
 * @param {object} params.originScale 原始缩放比例（ref）
 * @param {object} params.scale 当前缩放比例（ref）
 * @param {object} params.DialogData 对话框数据
 * @param {object} params.props 组件属性（ShouldDrawCamera/Clickable）
 * @param {object} params.cameraLstState 摄像头状态
 * @param {object} [params.deps] 注入依赖
 * @param {Function} [params.deps.queryCameraViewUrl] 预览 URL 查询
 * @param {Function} [params.deps.initVideo] 视频播放初始化（预留）
 */
export async function drawCamera({
  mapContainer,
  cameraLst,
  mapInfo,
  originScale,
  scale,
  DialogData,
  props,
  cameraLstState,
  deps = {},
}) {
  // 检查是否应该绘制摄像头
  if (!props.ShouldDrawCamera) {
    console.log("未启用摄像头绘制");
    // 即使不绘制，也要销毁旧的摄像头实例
    destroyAllCameras(cameraLstState);
    return;
  }

  // 获取摄像头数据（统一处理不同来源的数据）
  const cameraData = getCameraData(cameraLst, mapInfo);

  if (!cameraData || cameraData.length === 0) {
    console.log("没有摄像头数据可绘制");
    // 没有数据时，销毁旧的摄像头实例
    destroyAllCameras(cameraLstState);
    return;
  }

  // 获取摄像头纹理（v8：TextureLoader 模块级缓存，未加载时幂等补载）
  let texture = getTexture(CAMERA_TEXTURE_NAME);
  if (!texture) {
    console.warn("摄像头纹理资源未加载，尝试重新加载");
    await loadAllTextures();
    texture = getTexture(CAMERA_TEXTURE_NAME);
  }
  if (!texture) {
    console.error("摄像头纹理资源加载失败");
    return;
  }

  // 销毁现有摄像头实例
  destroyAllCameras(cameraLstState);

  cameraData.forEach((camera, index) => {
    try {
      // 创建摄像头精灵并添加到容器
      const cameraSprite = createCameraSprite({
        camera,
        texture,
        originScale,
        scale,
        mapInfo,
        DialogData,
        props,
        cameraLstState,
        deps,
      });
      if (cameraSprite) {
        mapContainer.addChild(cameraSprite);
        cameraLstState.CameraLstPIXI.push(cameraSprite);
      }
    } catch (error) {
      console.error(`绘制摄像头 ${index} 失败:`, error);
    }
  });
}

/**
 * 删除摄像头列表项（video.js 播放器销毁经 disposeCamera 注入，预留）
 * @param {object} caption 摄像头信息（CameraName/IPAddress）
 * @param {object} cameraLstState 摄像头状态
 * @param {Function} [disposeCamera] 播放器销毁回调 (caption) => void
 */
export function deleteCameraLst(caption, cameraLstState, disposeCamera) {
  const camera = cameraLstState.showCameraLst.find(
    (item) => item.CameraName === caption.CameraName
  );
  if (camera) camera.show = false;

  if (caption.IPAddress) {
    // video.js 播放器销毁：阶段 6 CameraPanel.vue 接入，当前回调注入
    disposeCamera?.(caption);
  }
}
