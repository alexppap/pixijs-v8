<!--
  FileName: MapDialog.vue
  Author: alexppap
  Date: 2026-08-21
  Description: 地图点击/悬停弹窗组件。由源项目 CSS-Web MapTemplate.vue
               模板 1–214 行 + 样式 2891–3049 行移植，五种弹窗形态：
               PBS / Material / ShipSprites / DepartmentSprites / Field。
               差异（移植计划 §6.1 / §7 / §8 MEDIUM）：
               - id="dialog" + document.getElementById → ref="dialogEl"，
                 经 defineExpose 暴露给父组件（多实例无 ID 冲突）
               - CloseOutlined（@ant-design/icons-vue）→ Element Plus Close
               - a-row → 原生 div.row；iconfont icon-chuanboxinxi → 内联 SVG
               - less → 纯 CSS 改写（clip-path 装饰/border-image 渐变保留）
               - 位置魔法数（1125/-70/175/30/5/2）集中 CLICK_CONFIG.TEMPLATE
  Version: 1.0.0
-->
<template>
  <!-- 对话框连接线 -->
  <div v-show="dialogData.showDialog" class="dialogLine" :style="lineStyle" />

  <!-- 对话框主体 -->
  <div v-show="dialogData.showDialog" ref="dialogEl" class="dialog" :style="dialogStyle">
    <!-- PBS 弹窗 -->
    <div v-show="clickEventType === 'PBS' && dialogData.showDialog">
      <div class="dialogHeader">
        <div>{{ modalTitle }}</div>
        <Close class="dialogCloseIcon" @click="dialogData.closeDialog" />
      </div>
      <div
        v-for="Item in dialogData.ClickedMapItems"
        :key="Item.FieldID"
        class="row"
        :style="{ background: Item.BackgroundColor, padding: '5px 0 15px 0' }"
      >
        <!-- 插槽内容 -->
        <slot :data="Item"></slot>
      </div>
    </div>

    <!-- Material 弹窗 -->
    <div v-show="clickEventType === 'Material' && dialogData.showDialog">
      <div class="dialogHeader2">
        <div>{{ modalTitle }}</div>
        <Close class="dialogCloseIcon" @click="dialogData.closeDialog" />
      </div>
      <div
        v-for="Item in dialogData.ClickedMapItems"
        :key="Item.MaterialID"
        class="row"
        :style="{ background: Item.BackgroundColor, padding: '5px 0 15px 0' }"
      >
        <!-- 插槽内容 -->
        <slot :data="Item"></slot>
      </div>
    </div>

    <!-- ShipSprites 弹窗 -->
    <div v-show="clickEventType === 'ShipSprites' && dialogData.showDialog">
      <slot
        :ship-no-title="shipNoTitle"
        :modal-title="modalTitle"
        :dialog-data="dialogData"
        name="Header"
      ></slot>
      <div v-if="!$slots.Header" class="dialogHeader3">
        <div>
          <!-- 船舶信息图标（源 iconfont icon-chuanboxinxi 的内联 SVG 替代） -->
          <svg
            class="iconBlue"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="font-size: 20px; margin-right: 10px; vertical-align: middle"
          >
            <path d="M3 10l1.5-4h15L21 10" />
            <path d="M4 10h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5z" />
            <path d="M12 6v13" />
          </svg>
          <span style="margin-right: 20px">{{ shipNoTitle }}</span>
          <span>{{ modalTitle }}</span>
        </div>
        <Close class="dialogCloseIcon" @click="dialogData.closeDialog" />
      </div>
      <div
        v-for="Item in dialogData.ClickedMapItems"
        :key="Item.ShipID"
        class="row"
        :style="{ background: 'rgba(8, 24, 53, 0.3)', padding: '5px 0 15px 0' }"
      >
        <!-- 插槽内容 -->
        <slot :data="Item"></slot>
      </div>
    </div>

    <!-- DepartmentSprites 弹窗 -->
    <div v-show="clickEventType === 'DepartmentSprites' && dialogData.showDialog">
      <slot
        :ship-no-title="shipNoTitle"
        :modal-title="modalTitle"
        :dialog-data="dialogData"
        name="DepartmentHeader"
      ></slot>
      <div
        v-for="(Item, i) in dialogData.ClickedMapItems"
        :key="i"
        class="row"
        :style="{ background: 'rgba(8, 24, 53, 0.3)', padding: '5px 0 15px 0' }"
      >
        <!-- 插槽内容 -->
        <slot :data="Item"></slot>
      </div>
    </div>

    <!-- Field 弹窗（场地 hover） -->
    <div v-show="clickEventType === 'Field' && dialogData.showDialog">
      <div class="fieldCornerTopLeft" />
      <div class="fieldCornerTopRight" />
      <div
        v-for="Item in dialogData.ClickedMapItems"
        :key="Item.FieldID"
        class="fieldRow"
      >
        <div class="fieldMark fieldMarkTopLeft" />
        <div class="fieldMark fieldMarkTopRight" />
        <div class="fieldMark fieldMarkBottomLeft" />
        <div class="fieldMark fieldMarkBottomRight" />
        <!-- 插槽内容 -->
        <slot :data="Item"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * MapDialog —— 五种形态的地图弹窗
 * 由父组件（MapTemplate）持有 DialogData/clickEventType 等状态并传入，
 * 组件只负责渲染与关闭交互；DOM 尺寸测量（clientWidth/Height，弹窗定位
 * 用）经 defineExpose 暴露的 dialogEl ref 完成。
 */
