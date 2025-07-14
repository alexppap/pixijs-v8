import { calculatePolygonCenter, calculateGeometricCenter } from './utils/geometry.js';

// PixiJS v8 基本示例
class PixiApp {
    constructor() {
        this.app = null;
        this.bunny = null;
        this.centerDot = null;
        this.geometricCenterDot = null; // 几何中心点标记
        this.isRotating = false;
        this.colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        this.colorIndex = 0;
        this.pbsGraphics = []; // PBS图形数组
        
        // 添加视窗控制相关属性
        this.isDragging = false;
        this.lastPointerPosition = { x: 0, y: 0 };
        this.viewport = {
            x: 0,
            y: 0,
            scale: 1,
            minScale: 0.1,
            maxScale: 5
        };
        
        this.init();
        this.setupEventListeners();
    }

    async init() {
        // 获取容器元素
        const container = document.getElementById('pixi-container');
        if (!container) {
            throw new Error('未找到pixi-container元素');
        }

        // 获取容器的实际尺寸
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width || container.clientWidth || 800;
        const containerHeight = containerRect.height || container.clientHeight || 600;

        // 创建 PixiJS 应用实例
        this.app = new PIXI.Application();
        
        // 使用容器的实际尺寸初始化应用
        await this.app.init({
            width: containerWidth,
            height: containerHeight,
            backgroundColor: 0x1099bb,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // 将 canvas 添加到 DOM
        container.appendChild(this.app.canvas);

        // 让canvas填充整个容器
        this.app.canvas.style.width = '100%';
        this.app.canvas.style.height = '100%';
        this.app.canvas.style.display = 'block';
        
        // 设置触摸行为
        this.app.canvas.style.touchAction = 'none';

        // 创建精灵（默认多边形）
        this.createSprite();
        
        // 开始动画循环
        this.setupAnimationLoop();
        
        // 确保在canvas创建完成后设置视窗控制
        this.setupViewportControls();
    }

    createSprite() {
        // 定义不规则多边形的顶点
        this.polygonPoints = [
            { x: 50, y: 10 },   // 顶部
            { x: 90, y: 30 },   // 右上
            { x: 80, y: 70 },   // 右下
            { x: 40, y: 90 },   // 底部
            { x: 10, y: 60 },   // 左下
            { x: 20, y: 20 }    // 左上
        ];
        
        // 计算多边形中心点
        const center = calculatePolygonCenter(this.polygonPoints);
        
        // 创建不规则多边形
        const graphics = new PIXI.Graphics();
        
        // 绘制多边形
        graphics.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
        for (let i = 1; i < this.polygonPoints.length; i++) {
            graphics.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
        }
        graphics.closePath();
        graphics.fill(0xff0000);
        
        // 可选：添加边框
        graphics.stroke({ width: 2, color: 0x000000 });
        
        // 将 graphics 直接赋值给 this.bunny
        this.bunny = graphics;
        
        // 设置旋转和缩放的中心点
        this.bunny.pivot.set(center.x, center.y);
        this.bunny.x = this.app.screen.width / 2;
        this.bunny.y = this.app.screen.height / 2;
        this.bunny.scale.set(1.5);
        
        // 使图形可交互
        this.bunny.eventMode = 'static';
        this.bunny.cursor = 'pointer';

        // 添加到舞台
        this.app.stage.addChild(this.bunny);
    }

    /**
     * 创建厂区形状的多边形图形
     * 设计了一个酷似工厂厂区的复杂多边形，包含主厂房、附属建筑、烟囱等元素
     * @param {boolean} useGeometricCenter - 是否使用几何中心作为旋转点，默认使用质心
     */
    createFactory() {
        // 定义厂区轮廓的顶点坐标（设计为一个复杂的厂区布局）
        this.factoryPoints = [
            // 主厂房区域（大矩形建筑）
            { x: 50, y: 120 },   // 主厂房左下
            { x: 50, y: 80 },    // 主厂房左上
            { x: 200, y: 80 },   // 主厂房右上
            { x: 200, y: 120 },  // 主厂房右下
            
            // 附属建筑1（右侧小建筑）
            { x: 200, y: 120 },  // 连接点
            { x: 220, y: 120 },  // 小建筑右下
            { x: 220, y: 100 },  // 小建筑右上
            { x: 200, y: 100 },  // 小建筑左上
            { x: 200, y: 80 },   // 回到主厂房
            
            // 烟囱区域（高塔结构）
            { x: 180, y: 80 },   // 烟囱底部右
            { x: 180, y: 30 },   // 烟囱顶部右
            { x: 170, y: 30 },   // 烟囱顶部左
            { x: 170, y: 80 },   // 烟囱底部左
            
            // 办公楼区域（左侧建筑）
            { x: 50, y: 80 },    // 连接主厂房
            { x: 30, y: 80 },    // 办公楼右上
            { x: 30, y: 50 },    // 办公楼左上
            { x: 10, y: 50 },    // 办公楼左上角
            { x: 10, y: 110 },   // 办公楼左下
            { x: 30, y: 110 },   // 办公楼右下
            { x: 30, y: 120 },   // 连接点
            { x: 50, y: 120 },   // 回到起点
            
            // 仓库区域（底部建筑）
            { x: 80, y: 120 },   // 仓库左上
            { x: 80, y: 140 },   // 仓库左下
            { x: 160, y: 140 },  // 仓库右下
            { x: 160, y: 120 },  // 仓库右上
        ];

        // 厂区模式下，始终使用几何中心
        const factoryCenter = calculateGeometricCenter(this.factoryPoints);
        
        // 创建厂区图形
        const factoryGraphics = new PIXI.Graphics();
        
        // 绘制主厂区轮廓
        factoryGraphics.moveTo(this.factoryPoints[0].x, this.factoryPoints[0].y);
        for (let i = 1; i < this.factoryPoints.length; i++) {
            factoryGraphics.lineTo(this.factoryPoints[i].x, this.factoryPoints[i].y);
        }
        factoryGraphics.closePath();
        
        // 设置厂区样式（灰蓝色，像工业建筑）
        factoryGraphics.fill(0x4682b4); // 钢蓝色
        factoryGraphics.stroke({ width: 3, color: 0x2f4f4f }); // 深灰绿色边框
        
        // 添加一些内部结构线条（表示建筑分割）
        factoryGraphics.moveTo(50, 80);
        factoryGraphics.lineTo(200, 80);
        factoryGraphics.stroke({ width: 1, color: 0x2f4f4f });
        
        factoryGraphics.moveTo(200, 100);
        factoryGraphics.lineTo(220, 100);
        factoryGraphics.stroke({ width: 1, color: 0x2f4f4f });
        
        factoryGraphics.moveTo(30, 80);
        factoryGraphics.lineTo(30, 120);
        factoryGraphics.stroke({ width: 1, color: 0x2f4f4f });
        
        // 保存厂区图形
        this.factory = factoryGraphics;
        
        // 设置旋转和缩放的中心点
        this.factory.pivot.set(factoryCenter.x, factoryCenter.y);
        
        // 使图形可交互
        this.factory.eventMode = 'static';
        this.factory.cursor = 'pointer';
        
        // 创建并添加PBS单元
        this.createPBS();
        
        // 调用缩放和居中方法
        this.scaleAndCenterGraphic(this.factory);

        // 添加到舞台
        this.app.stage.addChild(this.factory);
        
        const centerType = '几何中心';
        console.log(`厂区创建完成，${centerType}: (${factoryCenter.x.toFixed(2)}, ${factoryCenter.y.toFixed(2)})`);
        
        return this.factory;
    }

    /**
     * 创建PBS单元并将其添加到厂区
     * PBS是位于厂区内的小图形，会跟随厂区一起变换
     */
    createPBS() {
        // 每次创建厂区时，都会重新创建PBS，所以先清空数组
        this.pbsGraphics = [];

        // 定义PBS的位置、颜色、形状等属性（坐标相对于厂区内部）
        const pbsData = [
            { x: 100, y: 100, color: 0x00ff00, shape: 'circle', size: 5 }, // 主厂房内
            { x: 20, y: 70, color: 0xffff00, shape: 'rect', size: 8 },      // 办公楼内
            { x: 120, y: 130, color: 0x00ffff, shape: 'circle', size: 6 }, // 仓库内
            { x: 175, y: 60, color: 0xff00ff, shape: 'rect', size: 7 },    // 烟囱附近
        ];

        pbsData.forEach(data => {
            const pbsGraphic = new PIXI.Graphics();
            
            // 根据数据绘制不同形状
            if (data.shape === 'circle') {
                pbsGraphic.circle(0, 0, data.size);
            } else {
                pbsGraphic.rect(-data.size / 2, -data.size / 2, data.size, data.size);
            }
            pbsGraphic.fill(data.color); // 应用填充色

            // 设置PBS图形在其父容器（厂区）中的相对位置
            pbsGraphic.x = data.x;
            pbsGraphic.y = data.y;
            
            // 将PBS图形添加到数组和厂区容器中
            this.pbsGraphics.push(pbsGraphic);
            this.factory.addChild(pbsGraphic);
        });

        console.log(`创建了 ${this.pbsGraphics.length} 个PBS单元`);
    }

    /**
     * 将图形缩放到容器宽高的0.9倍并居中
     * @param {PIXI.Graphics} graphic - 要调整的图形对象
     */
    scaleAndCenterGraphic(graphic) {
        if (!graphic || !this.app) return;

        // 获取容器尺寸
        const containerWidth = this.app.screen.width;
        const containerHeight = this.app.screen.height;
        
        // 获取图形的边界框
        const bounds = graphic.getBounds();
        const graphicWidth = bounds.width;
        const graphicHeight = bounds.height;
        
        // 计算缩放比例，使图形适应容器的90%大小
        const targetWidth = containerWidth * 0.9;
        const targetHeight = containerHeight * 0.9;
        
        const scaleX = targetWidth / graphicWidth;
        const scaleY = targetHeight / graphicHeight;
        
        // 使用较小的缩放比例，保持图形比例
        const scale = Math.min(scaleX, scaleY);
        
        // 应用缩放
        graphic.scale.set(scale);
        
        // 将图形中心移动到容器中心
        graphic.x = containerWidth / 2;
        graphic.y = containerHeight / 2;
        
        console.log(`图形缩放和居中完成: 缩放比例=${scale.toFixed(3)}, 位置=(${graphic.x}, ${graphic.y})`);
    }

    /**
     * 显示多边形的中心点
     * 在多边形的几何中心添加一个白色小圆
     */
    showCenter() {
        // 如果已经存在中心点，先移除它
        if (this.centerDot) {
            this.app.stage.removeChild(this.centerDot);
            this.centerDot = null;
        }

        // 优先显示厂区中心，如果没有厂区则显示原始多边形中心
        const targetGraphic = this.factory || this.bunny;
        const targetPoints = this.factoryPoints || this.polygonPoints;

        if (!targetGraphic || !targetPoints) return;

        // 计算多边形在世界坐标系中的中心点
        const center = calculatePolygonCenter(targetPoints);
        
        // 创建白色小圆
        const graphics = new PIXI.Graphics();
        graphics.circle(0, 0, 8); // 稍大一点的圆，便于在厂区中观察
        graphics.fill(0xffffff); // 白色填充
        graphics.stroke({ width: 2, color: 0x000000 }); // 黑色边框
        
        const dotTexture = this.app.renderer.generateTexture(graphics);
        this.centerDot = new PIXI.Sprite(dotTexture);
        
        // 设置中心点的位置（相对于图形精灵的位置）
        this.centerDot.anchor.set(0.5);
        this.centerDot.x = targetGraphic.x;
        this.centerDot.y = targetGraphic.y;
        
        // 添加到舞台，确保在图形之上
        this.app.stage.addChild(this.centerDot);
        
        const graphicType = this.factory ? '厂区' : '多边形';
        console.log(`${graphicType}中心点位置: (${center.x.toFixed(2)}, ${center.y.toFixed(2)})`);
    }

    /**
     * 显示厂区的几何中心点
     * 专门用于厂区，使用简单的几何中心计算（顶点坐标平均值）
     */
    showFactoryGeometricCenter() {
        // 如果不是厂区模式，不执行
        if (!this.factory || !this.factoryPoints) {
            console.log('当前不是厂区模式，无法显示厂区几何中心');
            return;
        }

        // 如果已经存在几何中心点，先移除它
        if (this.geometricCenterDot) {
            this.app.stage.removeChild(this.geometricCenterDot);
            this.geometricCenterDot = null;
        }

        // 计算厂区的几何中心（顶点坐标平均值）
        const geometricCenter = calculateGeometricCenter(this.factoryPoints);
        
        // 创建红色正方形标记（区分于质心的白色圆形）
        const graphics = new PIXI.Graphics();
        graphics.rect(-6, -6, 12, 12); // 12x12的正方形
        graphics.fill(0xff4444); // 红色填充
        graphics.stroke({ width: 2, color: 0x000000 }); // 黑色边框
        
        const dotTexture = this.app.renderer.generateTexture(graphics);
        this.geometricCenterDot = new PIXI.Sprite(dotTexture);
        
        // 设置几何中心点的位置
        this.geometricCenterDot.anchor.set(0.5);
        this.geometricCenterDot.x = this.factory.x;
        this.geometricCenterDot.y = this.factory.y;
        
        // 添加到舞台，确保在厂区之上
        this.app.stage.addChild(this.geometricCenterDot);
        
        console.log(`厂区几何中心位置: (${geometricCenter.x.toFixed(2)}, ${geometricCenter.y.toFixed(2)})`);
        console.log(`质心和几何中心的区别: 几何中心是所有顶点坐标的算术平均值`);
    }

    /**
     * 隐藏几何中心点
     */
    hideFactoryGeometricCenter() {
        if (this.geometricCenterDot) {
            this.app.stage.removeChild(this.geometricCenterDot);
            this.geometricCenterDot = null;
        }
    }

    /**
     * 切换厂区中心类型和显示方式
     * 循环切换：无显示 -> 质心pivot+质心标记 -> 几何中心pivot+几何中心标记 -> 同时显示两种中心标记
     */
    toggleFactoryCenterType() {
        if (!this.factory) {
            console.log('当前不是厂区模式');
            return;
        }

        // 简化为仅切换几何中心的显示
        if (this.geometricCenterDot) {
            this.hideFactoryGeometricCenter();
            console.log('隐藏厂区几何中心标记');
        } else {
            this.showFactoryGeometricCenter();
            console.log('显示厂区几何中心标记');
        }
    }

    /**
     * 重新创建厂区，使用指定的中心类型
     * @param {boolean} useGeometricCenter - 是否使用几何中心作为旋转点
     */
    recreateFactory() {
        if (!this.factory) return;

        // 保存当前状态
        const currentRotation = this.factory.rotation;
        const currentX = this.factory.x;
        const currentY = this.factory.y;
        const currentScale = this.factory.scale.x;

        // 移除旧的厂区
        this.app.stage.removeChild(this.factory);
        this.pbsGraphics = []; // 清理PBS数组

        // 创建新的厂区 (总是使用几何中心)
        this.createFactory();

        // 恢复状态
        this.factory.rotation = currentRotation;
        this.factory.x = currentX;
        this.factory.y = currentY;
        this.factory.scale.set(currentScale);
    }

    /**
     * 隐藏中心点
     */
    hideCenter() {
        if (this.centerDot) {
            this.app.stage.removeChild(this.centerDot);
            this.centerDot = null;
        }
    }

    setupAnimationLoop() {
        // 使用 PixiJS 的 ticker 来创建动画循环
        this.app.ticker.add(() => {
            this.animate();
        });
    }

    animate() {
        // 如果正在旋转，更新旋转角度
        const targetGraphic = this.factory || this.bunny;
        if (this.isRotating && targetGraphic) {
            targetGraphic.rotation += 0.05;
            
            // 如果显示了中心点，让它跟随图形旋转
            if (this.centerDot) {
                this.centerDot.rotation = targetGraphic.rotation;
            }
            
            // 如果显示了几何中心点，让它跟随图形旋转
            if (this.geometricCenterDot) {
                this.geometricCenterDot.rotation = targetGraphic.rotation;
            }
        }
    }



    toggleRotation() {
        this.isRotating = !this.isRotating;
        const btn = document.getElementById('rotate-btn');
        btn.textContent = this.isRotating ? '停止旋转' : '旋转精灵';
    }

    /**
     * 切换厂区和原多边形显示
     */
    toggleFactory() {
        const btn = document.getElementById('create-factory-btn');
        
        if (this.factory) {
            // 如果厂区存在，移除厂区，显示原多边形
            this.app.stage.removeChild(this.factory);
            this.factory = null;
            this.pbsGraphics = []; // 清理PBS数组
            
            // 如果原多边形不存在，则创建它
            if (!this.bunny) {
                this.createSprite();
            } else {
                // 如果存在但不在舞台上，添加到舞台
                if (!this.app.stage.children.includes(this.bunny)) {
                    this.app.stage.addChild(this.bunny);
                }
            }
            
            btn.textContent = '创建厂区';
            // 切换按钮可见性
            document.getElementById('center-btn').style.display = 'inline-block';
            document.getElementById('factory-center-btn').style.display = 'none';
            document.getElementById('color-btn').style.display = 'inline-block';
            console.log('已切换到原多边形');
        } else {
            // 如果厂区不存在，创建厂区，隐藏原多边形
            if (this.bunny && this.app.stage.children.includes(this.bunny)) {
                this.app.stage.removeChild(this.bunny);
            }
            
            this.createFactory();
            btn.textContent = '显示多边形';
            // 切换按钮可见性
            document.getElementById('center-btn').style.display = 'none';
            document.getElementById('factory-center-btn').style.display = 'inline-block';
            document.getElementById('color-btn').style.display = 'none';
            console.log('已创建厂区');
        }
        
        // 切换模式后，执行重置
        this.reset(false);
    }

    changeColor(reset = false) {
        if (!this.bunny) return;

        if (reset) {
            this.colorIndex = 0;
        } else {
            this.colorIndex = (this.colorIndex + 1) % this.colors.length;
        }
        const newColor = this.colors[this.colorIndex];
        
        // 清除旧图形并用新颜色重绘
        this.bunny.clear();
        this.bunny.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
        for (let i = 1; i < this.polygonPoints.length; i++) {
            this.bunny.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
        }
        this.bunny.closePath();
        this.bunny.fill(newColor);
        
        // 添加边框
        this.bunny.stroke({ width: 2, color: 0x000000 });
    }

    reset(recreate = true) {
        const targetGraphic = this.factory || this.bunny;
        if (!targetGraphic) return;
        
        // 隐藏中心点
        this.hideCenter();
        this.hideFactoryGeometricCenter();
        
        // 重置所有属性
        targetGraphic.rotation = 0;
        this.isRotating = false;
        
        // 如果是厂区，重新创建并缩放居中
        if (this.factory) {
            if (recreate) {
                // 移除旧的厂区
                this.app.stage.removeChild(this.factory);
                this.pbsGraphics = []; // 清理PBS数组
                
                // 重新创建厂区
                this.createFactory();
            }
        } else if (this.bunny) {
            // 重置原多边形
            targetGraphic.x = this.app.screen.width / 2;
            targetGraphic.y = this.app.screen.height / 2;
            targetGraphic.scale.set(1.5);
            
            // 重置颜色为红色多边形
            this.changeColor(true);
        }
        
        // 重置按钮文本
        document.getElementById('rotate-btn').textContent = '旋转精灵';
        
        // 重置视窗
        this.resetViewport();
    }

    /**
     * 设置视窗变换
     */
    updateViewport() {
        if (!this.app || !this.app.stage) return;
        

        this.app.stage.position.set(this.viewport.x, this.viewport.y);
        this.app.stage.scale.set(this.viewport.scale);
    }

    /**
     * 处理鼠标滚轮缩放
     * @param {WheelEvent} event - 滚轮事件
     */
    handleWheel(event) {
        event.preventDefault();

        
        // 获取鼠标在canvas中的位置，考虑缩放比例
        const rect = this.app.canvas.getBoundingClientRect();
        const scaleX = this.app.canvas.width / rect.width;
        const scaleY = this.app.canvas.height / rect.height;
        
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
        
        // 计算缩放因子
        const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(
            this.viewport.minScale,
            Math.min(this.viewport.maxScale, this.viewport.scale * scaleFactor)
        );
        
        // 如果缩放值没有变化，直接返回
        if (newScale === this.viewport.scale) return;
        
        // 计算鼠标在世界坐标系中的位置
        const worldX = (mouseX - this.viewport.x) / this.viewport.scale;
        const worldY = (mouseY - this.viewport.y) / this.viewport.scale;
        
        // 更新缩放
        this.viewport.scale = newScale;
        
        // 调整视窗位置，使缩放以鼠标位置为中心
        this.viewport.x = mouseX - worldX * this.viewport.scale;
        this.viewport.y = mouseY - worldY * this.viewport.scale;
        
        this.updateViewport();
    }

    /**
     * 处理鼠标按下事件
     * @param {PointerEvent} event - 指针事件
     */
    handlePointerDown(event) {

        // 只处理在canvas上的点击
        const rect = this.app.canvas.getBoundingClientRect();
        const isOnCanvas = event.clientX >= rect.left && event.clientX <= rect.right &&
                          event.clientY >= rect.top && event.clientY <= rect.bottom;
        
        if (!isOnCanvas) return;
        
        this.isDragging = true;
        this.lastPointerPosition.x = event.clientX;
        this.lastPointerPosition.y = event.clientY;
        
        // 改变鼠标样式
        this.app.canvas.style.cursor = 'grabbing';
        
        // 阻止默认行为
        event.preventDefault();
    }

    /**
     * 处理鼠标移动事件
     * @param {PointerEvent} event - 指针事件
     */
    handlePointerMove(event) {
        if (!this.isDragging) return;
        

        // 计算移动距离
        const deltaX = event.clientX - this.lastPointerPosition.x;
        const deltaY = event.clientY - this.lastPointerPosition.y;
        
        // 更新视窗位置
        this.viewport.x += deltaX;
        this.viewport.y += deltaY;
        
        // 更新最后的鼠标位置
        this.lastPointerPosition.x = event.clientX;
        this.lastPointerPosition.y = event.clientY;
        
        this.updateViewport();
    }

    /**
     * 处理鼠标抬起事件
     * @param {PointerEvent} event - 指针事件
     */
    handlePointerUp(event) {

        this.isDragging = false;
        
        // 恢复鼠标样式
        this.app.canvas.style.cursor = 'grab';
    }

    /**
     * 重置视窗到初始状态
     */
    resetViewport() {
        this.viewport.x = 0;
        this.viewport.y = 0;
        this.viewport.scale = 1;
        this.updateViewport();
        console.log('视窗已重置');
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} event - 键盘事件
     */
    handleKeyDown(event) {
        // 检查是否有输入框获得焦点，如果有则不处理快捷键
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (event.key.toLowerCase()) {
            case 'r':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.resetViewport();
                }
                break;
            case '0':
                event.preventDefault();
                this.resetViewport();
                break;
            case '=':
            case '+':
                event.preventDefault();
                this.zoomIn();
                break;
            case '-':
                event.preventDefault();
                this.zoomOut();
                break;
        }
    }

    /**
     * 放大视窗
     */
    zoomIn() {
        const centerX = this.app.canvas.width / 2;
        const centerY = this.app.canvas.height / 2;
        
        const scaleFactor = 1.2;
        const newScale = Math.min(this.viewport.maxScale, this.viewport.scale * scaleFactor);
        
        if (newScale === this.viewport.scale) return;
        
        const worldX = (centerX - this.viewport.x) / this.viewport.scale;
        const worldY = (centerY - this.viewport.y) / this.viewport.scale;
        
        this.viewport.scale = newScale;
        this.viewport.x = centerX - worldX * this.viewport.scale;
        this.viewport.y = centerY - worldY * this.viewport.scale;
        
        this.updateViewport();
    }

    /**
     * 缩小视窗
     */
    zoomOut() {
        const centerX = this.app.canvas.width / 2;
        const centerY = this.app.canvas.height / 2;
        
        const scaleFactor = 0.8;
        const newScale = Math.max(this.viewport.minScale, this.viewport.scale * scaleFactor);
        
        if (newScale === this.viewport.scale) return;
        
        const worldX = (centerX - this.viewport.x) / this.viewport.scale;
        const worldY = (centerY - this.viewport.y) / this.viewport.scale;
        
        this.viewport.scale = newScale;
        this.viewport.x = centerX - worldX * this.viewport.scale;
        this.viewport.y = centerY - worldY * this.viewport.scale;
        
        this.updateViewport();
    }

    setupEventListeners() {
        // 创建厂区按钮
        document.getElementById('create-factory-btn').addEventListener('click', () => {
            this.toggleFactory();
        });

        // 旋转按钮
        document.getElementById('rotate-btn').addEventListener('click', () => {
            this.toggleRotation();
        });

        // 改变颜色按钮
        document.getElementById('color-btn').addEventListener('click', () => {
            this.changeColor();
        });

        // 确认中心按钮
        document.getElementById('center-btn').addEventListener('click', () => {
            if (this.centerDot) {
                this.hideCenter();
            } else {
                this.showCenter();
            }
        });

        // 厂区几何中心按钮
        document.getElementById('factory-center-btn').addEventListener('click', () => {
            this.toggleFactoryCenterType();
        });

        // 放大按钮
        document.getElementById('zoom-in-btn').addEventListener('click', () => {
            this.zoomIn();
        });

        // 缩小按钮
        document.getElementById('zoom-out-btn').addEventListener('click', () => {
            this.zoomOut();
        });

        // 重置视窗按钮
        document.getElementById('viewport-reset-btn').addEventListener('click', () => {
            this.resetViewport();
        });

        // 重置按钮
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.reset();
        });

