# 项目启动说明

## 问题说明
直接双击打开 `index.html` 会遇到 CORS 错误,因为浏览器不允许 `file://` 协议加载 ES6 模块。

## 解决方案 - 使用本地服务器

### 方法 1: 使用 npm serve (推荐)
```bash
# 启动开发服务器(端口 8000)
npm run dev

# 或者直接运行
npm start
```

然后在浏览器中访问: `http://localhost:8000`

### 方法 2: 使用 Python (如果已安装 Python)
```bash
# Python 3.x
python -m http.server 8000

# Python 2.x
python -m SimpleHTTPServer 8000
```

然后在浏览器中访问: `http://localhost:8000`

### 方法 3: 使用 VS Code Live Server 扩展
1. 安装 VS Code 的 "Live Server" 扩展
2. 右键点击 `index.html`
3. 选择 "Open with Live Server"

### 方法 4: 使用 Node.js http-server
```bash
# 全局安装
npm install -g http-server

# 运行
http-server -p 8000
```

## 快速启动
推荐使用方法 1,只需在项目根目录执行:
```bash
npm run dev
```

服务器启动后,浏览器访问 `http://localhost:8000` 即可正常运行项目。
