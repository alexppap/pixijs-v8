/**
 * 键盘事件处理器
 * 负责处理键盘快捷键和按键事件
 */

export class KeyboardHandler {
  constructor() {
    this.eventListeners = [];
  }

  /**
   * 设置键盘事件监听
   * @param {Object} controllers - 控制器对象集合
   */
  setup(controllers) {
    this.controllers = controllers;
    
    // 添加键盘事件监听器
    const keydownHandler = (event) => this.handleKeyDown(event);
    document.addEventListener('keydown', keydownHandler);
    
    // 保存事件监听器引用以便清理
    this.eventListeners.push({
      element: document,
      event: 'keydown',
      handler: keydownHandler
    });
  }

  /**
   * 处理键盘按键事件
   * @param {KeyboardEvent} event - 键盘事件
   */
  handleKeyDown(event) {
    // 检查是否有输入框获得焦点，如果有则不处理快捷键
    if (this.isInputFocused()) {
      return;
    }
    
    const key = event.key.toLowerCase();
    const { ctrlKey, metaKey, shiftKey, altKey } = event;
    
    // 处理不同的按键组合
    switch (key) {
      case 'r':
        if (ctrlKey || metaKey) {
          event.preventDefault();
          this.handleResetViewport();
        }
        break;
        
      case '0':
        event.preventDefault();
        this.handleResetViewport();
        break;
        
      case '=':
      case '+':
        event.preventDefault();
        this.handleZoomIn();
        break;
        
      case '-':
        event.preventDefault();
        this.handleZoomOut();
        break;
        
      case ' ':
        event.preventDefault();
        this.handleToggleRotation();
        break;
        
      case 'c':
        if (!ctrlKey && !metaKey) {
          event.preventDefault();
          this.handleToggleCenter();
        }
        break;
        
      case 'f':
        if (!ctrlKey && !metaKey) {
          event.preventDefault();
          this.handleToggleFactory();
        }
        break;
        
      case 'escape':
        event.preventDefault();
        this.handleReset();
        break;
        
      case 'arrowup':
        event.preventDefault();
        this.handlePan(0, shiftKey ? -50 : -10);
        break;
        
      case 'arrowdown':
        event.preventDefault();
        this.handlePan(0, shiftKey ? 50 : 10);
        break;
        
      case 'arrowleft':
        event.preventDefault();
        this.handlePan(shiftKey ? -50 : -10, 0);
        break;
        
      case 'arrowright':
        event.preventDefault();
        this.handlePan(shiftKey ? 50 : 10, 0);
        break;
    }
  }

  /**
   * 检查是否有输入框获得焦点
   * @returns {boolean} 是否有输入框焦点
   */
  isInputFocused() {
    const activeElement = document.activeElement;
    const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
    const isContentEditable = activeElement.contentEditable === 'true';
    
    return inputTags.includes(activeElement.tagName) || isContentEditable;
  }

  /**
   * 处理重置视窗快捷键
   */
  handleResetViewport() {
    if (this.controllers.viewport) {
      this.controllers.viewport.reset();
    }
  }

  /**
   * 处理放大快捷键
   */
  handleZoomIn() {
    if (this.controllers.viewport) {
      this.controllers.viewport.zoomIn();
    }
  }

  /**
   * 处理缩小快捷键
   */
  handleZoomOut() {
    if (this.controllers.viewport) {
      this.controllers.viewport.zoomOut();
    }
  }

  /**
   * 处理切换旋转快捷键
   */
  handleToggleRotation() {
    if (this.controllers.animation) {
      this.controllers.animation.toggleRotation();
    }
  }

  /**
   * 处理切换中心点显示快捷键
   */
  handleToggleCenter() {
    if (this.controllers.ui) {
      this.controllers.ui.toggleCenter();
    }
  }

  /**
   * 处理切换厂区显示快捷键
   */
  handleToggleFactory() {
    if (this.controllers.ui) {
      this.controllers.ui.toggleFactory();
    }
  }

  /**
   * 处理重置快捷键
   */
  handleReset() {
    if (this.controllers.ui) {
      this.controllers.ui.reset();
    }
  }

  /**
   * 处理平移快捷键
   * @param {number} deltaX - X轴移动距离
   * @param {number} deltaY - Y轴移动距离
   */
  handlePan(deltaX, deltaY) {
    if (this.controllers.viewport) {
      this.controllers.viewport.pan(deltaX, deltaY);
    }
  }

  /**
   * 添加自定义快捷键
   * @param {string} key - 按键
   * @param {Function} handler - 处理函数
   * @param {Object} modifiers - 修饰键 {ctrl, shift, alt}
   */
  addShortcut(key, handler, modifiers = {}) {
    const originalHandler = this.handleKeyDown.bind(this);
    
    const customHandler = (event) => {
      if (this.isInputFocused()) return;
      
      const eventKey = event.key.toLowerCase();
      const { ctrlKey, shiftKey, altKey } = event;
      
      if (eventKey === key.toLowerCase()) {
        const ctrlMatch = modifiers.ctrl ? ctrlKey : !ctrlKey;
        const shiftMatch = modifiers.shift ? shiftKey : !shiftKey;
        const altMatch = modifiers.alt ? altKey : !altKey;
        
        if (ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          handler(event);
          return;
        }
      }
      
      // 如果不匹配，继续执行原始处理器
      originalHandler(event);
    };
    
    // 替换当前的事件监听器
    this.removeEventListeners();
    document.addEventListener('keydown', customHandler);
    
    this.eventListeners.push({
      element: document,
      event: 'keydown',
      handler: customHandler
    });
  }

  /**
   * 移除所有事件监听器
   */
  removeEventListeners() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }

  /**
   * 销毁键盘处理器
   */
  destroy() {
    this.removeEventListeners();
    this.controllers = null;
  }

  /**
   * 获取快捷键帮助信息
   * @returns {Array} 快捷键列表
   */
  getShortcutHelp() {
    return [
      { key: 'Space', description: '切换旋转动画' },
      { key: '0', description: '重置视窗' },
      { key: 'Ctrl+R', description: '重置视窗' },
      { key: '+/=', description: '放大视窗' },
      { key: '-', description: '缩小视窗' },
      { key: 'C', description: '切换中心点显示' },
      { key: 'F', description: '切换厂区显示' },
      { key: 'Esc', description: '重置所有' },
      { key: '方向键', description: '平移视窗' },
      { key: 'Shift+方向键', description: '快速平移视窗' }
    ];
  }
} 