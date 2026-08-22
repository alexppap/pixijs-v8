/**
 * FileName: debounce.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 2.2 —— 手写 debounce 测试（对齐源 watch 的
 *              debounce(fn, 200) trailing 使用面）。
 * Version: 1.0.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "@/components/Pixi/utils/debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("延迟到期后只执行最后一次调用（trailing）", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced(1);
    vi.advanceTimersByTime(100);
    debounced(2);
    debounced(3);
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("连续调用会重置计时窗口", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    debounced();
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("保留 this 与参数", () => {
    const ctx = { tag: "ctx" };
    const fn = vi.fn(function callback() {
      return this;
    });
    const debounced = debounce(fn, 100);

    debounced.call(ctx, "a", "b");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("a", "b");
    expect(fn.mock.results[0].value).toBe(ctx);
  });

  it("cancel 取消未执行的调用", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(300);

    expect(fn).not.toHaveBeenCalled();
  });

  it("flush 立即执行挂起的调用", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced("x");
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("x");

    // flush 后不再重复执行
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("非函数入参抛 TypeError", () => {
    expect(() => debounce(null)).toThrow(TypeError);
  });
});
