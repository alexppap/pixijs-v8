/**
 * FileName: text.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 3.2 —— layers/text.js 移植测试。验收点：
 *              drawFieldTexts 标签绘制（anchor/经纬度定位/角度）、
 *              drawFieldText 多行文本容器（居中/旋转）、可点击模式下
 *              pointerdown 绑定与弹窗流程（closeDialog/边框登记/
 *              calculateDialogPosition/adjustDialogVerticalPosition）。
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
import { drawFieldTexts, drawFieldText } from "@/components/Pixi/layers/text";
import { createPolygonGraphic } from "@/components/Pixi/utils/mapUtils";
import { createTextState } from "@/components/Pixi/state/textState";

const MAP_INFO = { Origin: { X: 10, Y: 20 } };

describe("drawFieldTexts（场地标签）", () => {
  it("按经纬度定位标签并应用角度", () => {
    const textState = createTextState();
    const container = new Container();
    const props = {
      FieldTextInfos: {
        LayerLabelOverlayInfos: [
          { Label: "标签1", MapLocation: { CenterX: 100, CenterY: 200, Angle: 30 } },
        ],
      },
    };

    drawFieldTexts({
      props,
      mapInfo: MAP_INFO,
      mapContainer: container,
      textState,
    });

    expect(textState.FieldTexts.length).toBe(1);
    const label = toRaw(textState.FieldTexts[0]);
    expect(label.textValue).toBe("标签1");
    // lngLatToMercator(CenterY=200, CenterX=100) 无 proj4 恒等 → [200, 100]
    expect(label.x).toBe(200 - 10);
    expect(label.y).toBe(-(100 + 20));
    // angle 存在度↔弧度往返转换，存在浮点误差
    expect(label.angle).toBeCloseTo(30);
    expect(label.anchor.x).toBe(0.5);
    expect(label.anchor.y).toBe(0.5);
    expect(container.children).toContain(label);
  });

  it("重复绘制先销毁旧实例", () => {
    const textState = createTextState();
    const props = {
      FieldTextInfos: {
        LayerLabelOverlayInfos: [
          { Label: "L", MapLocation: { CenterX: 0, CenterY: 0, Angle: 0 } },
        ],
      },
    };

    drawFieldTexts({
      props,
      mapInfo: MAP_INFO,
      mapContainer: new Container(),
      textState,
    });
    drawFieldTexts({
      props,
      mapInfo: MAP_INFO,
      mapContainer: new Container(),
      textState,
    });

    expect(textState.FieldTexts.length).toBe(1);
  });
});

describe("drawFieldText（场地文字 + 点击弹窗）", () => {
  const buildCtx = (overrides = {}) => {
    const textState = createTextState();
    const container = new Container();
    const MapLayerPush = vi.fn();
    const setClickedMapItemBorder = vi.fn();

    // 目标图形：模拟 drawClickableLayer 产物
    const target = createPolygonGraphic({
      item: null,
      polygonVertices: [0, 0, 10, 0, 10, 10, 0, 10],
      mapInfo: null,
      borderConfig: { width: 1, color: 0x000000 },
      fillColor: 0x00ff00,
      transparency: 1,
      options: { position: { x: 3, y: 4, angle: 15, scaleX: 1, scaleY: 1 } },
    });
    target.FieldID = "F1";
    target.polygonVertices = [0, 0, 10, 0, 10, 10, 0, 10];

    const DialogData = {
      showDialog: false,
      zoomX: 1,
      zoomY: 1,
      DialogX: 0,
      DialogY: 0,
      lineX: 0,
      lineY: 0,
      lineLength: 0,
      lineDeg: 0,
      ClickedMapItems: [],
      closeDialog: vi.fn(),
    };

    const arr = [
      {
        FieldID: "F1",
        text: ["第一行", "第二行"],
        Angle: 45,
        MapPoints: [
          { X: 0, Y: 0 },
          { X: 10, Y: 0 },
          { X: 10, Y: 10 },
          { X: 0, Y: 10 },
        ],
        DialogData: { a: 1, b: 2 },
      },
    ];

    const ctx = {
      arr,
      mapInfo: MAP_INFO,
      mapContainer: container,
      props: { fieldClickable: true, FieldInfos: {} },
      MapLayer: [target],
      dialogState: { DialogData, setClickedMapItemBorder },
      MapLayerPush,
      textState,
      ...overrides,
    };
    return { ctx, target, DialogData, MapLayerPush, setClickedMapItemBorder, container, textState };
  };

  it("创建多行文本容器：逐行叠加、水平居中、整体旋转", () => {
    const { ctx, textState } = buildCtx();

    drawFieldText(ctx);

    expect(textState.FieldTextsPIXI.length).toBe(1);
    const textContainer = textState.FieldTextsPIXI[0];
    expect(textContainer.children.length).toBe(2);
    // 每行 x = -width/2 居中
    textContainer.children.forEach((child) => {
      expect(child.x).toBe(-40);
    });
    // 第二行 y 上移 LINE_HEIGHT
    expect(textContainer.children[1].y).toBe(-40);
    // 旋转 45°（弧度）
    expect(textContainer.rotation).toBeCloseTo((45 * Math.PI) / 180);
    // 位置 = 视觉中心(重心 5,5) 经 calculatePosition 转换
    expect(textContainer.x).toBe(5 - 10);
    expect(textContainer.y).toBe(-(5 + 20));
  });

  it("fieldClickable 且无区域汇总时绑定 pointerdown 弹窗流程", () => {
    const { ctx, target, DialogData, MapLayerPush, setClickedMapItemBorder, container } =
      buildCtx();

    drawFieldText(ctx);

    expect(target.listenerCount("pointerdown")).toBe(1);

    // 模拟 v8 点击事件（nativeEvent 字段）
    target.emit("pointerdown", {
      nativeEvent: { clientX: 1500, clientY: 2000 },
    });

    // 关闭旧弹窗（源码四行内联逻辑等价 closeDialog）
    expect(DialogData.closeDialog).toHaveBeenCalled();
    expect(DialogData.showDialog).toBe(true);
    // 右侧溢出（1500 > 1920-150-300）→ 连接线左向 + DialogX 左移 600
    expect(DialogData.DialogX).toBe(1500 - 600);
    // 连接线长度 = sqrt(150² + 70²)
    expect(DialogData.lineLength).toBeCloseTo(Math.hypot(150, 70));
    // 弹窗位置 clientY ÷ zoom = 2000，底部溢出（2000 > 1080-300）→ 上移 min(2,8)*25+80 = 130
    expect(DialogData.DialogY).toBe(2000 - 130);
    // 点击数据与高亮边框
    expect(DialogData.ClickedMapItems).toEqual([target]);
    expect(target.clickEventType).toBe("");
    expect(target.DialogData).toEqual({ a: 1, b: 2 });
    expect(setClickedMapItemBorder).toHaveBeenCalledTimes(1);
    const border = setClickedMapItemBorder.mock.calls[0][0];
    expect(border.x).toBe(3);
    expect(border.y).toBe(4);
    expect(border.angle).toBeCloseTo(15);
    expect(MapLayerPush).toHaveBeenCalledWith(border);
    expect(container.children).toContain(border);
  });

  it("fieldClickable 为 false 不绑定点击", () => {
    const { ctx, target } = buildCtx({
      props: { fieldClickable: false, FieldInfos: {} },
    });

    drawFieldText(ctx);

    expect(target.listenerCount("pointerdown")).toBe(0);
  });

  it("存在 MapAreaTotalInfos 时不绑定点击", () => {
    const { ctx, target } = buildCtx({
      props: {
        fieldClickable: true,
        FieldInfos: { MapAreaTotalInfos: [{ id: 1 }] },
      },
    });

    drawFieldText(ctx);

    expect(target.listenerCount("pointerdown")).toBe(0);
  });

  it("MapLayer 无匹配 FieldID 时不绑定点击（flag 为空）", () => {
    const { ctx, target } = buildCtx();
    ctx.arr[0].FieldID = "NOT_EXIST";

    drawFieldText(ctx);

    expect(target.listenerCount("pointerdown")).toBe(0);
    expect(ctx.textState.FieldTextsPIXI.length).toBe(1);
  });
});