        // 窗口大小调整
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * 设置视窗控制相关的事件监听器
     */
    setupViewportControls() {
        if (!this.app || !this.app.canvas) {
            console.error('Canvas未准备好，无法设置视窗控制');
            return;
        }

        const canvas = this.app.canvas;

        
        // 设置初始鼠标样式
        canvas.style.cursor = 'grab';
        
        // 添加滚轮事件监听器
        canvas.addEventListener('wheel', (event) => {
            this.handleWheel(event);
        }, { passive: false });
        
        // 添加鼠标/触摸事件监听器
        canvas.addEventListener('pointerdown', (event) => {
            this.handlePointerDown(event);
        });
        
        // 在全局监听移动和抬起事件，确保拖拽不会中断
        window.addEventListener('pointermove', (event) => {
            this.handlePointerMove(event);
        });
        
        window.addEventListener('pointerup', (event) => {
            this.handlePointerUp(event);
        });
        
        // 也添加鼠标事件作为备用
        canvas.addEventListener('mousedown', (event) => {
            this.handlePointerDown(event);
        });
        
        window.addEventListener('mousemove', (event) => {
            this.handlePointerMove(event);
        });
        
        window.addEventListener('mouseup', (event) => {
            this.handlePointerUp(event);
        });
        
        // 防止右键菜单影响拖拽
        canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        // 添加键盘快捷键
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
    }

