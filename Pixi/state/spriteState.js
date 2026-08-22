/**
 * FileName: spriteState.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 精灵池状态工厂。由源项目 CSS-Web public/js/map/sprite.js 的
 *              createSpriteState 移植，实例间隔离；补 destroy()（对齐源
 *              MapTemplate.vue 清理链 2810–2818：逐项 destroy({children:true})
 *              后清空数组）。
 * Version: 1.0.0
 */
import { reactive } from "vue";

/**
 * 创建独立的精灵状态管理对象
 * @returns {object} 精灵状态对象（含 destroy），字段：
 *   PBSs - PBS（泊位）精灵数组
 *   carSprites - 车辆位置精灵数组
 *   routerObjs - 路径精灵数组
 *   spritesList - 船体图片精灵数组
 *   imgLst - 图片列表（非响应式）
 *   materials - 物资精灵数组
 */
export function createSpriteState() {
  const state = {
    PBSs: reactive([]),
    carSprites: reactive([]),
    routerObjs: reactive([]),
    spritesList: reactive([]),
    imgLst: [],
    materials: reactive([]),
  };

  return {
    ...state,

    /**
     * 销毁池内全部显示对象并清空数组
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
