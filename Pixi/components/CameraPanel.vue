<!--
  FileName: CameraPanel.vue
  Author: alexppap
  Date: 2026-08-21
  Description: 摄像头浮窗组件。由源项目 CSS-Web MapTemplate.vue 模板
               225–283 行 + .camera 样式移植。差异（移植计划 §6.2 / §7）：
               - :id="item.id + index" + document.getElementById → 函数 ref
                 收集（utils/domDrag 由调用方传 el，禁止全局 ID 查找）
               - close-circle-filled（antd）→ Element Plus CircleCloseFilled
               - video.js 不引入：#video 插槽预留（阶段 6 之后的接入点），
                 默认插槽内容渲染"暂无摄像头"占位（源 video 标签本已注释）
               - 拖拽经 utils/domDrag（dragAble/touchstartDragAble 返回
                 cleanup，卸载时统一移除 document 监听防泄漏）
               - 关闭浮窗 emit('delete')，由父组件调 layers/camera.js 的
                 deleteCameraLst（含 videojs dispose 回调注入）
  Version: 1.0.0
-->
<template>
  <div
    v-for="(item, index) in showCameraLst"
    v-show="item.show"
    :key="index"
    :ref="(el) => setCameraEl(index, el)"
    class="camera"
    :style="cameraStyle(item)"
  >
    <!-- 拖拽手柄（标题栏） -->
    <div
      class="cameraHeader"
      @mousedown="onDragStart($event, item, index)"
      @touchstart="onTouchDragStart($event, item, index)"
    >
      <span class="cameraTitle">{{ item.CameraName }}</span>
      <CircleCloseFilled class="cameraCloseIcon" @click="emit('delete', item, index)" />
    </div>

    <!-- 视频播放插槽（video.js 未引入，预留接入点；默认渲染占位） -->
    <slot name="video" :item="item" :index="index">
      <div v-if="!item.IPAddress" class="cameraEmpty">暂无摄像头</div>
    </slot>
  </div>
</template>

<script setup>
/**
 * CameraPanel —— 摄像头浮窗列表
 * 渲染 showCameraLst（state/cameraState），拖拽（含层级置顶 changePlace）
 * 经 utils/domDrag；关闭行为上抛父组件统一处理（deleteCameraLst）。
 */
import { onBeforeUnmount } from "vue";
import { CircleCloseFilled } from "@element-plus/icons-vue";
import { dragAble, touchstartDragAble } from "../utils/domDrag";

const props = defineProps({
  /** 显示中的摄像头视频列表（cameraLstState.showCameraLst） */
  showCameraLst: { type: Array, required: true },
});

const emit = defineEmits(["delete"]);

/** 各浮窗 DOM 元素（index → el，替代源 document.getElementById） */
const cameraEls = {};

/** 拖拽 cleanup 收集（卸载时移除 document 监听，防泄漏） */
const dragCleanups = [];

/**
 * 函数 ref 收集浮窗 DOM
 * @param {number} index 浮窗索引
 * @param {HTMLElement|null} el DOM 元素（卸载时为 null）
 */
const setCameraEl = (index, el) => {
  if (el) {
    cameraEls[index] = el;
  } else {
    delete cameraEls[index];
  }
};

/**
 * 浮窗容器样式（源模板 229–237 行）
 * @param {object} item 浮窗状态对象
 */
const cameraStyle = (item) => ({
  border: "1px solid #03a9f3",
  borderRadius: "10px",
  zIndex: item.zIndex,
  width: `${item.width}px`,
  height: "auto",
  left: `${item.left}px`,
  top: `${item.top}px`,
});

/**
 * 鼠标拖拽开始（domDrag.dragAble，changePlace 层级置顶）
 */
const onDragStart = (e, item, index) => {
  const el = cameraEls[index];
  if (!el) return;
  dragCleanups.push(
    dragAble({ el, index: item, e, showCameraLst: props.showCameraLst })
  );
};

/**
 * 触摸拖拽开始（domDrag.touchstartDragAble）
 */
const onTouchDragStart = (e, item, index) => {
  const el = cameraEls[index];
  if (!el) return;
  dragCleanups.push(
    touchstartDragAble({
      el,
      index: item,
      e,
      showCameraLst: props.showCameraLst,
    })
  );
};

onBeforeUnmount(() => {
  // 移除仍在拖拽中的 document 监听（源码仅 mouseup/touchend 时移除）
  dragCleanups.forEach((cleanup) => cleanup?.());
  dragCleanups.length = 0;
  Object.keys(cameraEls).forEach((k) => delete cameraEls[k]);
});
</script>

<style scoped>
.camera {
  position: absolute;
  cursor: move;
  width: 370px;
  height: 243px;
  background: rgb(6, 41, 71);
}

.cameraHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px;
  background: rgb(6, 41, 71);
  border-radius: 10px 10px 0 0;
}

.cameraTitle {
  font-family: "PingFang SC Bold";
  font-weight: 700;
  font-size: 25px;
  text-align: left;
  color: #fff;
}

.cameraCloseIcon {
  font-size: 25px;
  color: #fff;
  cursor: pointer;
}

.cameraEmpty {
  height: 200px;
  width: 100%;
  background: #062947;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 0 10px 10px;
}
</style>
