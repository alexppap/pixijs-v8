/**
 * FileName: MapDialog.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 6.1 —— MapDialog 组件测试。验收点：五种弹窗形态
 *              渲染分支、连接线/主体位置样式（CLICK_CONFIG.TEMPLATE 魔法数）、
 *              关闭交互（closeDialog）、Header/DepartmentHeader 与默认
 *              作用域插槽、dialogEl 暴露、无全局 id="dialog"（多实例无冲突）。
 * Version: 1.0.0
 */
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive, nextTick } from "vue";
import MapDialog from "@/components/Pixi/components/MapDialog.vue";
import { CLICK_CONFIG } from "@/components/Pixi/behaviors/dialogPosition";

/** 构造 mock DialogData（含 closeDialog spy） */
const createDialogData = (over = {}) =>
  reactive({
    showDialog: true,
    DialogX: 100,
    DialogY: 200,
    lineX: 300,
    lineY: 400,
    lineLength: 100,
    lineDeg: -30,
    ClickedMapItems: [],
    closeDialog: vi.fn(),
    ...over,
  });

const mountDialog = (props = {}) =>
  mount(MapDialog, {
    props: {
      dialogData: createDialogData(),
      clickEventType: "PBS",
      modalTitle: "标题",
      shipNoTitle: "S-01",
      mapObj: { MapHeight: 1080, OffsetX: 0, OffsetY: 0 },
      ...props,
    },
    slots: {
      default: `<template #default="{ data }"><p class="slot-item">{{ data.PBSCode }}</p></template>`,
    },
  });

describe("五种弹窗形态渲染分支", () => {
  it("PBS：渲染 dialogHeader 与列表项背景色", () => {
    const wrapper = mountDialog({
      clickEventType: "PBS",
      dialogData: createDialogData({
        ClickedMapItems: [{ FieldID: "f1", PBSCode: "P1", BackgroundColor: "rgba(1,2,3,0.5)" }],
      }),
    });
    expect(wrapper.find(".dialogHeader").exists()).toBe(true);
    expect(wrapper.find(".dialogHeader").text()).toContain("标题");
    const row = wrapper.find(".row");
    expect(row.attributes("style")).toContain("rgba(1, 2, 3, 0.5)");
    expect(wrapper.find(".slot-item").text()).toBe("P1");
  });

  it("Material：渲染 dialogHeader2，key 为 MaterialID", () => {
    const wrapper = mountDialog({
      clickEventType: "Material",
      dialogData: createDialogData({
        ClickedMapItems: [{ MaterialID: "m1", BackgroundColor: "rgba(0,0,0,1)" }],
      }),
    });
    expect(wrapper.find(".dialogHeader2").exists()).toBe(true);
    expect(wrapper.find(".row").exists()).toBe(true);
  });

  it("ShipSprites：无 Header 插槽时渲染 dialogHeader3（船号 + 标题）", () => {
    const wrapper = mountDialog({
      clickEventType: "ShipSprites",
      dialogData: createDialogData({
        ClickedMapItems: [{ ShipID: "s1" }],
      }),
    });
    const header = wrapper.find(".dialogHeader3");
    expect(header.exists()).toBe(true);
    expect(header.text()).toContain("S-01");
    expect(header.text()).toContain("标题");
    expect(header.find("svg").exists()).toBe(true); // 船舶信息图标（内联 SVG）
  });

  it("ShipSprites：提供 Header 插槽时替换默认头部", () => {
    const wrapper = mount(MapDialog, {
      props: {
        dialogData: createDialogData({ ClickedMapItems: [{ ShipID: "s1" }] }),
        clickEventType: "ShipSprites",
        modalTitle: "标题",
        shipNoTitle: "S-01",
      },
      slots: {
        Header: `<template #Header="{ shipNoTitle, modalTitle }">
          <div class="custom-header">{{ shipNoTitle }}/{{ modalTitle }}</div>
        </template>`,
      },
    });
    expect(wrapper.find(".custom-header").exists()).toBe(true);
    expect(wrapper.find(".dialogHeader3").exists()).toBe(false);
  });

  it("DepartmentSprites：渲染 DepartmentHeader 插槽 + 列表", () => {
    const wrapper = mount(MapDialog, {
      props: {
        dialogData: createDialogData({
          ClickedMapItems: [{ DepartmentID: "d1" }],
        }),
        clickEventType: "DepartmentSprites",
      },
      slots: {
        DepartmentHeader: `<template #DepartmentHeader>
          <div class="custom-dept-header">部门</div>
        </template>`,
        default: `<template #default><p class="slot-item">dept</p></template>`,
      },
    });
    expect(wrapper.find(".custom-dept-header").exists()).toBe(true);
    expect(wrapper.find(".slot-item").exists()).toBe(true);
  });

  it("Field：渲染八角形裁切行与四角标记 + 顶部双角装饰", () => {
    const wrapper = mountDialog({
      clickEventType: "Field",
      dialogData: createDialogData({
        ClickedMapItems: [{ FieldID: "f1" }],
      }),
    });
    expect(wrapper.find(".fieldRow").exists()).toBe(true);
    expect(wrapper.findAll(".fieldMark").length).toBe(4);
    expect(wrapper.find(".fieldCornerTopLeft").exists()).toBe(true);
    expect(wrapper.find(".fieldCornerTopRight").exists()).toBe(true);
  });

  it("showDialog=false 时弹窗与连接线均不显示", async () => {
    const dialogData = createDialogData({ showDialog: false });
    const wrapper = mountDialog({ dialogData });
    await nextTick();

    const dialogEl = wrapper.find(".dialog");
    expect(dialogEl.exists()).toBe(true); // v-show：DOM 存在
    expect(dialogEl.isVisible()).toBe(false);
    expect(wrapper.find(".dialogLine").isVisible()).toBe(false);
  });
});

