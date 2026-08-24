/**
 * FileName: mapLayerState.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 底图图层状态工厂。由源项目 CSS-Web public/js/map/layer.js 的
 *              createMapLayerState 移植，实例间隔离；补 destroy()（对齐源
 *              MapTemplate.vue 清理链 2798–2808）。
 * Version: 1.0.0
 */
/**
 * 创建独立的底图图层状态对象
 * @returns {object} 状态对象（含 destroy），字段：
 *   MapLayer - 底图多边形元素池
 *   fieldTextLst - 底图场地文字实例列表
 */
export function createMapLayerState() {
  // 池内是 PIXI 显示对象，不能用 reactive：深层代理会让 destroy() 收到
  // Proxy，PIXI 内部 parent.children.indexOf(proxy) 返回 -1，对象被销毁却
  // 仍留在容器 children 中，下一帧渲染即访问已销毁对象。
  const state = {
    MapLayer: [], // 地图实例（每个组件独立）
    fieldTextLst: [], // 场地文字实例（每个组件独立）
  };

  return {
    // 只读暴露：池引用不可被外部替换。`state.MapLayer = []` 会断开
    // destroy 的闭包引用，使新数组内的对象永不销毁；清空请用 .length = 0
    get MapLayer() {
      return state.MapLayer;
    },
    get fieldTextLst() {
      return state.fieldTextLst;
    },

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
