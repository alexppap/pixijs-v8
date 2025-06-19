// PixiJS v8 基本示例
class PixiApp {
    constructor() {
        this.app = null;
        this.bunny = null;
        this.centerDot = null;
        this.isRotating = false;
        this.colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        this.colorIndex = 0;
        
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
        // 创建 PixiJS 应用实例
        this.app = new PIXI.Application();
        
        // 初始化应用
        await this.app.init({
            width: 800,
            height: 600,
            backgroundColor: 0x1099bb,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // 将 canvas 添加到 DOM
        const container = document.getElementById('pixi-container');
        container.appendChild(this.app.canvas);

        // 调整容器大小以适应 canvas
        this.app.canvas.style.width = '100%';
        this.app.canvas.style.height = 'auto';
        this.app.canvas.style.maxWidth = '800px';
        
        // 设置触摸行为
        this.app.canvas.style.touchAction = 'none';

        // 创建精灵
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
        const center = this.calculatePolygonCenter(this.polygonPoints);
        
        // 创建不规则多边形纹理
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
        
        const texture = this.app.renderer.generateTexture(graphics);
        
        // 创建精灵
        this.bunny = new PIXI.Sprite(texture);
        
        // 设置精灵锚点为计算出的中心点（相对于纹理的坐标）
        this.bunny.anchor.set(center.x / 100, center.y / 100); // 假设纹理大小为100x100
        this.bunny.x = this.app.screen.width / 2;
        this.bunny.y = this.app.screen.height / 2;
        this.bunny.scale.set(1.5);
        
        // 使精灵可交互
        this.bunny.eventMode = 'static';
        this.bunny.cursor = 'pointer';

        // 添加到舞台
        this.app.stage.addChild(this.bunny);
    }

    /**
     * 计算不规则多边形的中心点（质心）
     * 使用面积加权的方法计算几何中心
     * @param {Array} points - 多边形顶点数组，格式: [{x, y}, ...]
     * @returns {Object} 中心点坐标 {x, y}
     */
    calculatePolygonCenter(points) {
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
     * 显示多边形的中心点
     * 在多边形的几何中心添加一个白色小圆
     */
    showCenter() {
        // 如果已经存在中心点，先移除它
        if (this.centerDot) {
            this.app.stage.removeChild(this.centerDot);
            this.centerDot = null;
        }

        if (!this.bunny) return;

        // 计算多边形在世界坐标系中的中心点
        const center = this.calculatePolygonCenter(this.polygonPoints);
        
        // 创建白色小圆
        const graphics = new PIXI.Graphics();
        graphics.circle(0, 0, 5); // 半径为5的圆
        graphics.fill(0xffffff); // 白色填充
        graphics.stroke({ width: 1, color: 0x000000 }); // 黑色边框
        
        const dotTexture = this.app.renderer.generateTexture(graphics);
        this.centerDot = new PIXI.Sprite(dotTexture);
        
        // 设置中心点的位置（相对于多边形精灵的位置）
        this.centerDot.anchor.set(0.5);
        this.centerDot.x = this.bunny.x;
        this.centerDot.y = this.bunny.y;
        
        // 添加到舞台，确保在多边形之上
        this.app.stage.addChild(this.centerDot);
        
        console.log(`多边形中心点位置: (${center.x.toFixed(2)}, ${center.y.toFixed(2)})`);
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
        if (this.isRotating && this.bunny) {
            this.bunny.rotation += 0.05;
            
            // 如果显示了中心点，让它跟随多边形旋转
            if (this.centerDot) {
                this.centerDot.rotation = this.bunny.rotation;
            }
        }
    }



    toggleRotation() {
        this.isRotating = !this.isRotating;
        const btn = document.getElementById('rotate-btn');
        btn.textContent = this.isRotating ? '停止旋转' : '旋转精灵';
    }

    changeColor() {
        if (!this.bunny) return;
        
        this.colorIndex = (this.colorIndex + 1) % this.colors.length;
        const newColor = this.colors[this.colorIndex];
        
        // 创建新的彩色多边形纹理
        const graphics = new PIXI.Graphics();
        
        // 绘制多边形
        graphics.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
        for (let i = 1; i < this.polygonPoints.length; i++) {
            graphics.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
        }
        graphics.closePath();
        graphics.fill(newColor);
        
        // 添加边框
        graphics.stroke({ width: 2, color: 0x000000 });
        
        const newTexture = this.app.renderer.generateTexture(graphics);
        this.bunny.texture = newTexture;
    }

    reset() {
        if (!this.bunny) return;
        
        // 隐藏中心点
        this.hideCenter();
        
        // 重置所有属性
        this.bunny.rotation = 0;
        this.bunny.x = this.app.screen.width / 2;
        this.bunny.y = this.app.screen.height / 2;
        this.bunny.scale.set(1.5);
        this.isRotating = false;
        this.colorIndex = 0;
        
        // 重置颜色为红色多边形
        const graphics = new PIXI.Graphics();
        
        // 绘制多边形
        graphics.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
        for (let i = 1; i < this.polygonPoints.length; i++) {
            graphics.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
        }
        graphics.closePath();
        graphics.fill(0xff0000);
        
        // 添加边框
        graphics.stroke({ width: 2, color: 0x000000 });
        
        const texture = this.app.renderer.generateTexture(graphics);
        this.bunny.texture = texture;
        
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
        const containerWidth = container.clientWidth;
        const aspectRatio = 800 / 600;
        
        let newWidth = Math.min(containerWidth, 800);
        let newHeight = newWidth / aspectRatio;
        
        this.app.renderer.resize(newWidth, newHeight);
        
        // 重新定位精灵到中心
        if (this.bunny) {
            this.bunny.x = newWidth / 2;
            this.bunny.y = newHeight / 2;
            
            // 如果显示了中心点，也要更新其位置
            if (this.centerDot) {
                this.centerDot.x = this.bunny.x;
                this.centerDot.y = this.bunny.y;
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