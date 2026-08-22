/**
 * FileName: blockCombState.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 总段/预组线状态工厂。由源项目 CSS-Web public/js/map/block.js
 *              的 createBlockCombState 移植，实例间隔离；补 destroy()（对齐
 *              源 MapTemplate.vue 清理链 2798–2808）。
 * Version: 1.0.0
 */
import { reactive } from "vue";

/**
 * 创建独立的总段/预组状态对象
 * @returns {object} 状态对象（含 destroy），字段：
 *   BlockLayer - 总段图层数组
 *   CombLayer - 预组图层数组
 *   blockTextLst - 总段文本实例数组
 *   combTextLst - 预组文本实例数组
 */
export function createBlockCombState() {
  const state = {
    BlockLayer: reactive([]), // 总段图层实例（组件独立）
    CombLayer: reactive([]), // 预组图层实例（组件独立）
    blockTextLst: reactive([]), // 总段文本实例（组件独立）
    combTextLst: reactive([]), // 预组文本实例（组件独立）
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
