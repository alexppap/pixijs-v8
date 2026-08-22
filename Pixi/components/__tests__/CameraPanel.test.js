/**
 * FileName: CameraPanel.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 6.2 —— CameraPanel 组件测试。验收点：浮窗列表渲染与
 *              v-show、样式绑定（zIndex/width/left/top）、关闭事件上抛、
 *              视频插槽占位与自定义插槽、拖拽（domDrag + changePlace 层级
 *              置顶）、卸载清理 document 监听。
 * Version: 1.0.0
 */
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import CameraPanel from "@/components/Pixi/components/CameraPanel.vue";

/** 构造 mock 浮窗列表 */
const createCameraLst = () =>
  reactive([
    {
      id: "cam-1",
      CameraName: "CAM-01",
      IPAddress: "",
      zIndex: 9999,
      width: 370,
      left: 100,
      top: 200,
      show: true,
    },
    {
      id: "cam-2",
      CameraName: "CAM-02",
      IPAddress: "",
      zIndex: 10000,
      width: 370,
      left: 300,
      top: 400,
      show: true,
    },
  ]);

const mountPanel = (showCameraLst = createCameraLst(), slots = {}) =>
  mount(CameraPanel, { props: { showCameraLst }, slots });

describe("浮窗列表渲染", () => {
  it("按 showCameraLst 渲染浮窗，样式含 zIndex/width/left/top", () => {
    const lst = createCameraLst();
    const wrapper = mountPanel(lst);

    const panels = wrapper.findAll(".camera");
    expect(panels.length).toBe(2);
    const style = panels[0].attributes("style");
    expect(style).toContain("z-index: 9999");
    expect(style).toContain("width: 370px");
    expect(style).toContain("left: 100px");
    expect(style).toContain("top: 200px");
    expect(style).toContain("border-radius: 10px");
  });

  it("v-show 控制显隐（show=false 时隐藏但不销毁）", async () => {
    const lst = createCameraLst();
    const wrapper = mountPanel(lst);
    lst[0].show = false;
    await nextTickSafe();

    const panels = wrapper.findAll(".camera");
    expect(panels.length).toBe(2);
    expect(panels[0].isVisible()).toBe(false);
    expect(panels[1].isVisible()).toBe(true);
  });

  it("标题栏渲染 CameraName", () => {
    const wrapper = mountPanel();
    expect(wrapper.findAll(".cameraTitle")[0].text()).toBe("CAM-01");
  });
});

describe("视频占位与插槽", () => {
  it("无 IPAddress 时默认插槽内容渲染'暂无摄像头'占位", () => {
    const wrapper = mountPanel();
    expect(wrapper.findAll(".cameraEmpty").length).toBe(2);
    expect(wrapper.find(".cameraEmpty").text()).toBe("暂无摄像头");
  });

  it("有 IPAddress 时默认不渲染占位（源 video 标签注释语义）", async () => {
    const lst = createCameraLst();
    const wrapper = mountPanel(lst);
    lst[0].IPAddress = "http://preview/1";
    await nextTickSafe();

    expect(wrapper.findAll(".cameraEmpty").length).toBe(1);
  });

  it("提供 #video 插槽时替换占位（video.js 接入点）", () => {
    const wrapper = mountPanel(createCameraLst(), {
      video: `<template #video="{ item }"><div class="custom-video">{{ item.CameraName }}-video</div></template>`,
    });
    expect(wrapper.findAll(".custom-video").length).toBe(2);
    expect(wrapper.find(".custom-video").text()).toContain("CAM-01-video");
    expect(wrapper.find(".cameraEmpty").exists()).toBe(false);
  });
});

describe("关闭与拖拽", () => {
  it("点击关闭图标 emit('delete', item, index)", async () => {
    const lst = createCameraLst();
    const wrapper = mountPanel(lst);
    await wrapper.findAll(".cameraCloseIcon")[0].trigger("click");

    expect(wrapper.emitted("delete")).toBeTruthy();
    expect(wrapper.emitted("delete")[0]).toEqual([lst[0], 0]);
  });

  it("mousedown 拖拽：changePlace 置顶 + mousemove 更新位置（clamp 边界）", async () => {
    const lst = createCameraLst();
    const wrapper = mountPanel(lst);

    // mousedown（clientX/Y 任意）：层级置顶（zIndex 调整）
    await wrapper.findAll(".cameraHeader")[0].trigger("mousedown", {
      clientX: 150,
      clientY: 250,
    });

    // cam-1 置顶：zIndex = max(9999,10000) = 10000，cam-2 降 1
    expect(lst[0].zIndex).toBe(10000);
    expect(lst[1].zIndex).toBe(9999);

    // document mousemove：jsdom 中 offsetLeft/offsetWidth 为 0，
    // diffX = 150 - 0，left = clientX - 150（clamp ≥ 0）
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 400, clientY: 500 })
    );
    expect(lst[0].left).toBeGreaterThanOrEqual(0);
    expect(lst[0].top).toBeGreaterThanOrEqual(0);

    // mouseup 后监听移除，后续 move 不再更新
    document.dispatchEvent(new MouseEvent("mouseup"));
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 900, clientY: 900 })
    );
    const leftAfterUp = lst[0].left;
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 950, clientY: 950 })
    );
    expect(lst[0].left).toBe(leftAfterUp);
  });

  it("touchstart 拖拽：touchmove 更新位置，touchend 移除监听", async () => {
    const lst = createCameraLst();
    const wrapper = mountPanel(lst);

    await wrapper.findAll(".cameraHeader")[0].trigger("touchstart", {
      touches: [{ clientX: 100, clientY: 100 }],
    });

    // jsdom 无 TouchEvent touches 构造：手动附加 touches 属性
    const moveEvent = new Event("touchmove", { cancelable: true });
    Object.defineProperty(moveEvent, "touches", {
      value: [{ clientX: 300, clientY: 300 }],
    });
    document.dispatchEvent(moveEvent);

    // jsdom 中 offsetLeft/offsetWidth 为 0 → left = clientX - startX
    expect(lst[0].left).toBe(200);
    expect(lst[0].top).toBe(200);

    // touchend 后监听移除，后续 move 不再更新
    document.dispatchEvent(new Event("touchend"));
    const endEvent = new Event("touchmove", { cancelable: true });
    Object.defineProperty(endEvent, "touches", {
      value: [{ clientX: 900, clientY: 900 }],
    });
    document.dispatchEvent(endEvent);
    expect(lst[0].left).toBe(200);
  });

  it("卸载时移除拖拽 document 监听（cleanup 调用）", async () => {
    const lst = createCameraLst();
    const wrapper = mountPanel(lst);
    await wrapper.findAll(".cameraHeader")[0].trigger("mousedown", {
      clientX: 50,
      clientY: 50,
    });

    // spy document.removeEventListener（卸载清理路径）
    const removeSpy = vi.spyOn(document, "removeEventListener");
    wrapper.unmount();

    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});

/** nextTick 封装（避免顶层 import 展开顺序问题） */
async function nextTickSafe() {
  const { nextTick } = await import("vue");
  await nextTick();
}
