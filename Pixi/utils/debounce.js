/**
 * FileName: debounce.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 手写 debounce（替代 lodash.debounce，对齐源 MapTemplate 中
 *              watch 的使用面：debounce(fn, 200) 默认 trailing 触发）。
 *              支持 cancel/flush；不含 lodash 的 maxWait/leading 选项。
 * Version: 1.0.0
 */

/**
 * 创建防抖函数：延迟 wait 毫秒后执行最后一次调用（trailing）
 * @param {Function} func 待防抖函数
 * @param {number} wait 延迟毫秒数
 * @returns {Function} 防抖函数（挂载 cancel/flush 方法）
 */
export function debounce(func, wait = 0) {
  if (typeof func !== "function") {
    throw new TypeError("Expected a function");
  }

  let timerId = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke() {
    timerId = null;
    const args = lastArgs;
    const context = lastThis;
    lastArgs = null;
    lastThis = null;
    if (args) func.apply(context, args);
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(invoke, wait);
  }

  /**
   * 取消未执行的调用
   */
  debounced.cancel = function cancel() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    lastArgs = null;
    lastThis = null;
  };

  /**
   * 立即执行挂起的调用（无挂起调用则不执行）
   * @returns {*} func 的返回值（未执行为 undefined）
   */
  debounced.flush = function flush() {
    if (!timerId) return undefined;
    clearTimeout(timerId);
    invoke();
  };

  return debounced;
}

export default debounce;
