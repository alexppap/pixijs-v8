/**
 * FileName: scaleTransform.test.js
 * Author: alexppap
 * Date: 2026-08-22
 * Description: 阶段优化 —— 缩放变换共享纯函数测试。原先
 *              MapInteraction/CoordinateSystem 两份相同实现均无直接
 *              覆盖（clickHandlers 测试中 coordinateSystem 为 mock），
 *              抽取后补充等价性验证：tempX/tempY 反解、getNewPosition
 *              保持缩放中心不动、scale.x 为 0 时的兜底。
 * Version: 1.0.0
 */
import { describe, it, expect } from "vitest";
import {
  calculateScaleTransform,
} from "@/components/Pixi/utils/scaleTransform";

/** 构造容器桩（position/scale 可链式 set） */
const createContainerStub = (x, y, scale) => ({
  position: {
    x,
    y,
    set(nx, ny) {
      this.x = nx;
      this.y = ny;
    },
  },
  scale: {
    x: scale,
    y: scale,
    set(s) {
      this.x = s;
      this.y = s;
    },
  },
});

describe("calculateScaleTransform", () => {
  it("反解缩放中心在容器局部坐标系下的坐标（tempX/tempY）", () => {
    const container = createContainerStub(-100, -50, 2);
    const { tempX, tempY } = calculateScaleTransform(container, {
      x: 200,
      y: 150,
    });

    // tempX = (-(-100) + 200) / 2 = 150；tempY = (-(-50) + 150) / 2 = 100
    expect(tempX).toBe(150);
    expect(tempY).toBe(100);
  });

  it("getNewPosition 保持缩放中心在画布上不动", () => {
    const container = createContainerStub(-100, -50, 2);
    const centerPos = { x: 200, y: 150 };
    const transform = calculateScaleTransform(container, centerPos);

    // 缩放至 4 倍：newX = -(150 * 4 - 200) = -400；newY = -(100 * 4 - 150) = -250
    const pos = transform.getNewPosition(4);
    expect(pos).toEqual({ x: -400, y: -250 });

    // 验证不变量：新位置下，中心点经容器逆变换仍映射回 centerPos
    container.scale.set(4);
    container.position.set(pos.x, pos.y);
    const backX = (centerPos.x - container.position.x) / container.scale.x;
    const backY = (centerPos.y - container.position.y) / container.scale.y;
    expect(backX).toBeCloseTo(transform.tempX);
    expect(backY).toBeCloseTo(transform.tempY);
  });

  it("getNewPosition 解构后调用仍正确（闭包不依赖 this）", () => {
    const container = createContainerStub(0, 0, 1);
    const { getNewPosition } = calculateScaleTransform(container, {
      x: 50,
      y: 60,
    });

    // tempX = 50, tempY = 60；newX = -(50 * 2 - 50) = -50
    expect(getNewPosition(2)).toEqual({ x: -50, y: -60 });
  });

  it("scale.x 为 0/undefined 时按 1 兜底，避免除零", () => {
    const container = createContainerStub(-10, -20, 0);
    const { tempX, tempY } = calculateScaleTransform(container, {
      x: 30,
      y: 40,
    });

    expect(tempX).toBe(40);
    expect(tempY).toBe(60);
  });
});