describe("位置样式（CLICK_CONFIG.TEMPLATE 魔法数）", () => {
  const T = CLICK_CONFIG.TEMPLATE;

  it("弹窗主体：left = DialogX + 175，top = DialogY - 70 - (MapHeight - 1125)", () => {
    const wrapper = mountDialog({
      dialogData: createDialogData({ DialogX: 100, DialogY: 200 }),
      mapObj: { MapHeight: 1080, OffsetX: 0, OffsetY: 0 },
    });
    const style = wrapper.find(".dialog").attributes("style");
    expect(style).toContain(`left: ${100 + T.DIALOG_LEFT_ADJUST}px`);
    expect(style).toContain(`top: ${200 + T.DIALOG_TOP_ADJUST - (1080 - T.LINE_TOP_MAP_HEIGHT_BASE)}px`);
  });

  it("连接线：left = lineX - lineLength/2 + 30，宽 = lineLength - 5，带旋转", () => {
    const wrapper = mountDialog({
      dialogData: createDialogData({
        lineX: 300, lineY: 400, lineLength: 100, lineDeg: -30,
      }),
    });
    const style = wrapper.find(".dialogLine").attributes("style");
    expect(style).toContain(`left: ${300 - 50 + T.LINE_LEFT_BASE}px`);
    expect(style).toContain(`width: ${100 - T.LINE_WIDTH_GAP}px`);
    expect(style).toContain("rotate(-30deg)");
  });

  it("带 OffsetX/OffsetY 时位置相应扣减", () => {
    const wrapper = mountDialog({
      dialogData: createDialogData({ DialogX: 100, DialogY: 200 }),
      mapObj: { MapHeight: 1080, OffsetX: 10, OffsetY: 20 },
    });
    const style = wrapper.find(".dialog").attributes("style");
    expect(style).toContain(`left: ${100 + T.DIALOG_LEFT_ADJUST - 10}px`);
    expect(style).toContain(`top: ${200 + T.DIALOG_TOP_ADJUST - (1080 - T.LINE_TOP_MAP_HEIGHT_BASE) - 20}px`);
  });
});

describe("关闭交互与暴露", () => {
  it("点击关闭图标调用 dialogData.closeDialog", async () => {
    const dialogData = createDialogData();
    const wrapper = mountDialog({ dialogData });
    await wrapper.find(".dialogCloseIcon").trigger("click");
    expect(dialogData.closeDialog).toHaveBeenCalled();
  });

  it("expose dialogEl ref（供父组件测量 DOM 尺寸）", () => {
    const wrapper = mountDialog();
    expect(wrapper.vm.dialogEl).toBeTruthy();
    expect(wrapper.vm.dialogEl).toBe(wrapper.find(".dialog").element);
  });

  it("不使用全局 id='dialog'（多实例无 ID 冲突）", () => {
    const wrapper1 = mountDialog();
    const wrapper2 = mountDialog();
    expect(wrapper1.find("#dialog").exists()).toBe(false);
    expect(wrapper2.find("#dialog").exists()).toBe(false);
    // 两个实例可同时挂载
    expect(wrapper1.find(".dialog").exists()).toBe(true);
    expect(wrapper2.find(".dialog").exists()).toBe(true);
  });
});