    handleResize() {
        if (!this.app) return;
        
        const container = document.getElementById('pixi-container');
        if (!container) return;

        // 获取容器的新尺寸
        const containerRect = container.getBoundingClientRect();
        const newWidth = containerRect.width || container.clientWidth;
        const newHeight = containerRect.height || container.clientHeight;

        // 避免无效尺寸
        if (newWidth <= 0 || newHeight <= 0) return;

        console.log(`调整尺寸为: ${newWidth} x ${newHeight}`);
        
        // 调整PixiJS渲染器尺寸
        this.app.renderer.resize(newWidth, newHeight);
        
        // 重新调整图形位置和大小
        const targetGraphic = this.factory || this.bunny;
        if (targetGraphic) {
            if (this.factory) {
                // 对于厂区，重新应用缩放和居中
                this.scaleAndCenterGraphic(this.factory);
            } else if (this.bunny) {
                // 对于原多边形，简单居中
                this.bunny.x = newWidth / 2;
                this.bunny.y = newHeight / 2;
            }
            
            // 如果显示了中心点，也要更新其位置
            if (this.centerDot) {
                this.centerDot.x = targetGraphic.x;
                this.centerDot.y = targetGraphic.y;
            }
            
            // 如果显示了几何中心点，也要更新其位置
            if (this.geometricCenterDot) {
                this.geometricCenterDot.x = targetGraphic.x;
                this.geometricCenterDot.y = targetGraphic.y;
            }
        }
    }
}

// 当页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 检查 PixiJS 是否已加载
    if (typeof PIXI !== 'undefined') {
        console.log('PixiJS v8 已成功加载！');
        new PixiApp();
    } else {
        console.error('PixiJS 加载失败！');
        alert('PixiJS 加载失败，请检查网络连接！');
    }
}); 