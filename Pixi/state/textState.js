/**
 * FileName: textState.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 场地文字状态工厂。由源项目 CSS-Web public/js/map/text.js 的
 *              createTextState 移植，实例间隔离；补 destroy()（对齐源
 *              MapTemplate.vue 清理链 2810–2818）。
 * Version: 1.0.0
 */
import { reactive } from "vue";

/**
 * 创建独立的文字状态对象
 * @returns {object} 文字状态对象（含 destroy），字段：
 *   FieldTextsPIXI - 场地文字 PIXI 实例列表
 *   FieldTexts - 场地文字实例列表
 */
export function createTextState() {
  const state = {
    FieldTextsPIXI: reactive([]), // 场地文字 PIXI 实例（每个组件独立）
    FieldTexts: reactive([]), // 场地文字实例（每个组件独立）
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
