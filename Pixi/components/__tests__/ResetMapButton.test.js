/**
 * FileName: ResetMapButton.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 6.3 —— ResetMapButton 组件测试。验收点：按钮渲染与
 *              v-show、点击 emit('reset')、hover 提示显隐、位置样式
 *              （top/left）、SVG 图标存在。
 * Version: 1.0.0
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ResetMapButton from "@/components/Pixi/components/ResetMapButton.vue";

const mountBtn = (props = {}) =>
  mount(ResetMapButton, { props: { show: true, top: 30, left: 30, ...props } });

describe("ResetMapButton 渲染", () => {
  it("渲染按钮与内联 SVG 复位图标", () => {
    const wrapper = mountBtn();
    const btn = wrapper.find("button");
    expect(btn.exists()).toBe(true);
    expect(btn.find("svg").exists()).toBe(true);
    expect(btn.attributes("title")).toBe("重置视角");
  });

  it("位置样式按 top/left props 绝对定位", () => {
    const wrapper = mountBtn({ top: 120, left: 80 });
    const style = wrapper.find("button").attributes("style");
    expect(style).toContain("top: 120px");
    expect(style).toContain("left: 80px");
  });

  it("show=false 时隐藏（v-show，DOM 保留）", () => {
    const wrapper = mountBtn({ show: false });
    const btn = wrapper.find("button");
    expect(btn.exists()).toBe(true);
    expect(btn.isVisible()).toBe(false);
  });
});

describe("交互", () => {
  it("点击按钮 emit('reset')", async () => {
    const wrapper = mountBtn();
    await wrapper.find("button").trigger("click");

    expect(wrapper.emitted("reset")).toBeTruthy();
    expect(wrapper.emitted("reset").length).toBe(1);
  });

  it("hover 显示'重置视角'提示，移出隐藏", async () => {
    const wrapper = mountBtn();

    // 注：jsdom 的 getComputedStyle 对同一元素的级联结果有缓存，二次
    // isVisible() 不反映 v-show 变化，改用 style 属性断言 display:none
    const tipShown = (w) =>
      !w.find(".resetMapBtnTip").attributes("style")?.includes("display: none");

    // 初始隐藏（v-show → style display:none）
    expect(tipShown(wrapper)).toBe(false);

    // hover 显示（display:none 移除）
    await wrapper.find("button").trigger("mouseover");
    expect(tipShown(wrapper)).toBe(true);
    expect(wrapper.find(".resetMapBtnTip").text()).toBe("重置视角");

    // 移出隐藏
    await wrapper.find("button").trigger("mouseleave");
    expect(tipShown(wrapper)).toBe(false);
  });
});
