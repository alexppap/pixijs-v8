<!--
  FileName: ResetMapButton.vue
  Author: alexppap
  Date: 2026-08-21
  Description: 重置视角按钮组件。由源项目 CSS-Web MapTemplate.vue 模板
               285–301 行 + .resetMapBtn 样式移植（demo 版内联实现抽出复用，
               移植计划 §6.3）。差异（§7）：
               - a-button → 原生 button；iconfont icon-ditucaozuo → 内联 SVG
                 （定位/复位图标：圆环 + 中心点 + 四向短柄）
               - hover 提示（"重置视角"）由组件内部管理（源挂在 DialogData
                 .showResetMapBtn，抽组件后无需侵入弹窗状态）
  Version: 1.0.0
-->
<template>
  <button
    v-show="show"
    class="resetMapBtn"
    :style="{ top: `${top}px`, left: `${left}px` }"
    title="重置视角"
    @click="emit('reset', $event)"
    @mouseover="hover = true"
    @mouseleave="hover = false"
  >
    <svg
      viewBox="0 0 24 24"
      width="25"
      height="25"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <!-- 定位/复位图标：圆环 + 中心点 + 四向短柄 -->
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
    <!-- hover 提示 -->
    <div v-show="hover" class="resetMapBtnTip">重置视角</div>
  </button>
</template>

<script setup>
/**
 * ResetMapButton —— 重置视角按钮
 * 点击后上抛 reset 事件，由父组件调用 CoordinateSystem.resetMap()。
 */
import { ref } from "vue";

defineProps({
  /** 是否显示按钮 */
  show: { type: Boolean, default: true },
  /** 距容器顶部距离（px） */
  top: { type: Number, default: 30 },
  /** 距容器左侧距离（px） */
  left: { type: Number, default: 30 },
});

const emit = defineEmits(["reset"]);

/** hover 提示显隐（源挂 DialogData.showResetMapBtn，组件内聚） */
const hover = ref(false);
</script>

<style scoped>
/* 重置视角按钮（样式参照源 .resetMapBtn 与 demo 内联实现） */
.resetMapBtn {
  position: absolute;
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(48, 255, 255, 0.19);
  border-radius: 50%;
  color: #30ffff;
  border: 1px solid rgba(48, 255, 255, 0.19);
  cursor: pointer;
  padding: 0;
}

.resetMapBtn:hover {
  border: 1px solid #30ffff;
}

/* hover 提示文字（源模板：position absolute; left: 50px） */
.resetMapBtnTip {
  position: absolute;
  left: 50px;
  white-space: nowrap;
  font-size: 14px;
  color: #30ffff;
  text-shadow: 0 0 4px rgba(48, 255, 255, 0.6);
}
</style>
