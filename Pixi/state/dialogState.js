/**
 * FileName: dialogState.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 弹窗状态工厂（DialogData）。由源项目 CSS-Web MapTemplate.vue
 *              的 DialogData reactive 对象（449–478 行）移植，实例间隔离。
 *              差异：源码 closeDialog 内的 emit("changeShowTransitRecords")、
 *              Map.render?.() 与 ClickedMapItemBorder/clickEventType 闭包引用
 *              改为工厂内聚 + 回调注入（onClose/onRender 由装配层提供）。
 *              高亮边框引用不做单独销毁（对齐源码：销毁统一在
 *              itemBorderLst 中处理，见 MapTemplate 清理链注释）。
 * Version: 1.0.0
 */
import { reactive, ref } from "vue";

/**
 * 创建弹窗状态实例
 * @param {object} callbacks 回调注入
 * @param {Function} [callbacks.onChangeShowTransitRecords] 关闭弹窗时通知
 * @param {Function} [callbacks.onRender] 关闭弹窗后触发渲染（常驻渲染下冗余，
 *                                        保留以兼容按需渲染模式）
 * @returns {object} { DialogData, clickEventType, setClickedMapItemBorder,
 *                     clearClickedMapItemBorder, destroy }
 */
export function createDialogState(callbacks = {}) {
  const { onChangeShowTransitRecords, onRender } = callbacks;

  /** 高亮边框引用（createHighlightBorder 设置，closeDialog 隐藏） */
  let clickedMapItemBorder = null;

  /** 当前点击类型（"PBS"/"Material" 等，点击处理器赋值，关闭时重置） */
  const clickEventType = ref("");

  const DialogData = reactive({
    showResetMapBtn: false, // 重置按钮显示状态
    DefaultHeight: 1080, // 默认高度
    DefaultWidth: 1920, // 默认宽度
    Height: typeof window !== "undefined" ? window.innerHeight : 0, // 当前窗口高度
    Width: typeof window !== "undefined" ? window.innerWidth : 0, // 当前窗口宽度
    zoomX: null, // X轴缩放比例
    zoomY: null, // Y轴缩放比例
    showDialog: false, // 对话框显示状态
    DialogX: 0, // 对话框X坐标
    lineX: 0, // 连接线X坐标
    lineY: 0, // 连接线Y坐标
    DialogY: 0, // 对话框Y坐标
    lineLength: 0, // 连接线长度
    lineDeg: 0, // 连接线角度
    ClickedMapItems: [], // 当前点击的地图元素
    /**
     * 关闭对话框并重置状态
     */
    closeDialog() {
      if (DialogData.showDialog) {
        if (clickedMapItemBorder) clickedMapItemBorder.visible = false;
        DialogData.showDialog = false;
        clickEventType.value = "";
        DialogData.ClickedMapItems = [];
        onChangeShowTransitRecords?.();
        onRender?.();
      }
    },
  });

  return {
    DialogData,
    clickEventType,

    /**
     * 设置点击高亮边框引用（不转移所有权，销毁由边框列表负责）
     * @param {object|null} border PIXI.Graphics 高亮边框
     */
    setClickedMapItemBorder(border) {
      clickedMapItemBorder = border;
    },

    /**
     * 清空点击高亮边框引用（不执行销毁）
     */
    clearClickedMapItemBorder() {
      clickedMapItemBorder = null;
    },

    /**
     * 销毁状态（清空点击数据，隐藏弹窗）
     */
    destroy() {
      DialogData.showDialog = false;
      DialogData.ClickedMapItems = [];
      DialogData.showResetMapBtn = false;
      clickEventType.value = "";
      this.clearClickedMapItemBorder();
    },
  };
}
