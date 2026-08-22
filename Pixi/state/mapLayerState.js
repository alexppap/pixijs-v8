/**
 * FileName: mapLayerState.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 底图图层状态工厂。由源项目 CSS-Web public/js/map/layer.js 的
 *              createMapLayerState 移植，实例间隔离；补 destroy()（对齐源
 *              MapTemplate.vue 清理链 2798–2808）。
 * Version: 1.0.0
 */
import { reactive } from "vue";

/**
 * 创建独立的底图图层状态对象
 * @returns {object} 状态对象（含 destroy），字段：
 *   MapLayer - 底图多边形元素池
 *   fieldTextLst - 底图场地文字实例列表
 */
export function createMapLayerState() {
  const state = {
    MapLayer: reactive([]), // 地图实例（每个组件独立）
    fieldTextLst: reactive([]), // 场地文字实例（每个组件独立）
  };

  return {
    ...state,

    /**
     * 销毁池内显示对象并清空数组
     */
    destroy() {
      Object.values(state).forEach((arr) => {
        if (Array.isArray(arr) && arr.length) {
          arr.forEach((item) => item.destroy?.({ children: true }));
          arr.length = 0;
        }
      });
    },
  };
}
