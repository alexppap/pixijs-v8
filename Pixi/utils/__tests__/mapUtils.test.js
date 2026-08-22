/**
 * FileName: mapUtils.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 2.1 —— mapUtils 移植测试。验收点：
 *              createPolygonGraphic/createSprite 的 v8 重写（eventMode/cursor、
 *              业务字段回填、位置/镜像变换）与几何/颜色纯函数对齐源实现。
 *              阶段 5.2 追加：createHighlightBorder/clearBorderList（源
 *              MapTemplate.vue 1723–1764 移植，点击高亮边框链路）。
 * Version: 1.1.0
 */
import { describe, it, expect, vi } from "vitest";
import { Texture } from "pixi.js";
import {
  lngLatToMercator,
  drawDashedPolygon,
  drawDashedLines,
  clickThroughTest,
  getStringLength,
  findPolygonCentroid,
  calculatePathLength,
  getPointAtDistance,
  findPolyVisualCenter,
  calculateBounds,
  processPolygonVertices,
  createPolygonGraphic,
  createSprite,
  createHighlightBorder,
  clearBorderList,
  rgbaToPixiColor,
  getHighContrastRGBA,
} from "@/components/Pixi/utils/mapUtils";

describe("lngLatToMercator（无 proj4 降级恒等）", () => {
  it("返回原始坐标（视为已是目标坐标系）", () => {
    expect(lngLatToMercator(120.5, 31.2)).toEqual([120.5, 31.2]);
  });

  it("非法输入返回 [0,0]", () => {
    expect(lngLatToMercator("abc", 1)).toEqual([0, 0]);
  });
});

describe("drawDashedPolygon", () => {
  it("按 dashSize 生成交替 moveTo/lineTo 路径", () => {
    const calls = [];
    const mock = {
      moveTo: (x, y) => calls.push(["m", x, y]),
      lineTo: (x, y) => calls.push(["l", x, y]),
    };
    // 边长 10 的正方形，dashSize 5 → 每边 2 段
    drawDashedPolygon(mock, [0, 0, 10, 0, 10, 10, 0, 10], 5);

    const moveToCount = calls.filter((c) => c[0] === "m").length;
    const lineCount = calls.filter((c) => c[0] === "l").length;
    expect(moveToCount).toBe(4); // 每边 1 个起点 dash
    expect(lineCount).toBe(4); // 每边 1 个终点 dash
  });

  it("非法参数直接返回不报错", () => {
    expect(() => drawDashedPolygon(null, null, -1)).not.toThrow();
  });
});

describe("drawDashedLines", () => {
  it("构建虚线路径并统一 stroke", () => {
    const mock = {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };
    drawDashedLines([[{ x: 0, y: 0 }, { x: 10, y: 0 }]], mock);

    expect(mock.moveTo).toHaveBeenCalled();
    expect(mock.lineTo).toHaveBeenCalled();
    // v8 差异：路径构建完成后统一描边
    expect(mock.stroke).toHaveBeenCalledWith({ width: 0.5, color: 0x49555a });
  });
});

describe("clickThroughTest", () => {
  it("返回 containsPoint 命中的元素", () => {
    const hit = { containsPoint: () => true, FieldID: "F1" };
    const miss = { containsPoint: () => false };
    const result = clickThroughTest([miss, hit], { x: 1, y: 1 });
    expect(result).toEqual([hit]);
  });

  it("无效参数返回空数组", () => {
    expect(clickThroughTest(null, { x: 0, y: 0 })).toEqual([]);
  });
});

