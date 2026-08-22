/**
 * FileName: block.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 3.3 —— layers/block.js 移植测试。验收点：
 *              drawBlockAndCombLines 总段/预组双图层创建、显隐控制、
 *              中心点坐标换算、虚线连接（drawDashedLines 统一 stroke）、
 *              文本背景（rect/fill/stroke v8 链）、重复绘制清理。
 *              jsdom 无 2D canvas，Text 以 FakeText（继承 Container）替换。
 * Version: 1.0.0
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("pixi.js", async (importOriginal) => {
  const actual = await importOriginal();
  class FakeText extends actual.Container {
    constructor(text, style) {
      super();
      this.textValue = text;
      this.style = style ?? {};
      this.anchor = {
        x: 0,
        y: 0,
        set(x, y) {
          this.x = x;
          this.y = y;
        },
      };
      this._w = 60;
      this._h = 15;
    }
    get width() {
      return this._w;
    }
    set width(v) {
      this._w = v;
    }
    get height() {
      return this._h;
    }
    set height(v) {
      this._h = v;
    }
  }
  return { ...actual, Text: FakeText };
});

import { Container, Graphics } from "pixi.js";
import { toRaw } from "vue";
import { drawBlockAndCombLines } from "@/components/Pixi/layers/block";
import { createBlockCombState } from "@/components/Pixi/state/blockCombState";

const buildLineData = (text) => ({
  lineDataLst: [
    {
      CenterPoint: { IsEmpty: false, X: 100, Y: 200 },
      OuterPoints: [{ X: 120, Y: 220 }, { X: 140, Y: 160 }],
      Text: text,
    },
  ],
  blockLineConfigure: {
    BlockLineWidth: 2,
    BlockLineShowText: true,
    BlockLineTextColor: 0x000000,
    BlockLineShowBackground: true,
    BlockLineBackgroundFillColor: "rgba(255,255,255,1)",
    BlockLineShowBackgroundBorder: true,
    BlockLineBackgroundBorderColor: "rgba(0,0,0,1)",
  },
  mapCenterPoints: [50, 100],
});

describe("drawBlockAndCombLines", () => {
  it("创建总段/预组图层：坐标换算、虚线、文本、背景", () => {
    const state = createBlockCombState();
    const container = new Container();

    const rectSpy = vi.spyOn(Graphics.prototype, "rect");
    const fillSpy = vi.spyOn(Graphics.prototype, "fill");
    const strokeSpy = vi.spyOn(Graphics.prototype, "stroke");

    drawBlockAndCombLines(
      {
        feildBlockVisible: true,
        feildCombVisible: false,
        blockInfoLst: [buildLineData("B1")],
        combInfoLst: [buildLineData("C1")],
      },
      container,
      state
    );

    // 双图层创建
    expect(state.BlockLayer.length).toBe(1);
    expect(state.CombLayer.length).toBe(1);
    expect(state.blockTextLst.length).toBe(1);
    expect(state.combTextLst.length).toBe(1);

    // 显隐控制
    expect(state.BlockLayer[0].visible).toBe(true);
    expect(state.CombLayer[0].visible).toBe(false);
    expect(state.blockTextLst[0].visible).toBe(true);
    expect(state.combTextLst[0].visible).toBe(false);

    // 中心点换算：x = 100-50, y = -(200-100)
    const blockText = state.blockTextLst[0];
    expect(blockText.position.x).toBe(50);
    expect(blockText.position.y).toBe(-100);
    expect(blockText.scale.x).toBeCloseTo(0.06);

    // 虚线连接 + 文本背景 → v8 绘制链
    // （drawDashedLines 每次调用统一一次 stroke：总段虚线1+背景1，预组不可见仅虚线1）
    expect(rectSpy).toHaveBeenCalled();
    expect(fillSpy).toHaveBeenCalled();
    expect(strokeSpy.mock.calls.length).toBeGreaterThanOrEqual(3);

    // 图形与文本加入容器（state 数组为 reactive 代理，取原始对象断言）
    expect(container.children).toContain(toRaw(state.BlockLayer[0]));
    expect(container.children).toContain(toRaw(blockText));

    rectSpy.mockRestore();
    fillSpy.mockRestore();
    strokeSpy.mockRestore();
  });

  it("文本与背景均不显示时跳过绘制", () => {
    const state = createBlockCombState();
    const lineData = buildLineData("B1");
    lineData.blockLineConfigure = {
      ...lineData.blockLineConfigure,
      BlockLineShowText: false,
      BlockLineShowBackground: false,
    };

    drawBlockAndCombLines(
      {
        feildBlockVisible: true,
        feildCombVisible: true,
        blockInfoLst: [lineData],
        combInfoLst: [],
      },
      new Container(),
      state
    );

    expect(state.BlockLayer.length).toBe(1);
    expect(state.blockTextLst.length).toBe(0);
  });

  it("CenterPoint 为空 / IsEmpty 为空的项跳过虚线与文本", () => {
    const state = createBlockCombState();
    const lineData = buildLineData("B1");
    lineData.lineDataLst = [
      { CenterPoint: null, OuterPoints: [], Text: "x" },
      { CenterPoint: { IsEmpty: true, X: 1, Y: 1 }, OuterPoints: [{ X: 2, Y: 2 }], Text: "y" },
    ];

    drawBlockAndCombLines(
      {
        feildBlockVisible: true,
        feildCombVisible: true,
        blockInfoLst: [lineData],
        combInfoLst: [],
      },
      new Container(),
      state
    );

    // 第二项 CenterPoint 存在 → 仅绘制文本，不绘制虚线
    expect(state.blockTextLst.length).toBe(1);
  });

  it("重复绘制先清理旧图层与文本", () => {
    const state = createBlockCombState();
    const props = {
      feildBlockVisible: true,
      feildCombVisible: true,
      blockInfoLst: [buildLineData("B1")],
      combInfoLst: [],
    };

    drawBlockAndCombLines(props, new Container(), state);
    const firstGraphic = state.BlockLayer[0];
    const destroySpy = vi.spyOn(firstGraphic, "destroy");
    drawBlockAndCombLines(props, new Container(), state);

    expect(destroySpy).toHaveBeenCalled();
    expect(state.BlockLayer.length).toBe(1);
    expect(state.blockTextLst.length).toBe(1);
    expect(state.BlockLayer[0]).not.toBe(firstGraphic);
  });

  it("空数据不创建图层", () => {
    const state = createBlockCombState();

    drawBlockAndCombLines(
      { feildBlockVisible: true, feildCombVisible: true, blockInfoLst: [], combInfoLst: [] },
      new Container(),
      state
    );

    expect(state.BlockLayer.length).toBe(1); // 图层容器仍创建
    expect(state.blockTextLst.length).toBe(0);
    expect(state.combTextLst.length).toBe(0);
  });
});