import { ref, computed } from "vue";
import { Close } from "@element-plus/icons-vue";
import { CLICK_CONFIG } from "../behaviors/dialogPosition";

const props = defineProps({
  /** 弹窗状态（reactive，字段见 state/dialogState） */
  dialogData: { type: Object, required: true },
  /** 当前点击类型（PBS/Material/ShipSprites/DepartmentSprites/Field） */
  clickEventType: { type: String, default: "" },
  /** 弹窗标题 */
  modalTitle: { type: String, default: "" },
  /** 船号标题（ShipSprites/DepartmentSprites 头部） */
  shipNoTitle: { type: String, default: "" },
  /** 画布配置（MapHeight/OffsetX/OffsetY，位置偏移计算） */
  mapObj: { type: Object, default: () => ({}) },
});

/** 弹窗主体 DOM（替代源 id="dialog"，供父组件定位测量） */
const dialogEl = ref(null);
defineExpose({ dialogEl });

/** 画布宽高与偏移（缺省 0 对齐源 `mapObj.OffsetX ? mapObj.OffsetX : 0`） */
const mapHeight = computed(() => props.mapObj?.MapHeight || 0);
const offsetX = computed(() => props.mapObj?.OffsetX || 0);
const offsetY = computed(() => props.mapObj?.OffsetY || 0);

/** 连接线样式（源模板 3–23 行，魔法数集中 CLICK_CONFIG.TEMPLATE） */
const lineStyle = computed(() => {
  const T = CLICK_CONFIG.TEMPLATE;
  return {
    zIndex: 99,
    left: `${
      props.dialogData.lineX -
      props.dialogData.lineLength / 2 +
      T.LINE_LEFT_BASE -
      offsetX.value
    }px`,
    top: `${
      props.dialogData.lineY -
      (mapHeight.value - T.LINE_TOP_MAP_HEIGHT_BASE) -
      offsetY.value
    }px`,
    width: `${props.dialogData.lineLength - T.LINE_WIDTH_GAP}px`,
    transform: `rotate(${props.dialogData.lineDeg}deg)`,
    height: `${T.LINE_HEIGHT}px`,
  };
});

/** 弹窗主体样式（源模板 29–40 行） */
const dialogStyle = computed(() => {
  const T = CLICK_CONFIG.TEMPLATE;
  return {
    zIndex: 99,
    left: `${
      props.dialogData.DialogX + T.DIALOG_LEFT_ADJUST - offsetX.value
    }px`,
    top: `${
      props.dialogData.DialogY +
      T.DIALOG_TOP_ADJUST -
      (mapHeight.value - T.LINE_TOP_MAP_HEIGHT_BASE) -
      offsetY.value
    }px`,
  };
});
</script>

<style scoped>
p {
  margin-bottom: 0;
}

.iconBlue {
  color: #18fff7;
  font-size: 20px;
}

/* 对话框连接线 */
.dialogLine {
  position: fixed;
  width: 2px;
  background-color: #30ffff;
}

/* 对话框主体 */
.dialog {
  position: fixed;
  max-width: 700px;
  display: flex;
  flex-direction: column;
  background: rgba(6, 41, 71, 0.85);
  color: #ffffff;
  border: 1px solid #30ffff;
}

.dialog .dialogCloseIcon {
  color: #999999;
  cursor: pointer;
}

.dialog .row {
  width: 100%;
}

