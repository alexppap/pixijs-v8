/**
 * FileName: domDrag.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 2.2 —— domDrag 移植测试。验收点：
 *              handleDrag 视口边界 clamp、changePlace 层级置顶、
 *              dragAble/touchstartDragAble 返回 cleanup 防监听泄漏（H-2）。
 * Version: 1.0.0
 */
import { describe, it, expect, vi } from "vitest";
import {
  handleDrag,
  dragAble,
  touchstartDragAble,
  changePlace,
} from "@/components/Pixi/utils/domDrag";

describe("handleDrag（视口边界 clamp）", () => {
  it("clamp 到 [0, innerWidth-offsetWidth] 并写回 left/top", () => {
    const index = { left: 0, top: 0 };
    const move = handleDrag({
      element: { offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 50 },
      index,
      startX: 0,
      startY: 0,
    });

    move(-100, -100); // 下边界 clamp 到 0
    expect(index.left).toBe(0);
    expect(index.top).toBe(0);

    move(99999, 99999); // 上边界 clamp 到 innerWidth-100 / innerHeight-50
    expect(index.left).toBe(window.innerWidth - 100);
    expect(index.top).toBe(window.innerHeight - 50);
  });
});

describe("changePlace（层级置顶）", () => {
  it("拖动项 zIndex 置顶，其余项依序下移", () => {
    const a = { id: "a", zIndex: 1 };
    const b = { id: "b", zIndex: 2 };
    const c = { id: "c", zIndex: 3 };

    changePlace([a, b, c], a);
    expect(a.zIndex).toBe(3);
    expect(b.zIndex).toBe(1);
    expect(c.zIndex).toBe(2);
  });

  it("单项列表或未命中项不调整", () => {
    const a = { id: "a", zIndex: 1 };
    changePlace([a], a);
    expect(a.zIndex).toBe(1);
    changePlace([a], { id: "x", zIndex: 0 });
    expect(a.zIndex).toBe(1);
  });
});

describe("dragAble（返回 cleanup，H-2 防泄漏）", () => {
  it("cleanup 调用后移除全部 document 监听", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const el = document.createElement("div");
    const index = { id: "c1", left: 0, top: 0, zIndex: 1 };
    const lst = [index, { id: "c2", left: 0, top: 0, zIndex: 2 }];

    const cleanup = dragAble({
      el,
      index,
      e: { clientX: 10, clientY: 10 },
      showCameraLst: lst,
    });
    expect(typeof cleanup).toBe("function");

    cleanup();
    const events = removeSpy.mock.calls.map((call) => call[0]);
    expect(events).toEqual(
      expect.arrayContaining(["mousemove", "mouseup", "mouseleave"])
    );
    removeSpy.mockRestore();
  });

  it("mouseup 触发后自动清理，后续 mousemove 不再写回位置", () => {
    const el = document.createElement("div");
    const index = { id: "c1", left: 0, top: 0, zIndex: 1 };

    dragAble({
      el,
      index,
      e: { clientX: 100, clientY: 100 },
      showCameraLst: [index],
    });
    document.dispatchEvent(new MouseEvent("mouseup"));
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 300, clientY: 300 })
    );

    // 监听已随 mouseup 移除，位置不再变化
    expect(index.left).toBe(0);
    expect(index.top).toBe(0);
  });

  it("el 为空时返回 noop，调用不报错", () => {
    const cleanup = dragAble({
      el: null,
      index: { id: "c1" },
      e: { clientX: 0, clientY: 0 },
      showCameraLst: [],
    });
    expect(typeof cleanup).toBe("function");
    expect(() => cleanup()).not.toThrow();
  });
});

describe("touchstartDragAble（返回 cleanup，H-2 防泄漏）", () => {
  it("cleanup 调用后移除 touchmove/touchend 监听", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const el = document.createElement("div");
    const index = { id: "c1", left: 0, top: 0, zIndex: 1 };

    const cleanup = touchstartDragAble({
      el,
      index,
      e: { touches: [{ clientX: 5, clientY: 5 }] },
      showCameraLst: [index],
    });
    expect(typeof cleanup).toBe("function");

    cleanup();
    const events = removeSpy.mock.calls.map((call) => call[0]);
    expect(events).toEqual(expect.arrayContaining(["touchmove", "touchend"]));
    removeSpy.mockRestore();
  });

  it("el 为空时返回 noop，调用不报错", () => {
    const cleanup = touchstartDragAble({
      el: null,
      index: { id: "c1" },
      e: { touches: [{ clientX: 0, clientY: 0 }] },
      showCameraLst: [],
    });
    expect(typeof cleanup).toBe("function");
    expect(() => cleanup()).not.toThrow();
  });
});
