/**
 * FileName: isEqual.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 手写深比较（替代 lodash.isEqual，对齐源 MapTemplate watch
 *              中的使用面：比较普通对象/数组/原始值）。不处理 Map/Set/
 *              Date/RegExp/TypedArray 等特殊类型（本项目 watch 数据不含）。
 * Version: 1.0.0
 */

/**
 * 深比较两个值是否相等
 * @param {*} value 值一
 * @param {*} other 值二
 * @returns {boolean} 相等为 true
 */
export function isEqual(value, other) {
  if (value === other) return true;
  // NaN 与 NaN 相等（对齐 lodash.isEqual）
  if (Number.isNaN(value) && Number.isNaN(other)) return true;

  if (typeof value !== "object" || typeof other !== "object" || value === null || other === null) {
    return false;
  }

  if (Array.isArray(value) || Array.isArray(other)) {
    if (!Array.isArray(value) || !Array.isArray(other)) return false;
    if (value.length !== other.length) return false;
    return value.every((item, i) => isEqual(item, other[i]));
  }

  const keysA = Object.keys(value);
  const keysB = Object.keys(other);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) =>
    Object.prototype.hasOwnProperty.call(other, key)
      ? isEqual(value[key], other[key])
      : false
  );
}

export default isEqual;
