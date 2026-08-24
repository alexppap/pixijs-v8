/**
 * FileName: blockCombState.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 总段/预组线状态工厂。由源项目 CSS-Web public/js/map/block.js
 *              的 createBlockCombState 移植，实例间隔离；补 destroy()（对齐
 *              源 MapTemplate.vue 清理链 2798–2808）。
 * Version: 1.0.0
 */
/**
 * 创建独立的总段/预组状态对象
 * @returns {object} 状态对象（含 destroy），字段：
 *   BlockLayer - 总段图层数组
 *   CombLayer - 预组图层数组
 *   blockTextLst - 总段文本实例数组
 *   combTextLst - 预组文本实例数组
 */
export function createBlockCombState() {
  // PIXI 显示对象不进入 Vue 响应式系统（见 mapLayerState 说明）
  const state = {
    BlockLayer: [], // 总段图层实例（组件独立）
    CombLayer: [], // 预组图层实例（组件独立）
    blockTextLst: [], // 总段文本实例（组件独立）
    combTextLst: [], // 预组文本实例（组件独立）
  };

  return {
    // 只读暴露：清空请用 .length = 0（见 mapLayerState 说明）
    get BlockLayer() {
      return state.BlockLayer;
    },
    get CombLayer() {
      return state.CombLayer;
    },
    get blockTextLst() {
      return state.blockTextLst;
    },
    get combTextLst() {
      return state.combTextLst;
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
