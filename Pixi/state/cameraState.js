/**
 * FileName: cameraState.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 摄像头状态工厂。由源项目 CSS-Web public/js/map/camera.js 的
 *              createCameraLstState 移植，实例间隔离；补 destroy()：
 *              showCameraLst 的 video.js 播放器清理以 disposeCamera 回调
 *              注入（阶段 3 camera.js / 阶段 6 CameraPanel.vue 接入，当前
 *              预留），CameraLstPIXI 逐项 destroy({children:true}) 后清空。
 * Version: 1.0.0
 */
import { reactive } from "vue";

/**
 * 创建独立的摄像头状态对象
 * @returns {object} 摄像头状态对象（含 destroy），字段：
 *   CameraLstPIXI - 地图上的摄像头精灵实例列表
 *   showCameraLst - 显示中的摄像头视频列表
 */
export function createCameraLstState() {
  const state = {
    CameraLstPIXI: reactive([]), // 地图上的摄像头精灵实例列表
    showCameraLst: reactive([]), // 显示中的摄像头视频列表
  };

  return {
    ...state,

    /**
     * 销毁池内显示对象并清空列表
     * @param {object} [options] 销毁选项
     * @param {Function} [options.disposeCamera] video.js 播放器销毁回调
     *   (camera) => void，对应源码 videojs(getElementById(CameraName)).dispose()
     */
    destroy(options = {}) {
      const { disposeCamera } = options;

      // 清理 Video.js 播放器实例（对齐源清理链 2787–2796，回调注入）
      state.showCameraLst.forEach((camera) => {
        if (camera.IPAddress) {
          try {
            disposeCamera?.(camera);
          } catch (e) {
            console.warn("清理摄像头失败", e);
          }
        }
      });

      state.CameraLstPIXI.forEach((item) =>
        item.destroy?.({ children: true })
      );
      state.CameraLstPIXI.length = 0;
      state.showCameraLst.length = 0;
    },
  };
}