.dialog .dialogHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(
    90deg,
    rgba(0, 255, 246, 0.1) 1%,
    rgba(0, 238, 255, 0.6) 31%,
    rgba(0, 255, 246, 0.3) 51%,
    rgba(0, 238, 255, 0.6) 76%,
    rgba(0, 255, 246, 0.1) 100%
  );
  border: 1px solid;
  border-image: linear-gradient(
      90deg,
      rgba(0, 255, 246, 0.5686) 1%,
      rgba(255, 255, 255, 0.35) 22%,
      rgba(0, 255, 246, 0.5686) 51%,
      rgba(255, 255, 255, 0.24) 80%,
      rgba(0, 255, 246, 0.5686) 100%
    )
    1;
  margin: 5px 5px 0 5px;
  padding: 0 10px;
  font-size: 20px;
}

.dialog .dialogHeader2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(
    90deg,
    rgba(0, 140, 255, 0.1) 1%,
    rgba(0, 140, 255, 0.5) 30%,
    rgba(0, 140, 255, 0.3) 49%,
    rgba(0, 140, 255, 0.5) 74%,
    rgba(0, 102, 255, 0.1) 100%
  );
  border: 1px solid;
  border-image: linear-gradient(
      90deg,
      rgba(2, 98, 201, 0.9608) 0%,
      rgba(255, 255, 255, 0.35) 22%,
      rgba(2, 98, 201, 0.5528) 50%,
      rgba(255, 255, 255, 0.24) 80%,
      rgba(0, 74, 154, 0.76) 100%
    )
    1;
  margin: 5px 5px 0 5px;
  padding: 0 10px;
  font-size: 20px;
}

.dialog .dialogHeader3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(
    90deg,
    #3f54dd 5%,
    rgba(63, 84, 221, 0.5) 30%,
    rgba(63, 84, 221, 0.3) 49%,
    rgba(63, 84, 221, 0.5) 74%,
    rgba(63, 84, 221, 0.1) 100%
  );
  box-sizing: border-box;
  border: 1px solid;
  border-image: linear-gradient(
      90deg,
      rgba(21, 0, 255, 0.9608) 2%,
      rgba(255, 255, 255, 0.35) 22%,
      rgba(21, 0, 255, 0.5528) 50%,
      rgba(255, 255, 255, 0.24) 80%,
      rgba(21, 0, 255, 0.76) 100%
    )
    1;
  margin: 5px 5px 0 5px;
  padding: 0 10px;
  font-size: 20px;
}

/* Field 弹窗顶部双角装饰（源模板 120–142 内联样式抽出） */
.fieldCornerTopLeft {
  position: absolute;
  left: -5px;
  top: 0;
  width: 15px;
  height: 15px;
  background: linear-gradient(180deg, #008bff 4%, #30ffff 100%);
  clip-path: polygon(0 0, 0 100%, 100% 0);
}

.fieldCornerTopRight {
  position: absolute;
  right: -5px;
  top: 0;
  width: 15px;
  height: 15px;
  transform: rotate(180deg);
  background: linear-gradient(180deg, #30ffff 4%, #008bff 100%);
  clip-path: polygon(0 100%, 0 0, 100% 100%);
}

/* Field 弹窗行（八角形裁切 + 四角标记，源模板 143–212） */
.fieldRow {
  position: relative;
  width: 100%;
  padding: 5px 0 15px 0;
  background: rgba(6, 41, 71, 0.85);
  border: 1px solid #30ffff;
  clip-path: polygon(
    20px 0,
    calc(100% - 20px) 0,
    100% 20px,
    100% calc(100% - 20px),
    calc(100% - 20px) 100%,
    20px 100%,
    0 calc(100% - 20px),
    0 20px
  );
}

.fieldMark {
  position: absolute;
  width: 21px;
  height: 21px;
  background: #30ffff;
}

.fieldMarkTopLeft {
  left: -5px;
  top: 0;
  clip-path: polygon(0 0, 0 100%, 100% 0);
}

.fieldMarkTopRight {
  right: -5px;
  top: 0;
  transform: rotate(180deg);
  clip-path: polygon(0 100%, 0 0, 100% 100%);
}

.fieldMarkBottomLeft {
  left: -5px;
  bottom: 0;
  transform: rotate(270deg);
  clip-path: polygon(0 0, 0 100%, 100% 0);
}

.fieldMarkBottomRight {
  right: -5px;
  bottom: 0;
  transform: rotate(270deg);
  clip-path: polygon(0 100%, 0 0, 100% 100%);
}
</style>
