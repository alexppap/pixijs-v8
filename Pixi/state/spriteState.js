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
  // PIXI 显示对象不进入 Vue 响应式系统（见 mapLayerState 说明）
  const state = {
    PBSs: [],
    carSprites: [],
    routerObjs: [],
    spritesList: [],
    imgLst: [],
    materials: [],
  };

  return {
    // 只读暴露：清空请用 .length = 0（见 mapLayerState 说明）
    get PBSs() {
      return state.PBSs;
    },
    get carSprites() {
      return state.carSprites;
    },
    get routerObjs() {
      return state.routerObjs;
    },
    get spritesList() {
      return state.spritesList;
    },
    get imgLst() {
      return state.imgLst;
    },
    get materials() {
      return state.materials;
    },

    /**
     * 销毁池内全部显示对象并清空数组
     */
    destroy() {
      Object.values(state).forEach((arr) => {
        if (Array.isArray(arr) && arr.length) {
          arr.forEach((item) => {
            // 停悬停效果（取消 rAF + 摘监听），与 clearSprites 一致；
            // 否则动画帧回调会在对象销毁后继续访问已销毁对象
            if (typeof item?.__hoverEffect?.destroy === "function") {
              try {
                item.__hoverEffect.destroy();
              } catch (e) {
                console.warn("停止悬停效果失败:", e);
              }
              item.__hoverEffect = null;
            }
            item.destroy?.({ children: true });
          });
          arr.length = 0;
        }
      });
    },
  };
}
