/**
 * 几何计算工具函数
 * 包含各种几何图形的计算方法
 */

/**
 * 使用Shoelace公式计算多边形的质心
 * @param {Array} points - 多边形顶点数组，每个顶点包含 x, y 属性
 * @returns {Object} 包含 x, y 坐标的中心点对象
 */
export function calculatePolygonCenter(points) {
    if (points.length < 3) {
        throw new Error('多边形至少需要3个顶点');
    }
    
    let area = 0;
    let centerX = 0;
    let centerY = 0;
    
    // 使用Shoelace公式计算面积和质心
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const cross = points[i].x * points[j].y - points[j].x * points[i].y;
        area += cross;
        centerX += (points[i].x + points[j].x) * cross;
        centerY += (points[i].y + points[j].y) * cross;
    }
    
    area = area / 2;
    
    // 如果面积为0（共线点），使用简单的算术平均
    if (Math.abs(area) < 1e-10) {
        centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    } else {
        centerX = centerX / (6 * area);
        centerY = centerY / (6 * area);
    }
    
    return { x: centerX, y: centerY };
} 

/**
 * 计算多边形的几何中心（顶点坐标的算术平均值）
 * @param {Array} points - 多边形顶点数组，每个顶点包含 x, y 属性
 * @returns {Object} 包含 x, y 坐标的几何中心点对象
 */
export function calculateGeometricCenter(points) {
    if (points.length === 0) {
        throw new Error('顶点数组不能为空');
    }
    
    let sumX = 0;
    let sumY = 0;
    
    // 计算所有顶点坐标的总和
    for (let i = 0; i < points.length; i++) {
        sumX += points[i].x;
        sumY += points[i].y;
    }
    
    // 计算平均值（几何中心）
    const centerX = sumX / points.length;
    const centerY = sumY / points.length;
    
    return { x: centerX, y: centerY };
}