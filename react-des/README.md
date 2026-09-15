# DES 数字员工系统 - React Version

这是将原 HTML 版本转换为 React + Tailwind CSS 的项目。

## 📦 安装依赖

```bash
cd react-des
npm install
```

## 🚀 运行项目

```bash
npm run dev
```

项目将在 `http://localhost:5173` 启动

## 🏗️ 项目结构

```
react-des/
├── public/
│   └── Pic/                     # 头像图片资源
├── src/
│   ├── components/
│   │   └── Sidebar.jsx          # 左侧边栏组件
│   ├── pages/
│   │   ├── Home.jsx             # 主页面组件（包含所有模态框）
│   │   └── AddEmployee.jsx      # 新增员工页面
│   ├── App.jsx                  # 根组件（路由配置）
│   ├── main.jsx                 # 入口文件
│   └── index.css                # Tailwind CSS 配置
├── index.html                   # HTML 入口
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## ✨ 功能说明

### 已实现功能

- ✅ 完整的侧边栏导航（Sidebar 组件）
- ✅ 数字员工列表展示
- ✅ 任务进度、能力优化、资源中心、基础设置菜单
- ✅ 聊天界面与输入框
- ✅ 自动调整输入框高度
- ✅ **新增 AI 员工页面（完整独立页面）**
  - 人设与回复逻辑配置
  - 头像选择器（预设+上传）
  - 资源管理（知识库、数据库、工具库、工作流库）
  - 行动指南（工作流程步骤）
  - 任务模拟功能
  - 三栏布局（人设、资源、模拟）
- ✅ 页面路由（React Router）
- ✅ LocalStorage 数据持久化
- ✅ 所有原 HTML 的交互功能

### 样式还原

- ✅ 100% 还原原 HTML 的视觉效果
- ✅ 所有 CSS 已转换为 Tailwind 类名
- ✅ 保持原有的渐变、阴影、圆角等细节
- ✅ 响应式布局保持一致
- ✅ 动画效果完整保留

## 🎨 技术栈

- **React 18** - UI 框架
- **React Router v6** - 路由管理
- **Vite** - 构建工具
- **Tailwind CSS 3** - 样式框架
- **LocalStorage** - 数据持久化

## 📝 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | Home.jsx | 主页面（聊天界面） |
| `/add-employee` | AddEmployee.jsx | 新增 AI 员工页面 |

## 🔧 主要改动

1. **DOM 操作 → React 状态管理**
   - `document.querySelector` → `useState`
   - `classList.add/remove` → 条件渲染
   - `innerHTML` → JSX

2. **事件处理**
   - `onclick="func()"` → `onClick={func}`
   - 所有事件处理器改为 React 写法

3. **样式处理**
   - `class` → `className`
   - 内联样式 → Tailwind 类名
   - CSS 变量 → Tailwind 配置

4. **页面导航**
   - `window.location.href` → `useNavigate()` (React Router)
   - 侧边栏加号按钮 → 跳转到 `/add-employee`

## 🎯 使用说明

1. 点击左侧 Aria 卡片右侧的 **"+"** 按钮，跳转到新增员工页面
2. 在新增员工页面配置：
   - **左栏**：填写员工姓名、职责、选择头像、配置人设 Prompt
   - **中栏**：添加知识库、数据库、工具库、工作流库资源，配置工作流程
   - **右栏**：输入任务进行模拟，查看执行步骤
3. 点击"开始模拟"验证工作流程
4. 点击"创建员工"保存到本地存储
5. 自动返回主页面，新员工会出现在侧边栏

## 📄 许可

MIT