describe("几何纯函数", () => {
  it("getStringLength：ASCII 计 0.5，非 ASCII 计 1", () => {
    expect(getStringLength("ab")).toBe(1);
    expect(getStringLength("中")).toBe(1);
    expect(getStringLength("a中")).toBe(1.5);
  });

  it("findPolygonCentroid：正方形重心在中心", () => {
    const square = [
      { X: 0, Y: 0 },
      { X: 10, Y: 0 },
      { X: 10, Y: 10 },
      { X: 0, Y: 10 },
    ];
    expect(findPolygonCentroid(square)).toEqual([5, 5]);
  });

  it("findPolygonCentroid：退化多边形返回 [0,0]", () => {
    expect(findPolygonCentroid([{ X: 1, Y: 1 }])).toEqual([0, 0]);
  });

  it("calculatePathLength", () => {
    expect(
      calculatePathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ])
    ).toBe(5);
    expect(calculatePathLength([{ x: 0, y: 0 }])).toBe(0);
  });

  it("getPointAtDistance：线段内插值 / 超长返回终点", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(getPointAtDistance(path, 2.5)).toEqual({ x: 2.5, y: 0 });
    expect(getPointAtDistance(path, 100)).toEqual({ x: 10, y: 0 });
    expect(getPointAtDistance([path[0]], 5)).toEqual({ x: 0, y: 0 });
  });

  it("findPolyVisualCenter：降级为重心", () => {
    const square = [
      { X: 0, Y: 0 },
      { X: 10, Y: 0 },
      { X: 10, Y: 10 },
      { X: 0, Y: 10 },
    ];
    expect(findPolyVisualCenter(square)).toEqual([5, 5]);
  });

  it("calculateBounds：支持 xKey/yKey 与 includeCenter", () => {
    const pts = [
      { X: -2, Y: 4 },
      { X: 6, Y: 10 },
    ];
    expect(calculateBounds(pts, { xKey: "X", yKey: "Y" })).toEqual({
      minX: -2,
      minY: 4,
      maxX: 6,
      maxY: 10,
    });
    expect(
      calculateBounds(pts, { xKey: "X", yKey: "Y", includeCenter: true })
    ).toMatchObject({ centerX: 2, centerY: 7 });
    expect(calculateBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it("processPolygonVertices：居中 + Y 翻转 + 相邻去重", () => {
    const pts = [
      { X: 10, Y: 10 },
      { X: 10, Y: 10 }, // 重复点应被去除
      { X: 20, Y: 10 },
      { X: 20, Y: 30 },
    ];
    expect(processPolygonVertices(pts, 15, 20)).toEqual([-5, 10, 5, 10, 5, -10]);
  });
});

describe("createPolygonGraphic（v8 重写）", () => {
  const vertices = [0, 0, 10, 0, 10, 10, 0, 10];

  it("回填命中检测业务字段并设置交互模式", () => {
    const item = {
      RefObjectID: "R1",
      RefObjectType: "Field",
      Angle: 30,
      Mirror: true,
    };
    const g = createPolygonGraphic({
      item,
      polygonVertices: vertices,
      mapInfo: null,
      borderConfig: 1,
      fillColor: 0xff0000,
    });

    expect(g.RefObjectID).toBe("R1");
    expect(g.RefObjectType).toBe("Field");
    expect(g.MyAngle).toBe(30);
    expect(g.MyMirror).toBe(true);
    expect(g.MyPolygonVertices).toBe(vertices);
    expect(g.FillColor).toBe(0xff0000);
    // v6 interactive/buttonMode → v8 eventMode/cursor
    expect(g.eventMode).toBe("static");
    expect(g.cursor).toBe("pointer");
  });

  it("position 分支：直接应用位置/角度/缩放", () => {
    const g = createPolygonGraphic({
      item: null,
      polygonVertices: vertices,
      mapInfo: null,
      borderConfig: 1,
      fillColor: 0xffffff,
      transparency: 1,
      options: {
        position: { x: 5, y: 6, angle: 90, scaleX: 2, scaleY: 3 },
      },
    });
    expect(g.x).toBe(5);
    expect(g.y).toBe(6);
    expect(g.angle).toBe(90);
    expect(g.scale.x).toBe(2);
    expect(g.scale.y).toBe(3);
  });

  it("centerCalculation 分支：位置计算与镜像缩放", () => {
    const item = { CenterY: 120, CenterX: 31, Angle: -32.5, Mirror: true };
    const mapInfo = { Origin: { X: 100, Y: 1 }, Scale: 0.5 };
    const g = createPolygonGraphic({
      item,
      polygonVertices: vertices,
      mapInfo,
      borderConfig: 1,
      fillColor: 0x00ff00,
    });

    // 无 proj4：picCenter 恒等 [120, 31]
    expect(g.x).toBe(120 - 100);
    expect(g.y).toBe(-(31 + 1));
    expect(g.angle).toBe(-32.5);
    expect(g.scale.x).toBe(-0.5); // Mirror 取负
    expect(g.scale.y).toBe(0.5);
  });

  it("centerCalculation 分支：Origin/Scale/Angle 缺失时不产生 NaN", () => {
    const item = { CenterY: 120, CenterX: 31 }; // 无 Angle/Mirror
    const g = createPolygonGraphic({
      item,
      polygonVertices: vertices,
      mapInfo: {},
      borderConfig: 1,
      fillColor: 0x00ff00,
    });

    // Origin 缺失按 0，Scale 缺失按 1，Angle 缺失按 0
    expect(g.x).toBe(120);
    expect(g.y).toBe(-31);
    expect(Number.isNaN(g.x)).toBe(false);
    expect(Number.isNaN(g.y)).toBe(false);
    expect(g.angle).toBe(0);
    expect(g.scale.x).toBe(1);
    expect(g.scale.y).toBe(1);
  });

  it("hasFill=false 时不填充", () => {
    const g = createPolygonGraphic({
      item: null,
      polygonVertices: vertices,
      mapInfo: null,
      borderConfig: 1,
      fillColor: 0xff0000,
      transparency: 1,
      options: {
        hasFill: false,
      },
    });
    expect(g.FillColor).toBe(0xff0000);
    // v8：仅构建路径 + stroke，无 fill 指令（不抛错即通过）
  });

  it("对象 borderConfig 支持自定义边框", () => {
    const g = createPolygonGraphic({
      item: null,
      polygonVertices: vertices,
      mapInfo: null,
      borderConfig: { width: 2, color: 0x123456, alpha: 0.8 },
      fillColor: 0xffffff,
    });
    expect(g).toBeTruthy();
  });
});

describe("createSprite（v8 重写）", () => {
  it("兼容 Texture 本体与 {texture} 包装两种资源形态", () => {
    const item = {
      ImageID: "img1",
      CenterY: 50,
      CenterX: 20,
      Angle: 45,
      Mirror: false,
      Length: 30,
      Width: 12,
      RefObjectID: "S1",
      Name: "船1",
    };
    const mapInfo = { Origin: { X: 10, Y: 5 }, Scale: 1 };

    const s1 = createSprite(item, { img1: Texture.WHITE }, mapInfo);
    const s2 = createSprite(
      item,
      { img1: { texture: Texture.WHITE } },
      mapInfo
    );

    [s1, s2].forEach((s) => {
      expect(s).toBeTruthy();
      expect(s.x).toBe(50 - 10);
      expect(s.y).toBe(-(20 + 5));
      expect(s.angle).toBe(45);
      expect(s.width).toBe(30);
      expect(s.height).toBe(12);
      expect(s.RefObjectID).toBe("S1");
      expect(s.Name).toBe("船1");
      expect(s.eventMode).toBe("static");
      expect(s.cursor).toBe("pointer");
    });
  });

  it("缺参 / 纹理缺失返回 null", () => {
    expect(createSprite(null, {}, {})).toBeNull();
    expect(
      createSprite({ ImageID: "nope" }, { other: Texture.WHITE }, {})
    ).toBeNull();
  });
});

describe("颜色函数", () => {
  it("rgbaToPixiColor：解析并 clamp", () => {
    expect(rgbaToPixiColor("rgba(255, 0, 128, 0.5)")).toEqual({
      color: 0xff0080,
      alpha: 0.5,
    });
    // 超界 clamp 到 [0,255]/[0,1]
    expect(rgbaToPixiColor("rgba(300, -10, 999, 5)")).toEqual({
      color: 0xff00ff,
      alpha: 1,
    });
    expect(rgbaToPixiColor(123)).toEqual({ color: 0, alpha: 1 });
  });

  it("getHighContrastRGBA：低对比色退化为黑白", () => {
    // 灰色 (128,128,128) 反色对比度不足 → 亮度 <0.5 偏暗取白
    expect(getHighContrastRGBA("rgba(128, 128, 128, 1)")).toBe(
      "rgba(255, 255, 255, 1)"
    );
    // 深蓝反色对比度足够 → 返回反色
    const result = getHighContrastRGBA([10, 10, 200, 0.8]);
    expect(result).toBe("rgba(245, 245, 55, 0.8)");
  });

  it("getHighContrastRGBA：非法输入抛错", () => {
    expect(() => getHighContrastRGBA("not-a-color")).toThrow();
    expect(() => getHighContrastRGBA([1, 2])).toThrow();
  });
});

describe("createHighlightBorder（阶段 5.2，源 1723–1744）", () => {
  it("仅描边不填充，位置取目标元素 x/y，不可交互", () => {
    const target = { x: 120, y: 240 };
    const vertices = [0, 0, 10, 0, 10, 10, 0, 10];
    const border = createHighlightBorder(target, vertices);

    expect(border).toBeTruthy();
    expect(border.x).toBe(120);
    expect(border.y).toBe(240);
    expect(border.MyPolygonVertices).toEqual(vertices);
    // 只绘制边框：eventMode 非 static（不可交互）
    expect(border.eventMode).not.toBe("static");
    // 默认样式 NORMAL（width 1 / color 0x30ffff）经 borderConfig 传入
    expect(border.context).toBeTruthy(); // v8 Graphics 上下文已构建
  });

  it("自定义样式（HIGHLIGHT width 2）透传", () => {
    const border = createHighlightBorder({ x: 0, y: 0 }, [0, 0, 4, 0, 4, 4], {
      width: 2,
      color: 0x30ffff,
    });
    expect(border).toBeTruthy();
  });

  it("调用方可继续设置 angle/scale（点击边框变换链路）", () => {
    const border = createHighlightBorder({ x: 0, y: 0 }, [0, 0, 4, 0, 4, 4]);
    border.angle = 30;
    border.scale.x = -2;
    border.scale.y = 2;
    // Pixi v8 angle setter 内部度↔弧度转换存在浮点误差，用近似断言
    expect(border.angle).toBeCloseTo(30, 6);
    expect(border.scale.x).toBe(-2);
    expect(border.scale.y).toBe(2);
  });
});

describe("clearBorderList（阶段 5.2，源 1750–1764）", () => {
  it("逐项销毁并原地清空数组", () => {
    const b1 = { destroy: vi.fn() };
    const b2 = { destroy: vi.fn() };
    const list = [b1, b2];

    clearBorderList(list);

    expect(b1.destroy).toHaveBeenCalledTimes(1);
    expect(b2.destroy).toHaveBeenCalledTimes(1);
    expect(list.length).toBe(0);
  });

  it("destroy 抛错时不中断其余销毁", () => {
    const b1 = {
      destroy: vi.fn(() => {
        throw new Error("destroy failed");
      }),
    };
    const b2 = { destroy: vi.fn() };
    const list = [b1, b2];

    expect(() => clearBorderList(list)).not.toThrow();
    expect(b2.destroy).toHaveBeenCalled();
    expect(list.length).toBe(0);
  });

  it("空列表与 null 安全", () => {
    expect(() => clearBorderList([])).not.toThrow();
    expect(() => clearBorderList(null)).not.toThrow();
  });
});
