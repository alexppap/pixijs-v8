/**
 * FileName: layer.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 3.1 —— layers/layer.js 移植测试。验收点：
 *              drawLayer 三分支（isHull/fieldClickable/merged）、
 *              Graphics 命中字段回填（FieldID/name/polygonVertices/
 *              centerX/centerY）、v8 交互（eventMode/cursor）、
 *              clearMapLayers 销毁清理、recolor 颜色重绘。
 *              jsdom 无 2D canvas，Text 以 FakeText（继承 Container）替换，
 *              仅覆盖本模块逻辑，不测 pixi 内部。
 * Version: 1.0.0
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Graphics } from "pixi.js";

// Text 打桩：jsdom 无 canvas，v8 Text 宽高测量不可用
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
      this._w = 80;
      this._h = 20;
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

import { Container } from "pixi.js";
import { toRaw } from "vue";
import { drawLayer, clearMapLayers, recolor } from "@/components/Pixi/layers/layer";
import { createMapLayerState } from "@/components/Pixi/state/mapLayerState";

const SQUARE_POINTS = [
  { X: 0, Y: 0 },
  { X: 10, Y: 0 },
  { X: 10, Y: 10 },
  { X: 0, Y: 10 },
];

const HULL_PROPS = {
  isHull: true,
  feildTextVisible: true,
  mapLayerInfos: [
    {
      FieldID: "F1",
      Name: "场地A",
      TextColor: 0xffffff,
      BorderWidth: 1,
      BorderColor: 0x000000,
      FillColor: 0x123456,
      MapPoints: SQUARE_POINTS,
    },
  ],
};

const MERGED_MAP_INFO = {
  LayerInfos: [
    {
      ZIndex: 1,
      Elements: [
        {
          Type: "Polygon",
          FieldID: "F2",
          BorderWidth: 1,
          BorderColor: 0x111111,
          FillColor: 0x00ff00,
          MapPoints: SQUARE_POINTS,
        },
      ],
    },
    {
      ZIndex: -10,
      Elements: [
        {
          Type: "Polygon",
          FieldID: "F3",
          BorderWidth: 1,
          BorderColor: 0x222222,
          FillColor: 0x0000ff,
          BorderType: "Custom",
          MapPoints: SQUARE_POINTS,
        },
      ],
    },
  ],
};

describe("drawLayer — isHull 分支", () => {
  it("创建图形 + 文本并回填命中字段/中心点，绑定 pointerdown", () => {
    const state = createMapLayerState();
    const container = new Container();
    const onHullFieldClick = vi.fn();
    const xarr = [];
    const yarr = [];
    const arr = [];

    drawLayer({
      xarr,
      yarr,
      arr,
      props: HULL_PROPS,
      mapContainer: container,
      onHullFieldClick,
      mapInfo: null,
      state,
    });

    expect(state.MapLayer.length).toBe(1);
    // state 数组为 reactive 代理，取原始对象做身份断言
    const mapElement = toRaw(state.MapLayer[0]);
    expect(mapElement.FieldID).toBe("F1");
    expect(mapElement.name).toBe("场地A");
    expect(mapElement.MyPolygonVertices).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
    // v8 交互
    expect(mapElement.eventMode).toBe("static");
    expect(mapElement.cursor).toBe("pointer");
    // 中心点（正方形重心）
    expect(mapElement.centerX).toBeCloseTo(5);
    expect(mapElement.centerY).toBeCloseTo(5);
    // 点击绑定
    expect(mapElement.listenerCount("pointerdown")).toBe(1);
    // 坐标收集（供坐标系重置）
    expect(xarr).toEqual([0, 10, 10, 0]);
    expect(yarr).toEqual([0, 0, 10, 10]);
    expect(arr).toHaveLength(4);

    // 名称存在 → 生成场地文字
    expect(state.fieldTextLst.length).toBe(1);
    const fieldText = toRaw(state.fieldTextLst[0]);
    expect(fieldText.textValue).toBe("场地A");
    expect(fieldText.visible).toBe(true);
    expect(container.children).toContain(mapElement);
    expect(container.children).toContain(fieldText);
  });

  it("无名称的元素不生成场地文字", () => {
    const state = createMapLayerState();
    const props = {
      isHull: true,
      feildTextVisible: true,
      mapLayerInfos: [{ ...HULL_PROPS.mapLayerInfos[0], Name: "" }],
    };

    drawLayer({
      xarr: [],
      yarr: [],
      arr: [],
      props,
      mapContainer: new Container(),
      mapInfo: null,
      state,
    });

    expect(state.MapLayer.length).toBe(1);
    expect(state.fieldTextLst.length).toBe(0);
  });
});

describe("drawLayer — fieldClickable 分支", () => {
  it("回填 FieldID/polygonVertices/中心点并设置 v8 交互", () => {
    const state = createMapLayerState();
    const container = new Container();

    drawLayer({
      xarr: [],
      yarr: [],
      arr: [],
      props: { isHull: false, fieldClickable: true },
      mapContainer: container,
      mapInfo: MERGED_MAP_INFO,
      state,
    });

    // MERGED_MAP_INFO 两个图层各含一个 Polygon 元素 → 全部绘制
    expect(state.MapLayer.length).toBe(2);
    const mapElement = toRaw(state.MapLayer[0]);
    expect(mapElement.FieldID).toBe("F2");
    expect(mapElement.polygonVertices).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
    expect(mapElement.MyPolygonVertices).toEqual(mapElement.polygonVertices);
    expect(mapElement.eventMode).toBe("static");
    expect(mapElement.cursor).toBe("pointer");
    expect(mapElement.centerX).toBeCloseTo(5);
    expect(mapElement.centerY).toBeCloseTo(5);
    expect(container.children).toContain(mapElement);
  });
});

describe("drawLayer — merged 分支", () => {
  it("按 ZIndex 拆分主图形/文字图形容器，ZIndex -10 半透明", () => {
    const state = createMapLayerState();
    const container = new Container();

    const polySpy = vi.spyOn(Graphics.prototype, "poly");
    const fillSpy = vi.spyOn(Graphics.prototype, "fill");
    const strokeSpy = vi.spyOn(Graphics.prototype, "stroke");

    drawLayer({
      xarr: [],
      yarr: [],
      arr: [],
      props: { isHull: false, fieldClickable: false },
      mapContainer: container,
      mapInfo: MERGED_MAP_INFO,
      state,
    });

    expect(state.MapLayer.length).toBe(2);
    // state 数组为 reactive 代理，取原始对象做身份断言
    const [mainGraphics, textGraphics] = state.MapLayer.map(toRaw);
    expect(mainGraphics.alpha).toBe(1);
    expect(textGraphics.alpha).toBe(0.5);
    expect(textGraphics.zIndex).toBe(999);
    expect(container.children).toContain(mainGraphics);
    expect(container.children).toContain(textGraphics);

    // v8 绘制链：poly + fill + stroke（虚线分支含 drawDashedPolygon 路径）
    expect(polySpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fillSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(strokeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    polySpy.mockRestore();
    fillSpy.mockRestore();
    strokeSpy.mockRestore();
  });
});

describe("clearMapLayers", () => {
  it("销毁池内元素并清空数组", () => {
    const state = createMapLayerState();
    drawLayer({
      xarr: [],
      yarr: [],
      arr: [],
      props: HULL_PROPS,
      mapContainer: new Container(),
      mapInfo: null,
      state,
    });
    expect(state.MapLayer.length).toBe(1);
    expect(state.fieldTextLst.length).toBe(1);

    const destroySpy = vi.spyOn(state.MapLayer[0], "destroy");

    clearMapLayers(state);

    expect(state.MapLayer.length).toBe(0);
    expect(state.fieldTextLst.length).toBe(0);
    expect(destroySpy).toHaveBeenCalledWith({ children: true });
  });
});

describe("recolor（watch colorList 重绘）", () => {
  let state;

  beforeEach(() => {
    state = createMapLayerState();
    drawLayer({
      xarr: [],
      yarr: [],
      arr: [],
      props: HULL_PROPS,
      mapContainer: new Container(),
      mapInfo: null,
      state,
    });
  });

  it("clear + poly + fill + stroke 重绘图形并更新文字对比色", () => {
    const fillSpy = vi.spyOn(Graphics.prototype, "fill");
    const strokeSpy = vi.spyOn(Graphics.prototype, "stroke");

    const result = recolor(state, [{ fillColor: "rgba(255,0,0,1)" }]);

    expect(result).toBe(true);
    expect(fillSpy).toHaveBeenCalledWith({ color: 0xff0000, alpha: 1 });
    expect(strokeSpy).toHaveBeenCalledWith({
      width: 1,
      color: 0x000000,
    });
    // 红色亮度 0.21 < 4.5 对比阈值 → 高对比色为白色
    expect(state.fieldTextLst[0].style.fill).toBe("rgba(255, 255, 255, 1)");

    fillSpy.mockRestore();
    strokeSpy.mockRestore();
  });

  it("merged 共享图形（无 MyPolygonVertices）跳过重绘不报错", () => {
    const mergedState = createMapLayerState();
    drawLayer({
      xarr: [],
      yarr: [],
      arr: [],
      props: { isHull: false, fieldClickable: false },
      mapContainer: new Container(),
      mapInfo: MERGED_MAP_INFO,
      state: mergedState,
    });

    expect(() =>
      recolor(mergedState, [{ fillColor: "rgba(255,0,0,1)" }])
    ).not.toThrow();
  });

  it("colorList 带 FieldID 时按 FieldID 匹配（顺序无关）", () => {
    const fillSpy = vi.spyOn(Graphics.prototype, "fill");

    // 先放一个匹配不上的颜色项，确认不是靠下标 0 命中的
    const result = recolor(state, [
      { FieldID: "NOT_EXIST", fillColor: "rgba(0,255,0,1)" },
      { FieldID: "F1", fillColor: "rgba(255,0,0,1)" },
    ]);

    expect(result).toBe(true);
    expect(fillSpy).toHaveBeenCalledWith({ color: 0xff0000, alpha: 1 });
    expect(fillSpy).not.toHaveBeenCalledWith({ color: 0x00ff00, alpha: 1 });
    expect(state.fieldTextLst[0].style.fill).toBe("rgba(255, 255, 255, 1)");

    fillSpy.mockRestore();
  });

  it("空颜色列表不重绘", () => {
    expect(recolor(state, [])).toBe(false);
    expect(recolor(state, null)).toBe(false);
  });
});
