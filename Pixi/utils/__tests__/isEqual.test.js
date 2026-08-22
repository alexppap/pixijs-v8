/**
 * FileName: isEqual.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 2.2 —— 手写 isEqual 深比较测试。
 * Version: 1.0.0
 */
import { describe, it, expect } from "vitest";
import { isEqual } from "@/components/Pixi/utils/isEqual";

describe("isEqual", () => {
  it("原始值相等", () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual("a", "a")).toBe(true);
    expect(isEqual(true, true)).toBe(true);
    expect(isEqual(NaN, NaN)).toBe(true);
  });

  it("原始值不等 / 类型不同", () => {
    expect(isEqual(1, 2)).toBe(false);
    expect(isEqual(1, "1")).toBe(false);
    expect(isEqual(null, undefined)).toBe(false);
    expect(isEqual(null, {})).toBe(false);
  });

  it("浅对象比较", () => {
    expect(isEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("嵌套对象深比较", () => {
    const a = { LayerInfos: [{ Angle: -32.5, Dashed: false }], Scale: 0.5 };
    const b = { LayerInfos: [{ Angle: -32.5, Dashed: false }], Scale: 0.5 };
    expect(isEqual(a, b)).toBe(true);

    b.LayerInfos[0].Angle = 0;
    expect(isEqual(a, b)).toBe(false);
  });

  it("数组深比较", () => {
    expect(isEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(isEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
    expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });

  it("空对象/空数组", () => {
    expect(isEqual({}, {})).toBe(true);
    expect(isEqual([], [])).toBe(true);
    expect(isEqual({}, [])).toBe(false);
  });

  it("嵌套 null 与 undefined", () => {
    expect(isEqual({ a: null }, { a: null })).toBe(true);
    expect(isEqual({ a: null }, { a: undefined })).toBe(false);
  });
});
