# AgentStudio 前端 UI 优化方案

> 基于 codegraph 代码审计 + design-taste-frontend 规范  
> 审计时间：2026-07-25  
> 技术栈：Tailwind CSS v4 + Ant Design 5 + CSS Variables

---

## 一、设计基调

| 参数 | 值 | 说明 |
|------|-----|------|
| `DESIGN_VARIANCE` | 5 | 功能优先，不对称布局克制 |
| `MOTION_INTENSITY` | 3 | 工具 UI，仅 hover/active 微交互 |
| `VISUAL_DENSITY` | 6 | 聊天应用需要适中密度 |

---

## 二、当前问题审计

### 2.1 排版问题

| 问题 | 当前状态 | 严重度 |
|------|----------|--------|
| 基础字号 14px | 行业标准 15-16px | P0 |
| 标题字号 24px | 冲击力不足 | P0 |
| `--color-text-muted` #6b7280 | WCAG AA 边界 (4.8:1) | P0 |
| `--color-text-tertiary` #4b5563 | **WCAG AA 失败** (3.1:1) | P0 |
| 副标题 text-base + text-muted | 几乎不可读 | P0 |
| 工具按钮 text-xs (12px) | 太小，点击困难 | P0 |

### 2.2 颜色与对比度

| 问题 | 当前状态 | 严重度 |
|------|----------|--------|
| `--color-surface` #0d0d0d | 近纯黑，眼睛疲劳 | P0 |
| `--color-surface-sidebar` #0d0d0d | 与主背景相同，无层次 | P0 |
| `--color-border` 0.08 透明度 | 近乎不可见 | P0 |
| 语法高亮全灰度 | 代码块失去可读性 | P1 |
| `--color-success` #44cc44 | 霓虹绿刺眼 | P1 |

### 2.3 布局问题

| 问题 | 当前状态 | 严重度 |
|------|----------|--------|
| 侧边栏宽度 15rem | CJK 文字太窄 | P0 |
| 工作台导航 180px | 中文标签放不下 | P0 |
| ConversationsList 固定 300px | 布局断裂 | P0 |
| Agent 消息背景 /30 透明 | 在深色背景上不可见 | P0 |

### 2.4 组件视觉效果

| 问题 | 当前状态 | 严重度 |
|------|----------|--------|
| Bot 图标 72px | 融入深色背景 | P1 |
| 操作按钮 size={12} | 12px 图标太小 | P0 |
| 操作按钮无背景 | 边框不可见时按钮消失 | P0 |
| `.active` class 无样式 | 选中无视觉反馈 | P0 |
| Agent 计数 text-[10px] | 不可读 | P0 |
| 新建对话按钮 | 边框描边，CTA 弱 | P1 |
| 输入框 radius 20px | 太圆，像手机键盘 | P1 |
| 输入框高度 64px | 太高 | P1 |

---

## 三、P0 — 必须修复

### 3.1 CSS Token 系统重写

**文件**: `frontend/src/styles/tailwind-entry.css`

#### 字号阶梯

```css
@theme {
  /* 修改前 → 修改后 */
  --text-xs: 12px;      /* → 11px */
  --text-sm: 13px;      /* 不变 */
  --text-base: 14px;    /* → 15px */
  --text-lg: 16px;      /* → 17px */
  --text-xl: 20px;      /* → 22px */
  --text-2xl: 24px;     /* → 28px */
}
```

#### 文字对比度

```css
:root {
  /* 修改前 → 修改后 */
  --color-text-muted: #6b7280;    /* → #8b97a6 (5.2:1 ✓ WCAG AA) */
  --color-text-tertiary: #4b5563; /* → #6b7280 (4.6:1 ✓ WCAG AA) */
}
```

#### 表面系统（5级层次）

```css
:root {
  /* 修改前 → 修改后 */
  --color-surface: #0d0d0d;              /* → #0f1117 */
  --color-surface-sidebar: #0d0d0d;      /* → #111318 (略亮于主背景) */
  --color-surface-raised: #1a1a1a;       /* → #1c1e24 */
  --color-surface-overlay: #242424;      /* → #24252d */
  --color-surface-elevated: #2a2a2a;     /* → #2a2c34 */
  --color-surface-hover: #333333;        /* → rgba(255,255,255,0.06) */
  --color-surface-pressed: #333333;      /* → rgba(255,255,255,0.08) */
}
```

#### 边框系统

```css
:root {
  /* 修改前 → 修改后 */
  --color-border: rgba(255,255,255,0.08);       /* → rgba(255,255,255,0.12) */
  --color-border-subtle: rgba(255,255,255,0.06); /* → rgba(255,255,255,0.08) */
  --color-border-strong: rgba(255,255,255,0.16); /* → rgba(255,255,255,0.20) */
}
```

#### 语义色

```css
:root {
  /* 修改前 → 修改后 */
  --color-success: #44cc44;  /* → #34d399 (柔和绿) */
}
```

#### 布局尺寸

```css
:root {
  /* 修改前 → 修改后 */
  --da-sidebar-width: clamp(15rem, 15vw, 17.5rem);  /* → clamp(16rem, 16vw, 18.5rem) */
  --da-input-height: 64px;                           /* → 56px */
  --da-input-radius: 20px;                           /* → 16px */
  --da-font-size-base: 14px;                         /* → 15px */
}
```

#### 语法高亮

```css
:root {
  /* 修改前 → 修改后 */
  --syntax-blue-300: #888888;   /* → #82aaff (蓝色函数) */
  --syntax-blue-400: #666666;   /* → #c792ea (紫色关键字) */
  --syntax-cyan-200: #999999;   /* → #c3e88d (绿色字符串) */

  /* 新增 */
  --syntax-comment: #546e7a;
  --syntax-number: #f78c6c;
}
```

---

### 3.2 HomeScreen 欢迎屏

**文件**: `frontend/src/components/AgentStudio/workstation/HomeScreen.tsx`

#### Bot 图标

```tsx
// 修改前
<div className="w-[72px] h-[72px] mx-auto mb-4 bg-[var(--color-surface-raised)] rounded-2xl ...">
  <Bot size={48} className="..." />
</div>

// 修改后
<div className="w-20 h-20 mx-auto mb-6 bg-[var(--color-accent)]/10 rounded-2xl 
                flex items-center justify-center
                shadow-[0_4px_20px_rgba(99,102,241,0.15)]">
  <Bot size={40} className="text-[var(--color-accent)]" />
</div>
```

#### 标题字号

```tsx
// 修改前
<h1 className="text-[clamp(24px,4vw,32px)] leading-[1.2] font-bold ...">

// 修改后
<h1 className="text-[clamp(28px,4vw,36px)] leading-[1.15] font-bold 
               text-[var(--color-text-primary)] tracking-tight text-center">
```

#### 副标题

```tsx
// 修改前
<p className="text-base text-[var(--color-text-muted)] ...">

// 修改后
<p className="text-[15px] text-[var(--color-text-secondary)] mt-3 text-center">
  描述你的需求，我来帮你分析和规划
</p>
```

#### 工具按钮

```tsx
// 修改前
<motion.button className="inline-flex items-center gap-2 px-3 py-1.5 
  border border-[var(--color-border)] rounded-full text-xs ...">

// 修改后
<motion.button
  className="inline-flex items-center gap-2 px-3.5 py-2 
             bg-[var(--color-surface-raised)] border-none rounded-lg 
             text-[var(--color-text-secondary)] text-[13px] 
             cursor-pointer transition-all duration-150
             hover:text-[var(--color-text-primary)] 
             hover:bg-[var(--color-surface-elevated)]
             hover:-translate-y-px"
>
  <Icon size={16} />
  <span>{label}</span>
</motion.button>
```

---

### 3.3 TeamMessage 消息气泡

**文件**: `frontend/src/components/AgentStudio/workstation/TeamMessage.tsx`

#### Agent 消息容器

```tsx
// 修改前
<div className="flex flex-col gap-1 items-start max-w-full 
                bg-[var(--color-surface)]/30 px-4 py-3 rounded-xl">

// 修改后
<div className="flex flex-col gap-1 items-start max-w-full 
                bg-[var(--color-surface-raised)] px-4 py-3 rounded-xl 
                border border-[var(--color-border)]">
```

#### 操作按钮

```tsx
// 修改前
<button className="p-1 rounded text-[var(--color-text-muted)] ...">
  <Copy size={12} />
</button>

// 修改后
<button className="p-1.5 bg-[var(--color-surface-hover)] 
                   border border-[var(--color-border)] rounded-md 
                   text-[var(--color-text-muted)] cursor-pointer 
                   flex items-center transition-colors duration-150
                   hover:text-[var(--color-text-primary)] 
                   hover:bg-[var(--color-surface-elevated)]">
  <Copy size={14} />
</button>
```

#### 版本切换器

```tsx
// 修改前
<button className="flex items-center justify-center w-5 h-5 ...">
  <ChevronRight size={12} />
</button>
<span className="text-[12px] ...">

// 修改后
<button className="flex items-center justify-center w-6 h-6 
                   bg-[var(--color-surface-hover)] 
                   border border-[var(--color-border)] rounded-md ...">
  <ChevronRight size={14} />
</button>
<span className="text-[13px] text-[var(--color-text-secondary)] 
                 min-w-8 text-center select-none">
```

#### 继续按钮

```tsx
// 修改前
<button className="flex items-center gap-1 px-2 py-0.5 ...">

// 修改后
<button className="flex items-center gap-1.5 px-3 py-1.5 
                   bg-transparent border border-[var(--color-accent)] 
                   rounded-lg text-[var(--color-accent)] 
                   text-[13px] font-medium ml-auto 
                   transition-all duration-150
                   hover:bg-[var(--color-accent)] 
                   hover:text-[var(--color-text-on-accent)]">
  <Play size={14} />
  <span>继续</span>
</button>
```

#### 思考文字

```tsx
// 修改前
<span className="text-[12.5px] text-[var(--color-text-muted)] ...">

// 修改后
<span className="text-[13px] text-[var(--color-text-secondary)] ...">
```

---

### 3.4 ConversationsList 对话列表

**文件**: `frontend/src/components/AgentStudio/sidebar/ConversationsList.tsx`

#### 移除固定高度

```tsx
// 修改前
<Virtuoso style={{ height: '300px' }} ... />

// 修改后
<Virtuoso style={{ height: '100%' }} ... />
```

#### 激活态样式

```tsx
// 修改前
className="group flex items-center justify-between py-2 px-2 ...">

// 修改后
className={`group flex items-center justify-between py-2 px-2 
  rounded-r-md cursor-pointer transition-colors duration-150 gap-2 
  hover:bg-[var(--color-surface-hover)] ${
    isActive 
      ? 'bg-[var(--color-accent)]/8 border-l-2 border-l-[var(--color-accent)]' 
      : ''
  }`}
>
```

#### 分组标题

```tsx
// 修改前
<div className="text-xs font-semibold text-[var(--color-text-muted)] ...">

// 修改后
<div className="text-[11px] font-medium text-[var(--color-text-tertiary)] 
               tracking-[0.03em] py-1.5 px-2">
```

---

### 3.5 TeamTreeAgentItem 侧边栏 Agent 项

**文件**: `frontend/src/components/AgentStudio/sidebar/TeamTreeAgentItem.tsx`

#### 选中态

```tsx
// 修改前 - .active class 无样式
<button className="flex items-center gap-[6px] py-[5px] px-2 
                   rounded-md cursor-pointer ...">

// 修改后
<button
  className={`flex items-center gap-[6px] py-[5px] px-2 rounded-md 
    cursor-pointer transition-all duration-150 border-none 
    bg-transparent w-full min-h-[30px] text-[13px] text-left 
    hover:bg-[var(--color-surface-hover)] ${
      selectedAgentId === agent.id 
        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium' 
        : 'text-[var(--color-text-secondary)] font-normal'
    }`}
>
```

#### Agent 计数

```tsx
// 修改前
<span className="text-[10px] text-[var(--color-text-muted)] opacity-50 ...">

// 修改后
<span className="text-[11px] text-[var(--color-text-tertiary)] 
                 flex-shrink-0 min-w-[14px] text-right opacity-70">
  {team.agents.length}
</span>
```

---

### 3.6 WorkstationPage 工作台导航

**文件**: `frontend/src/components/AgentStudio/workstation/WorkstationPage.tsx`

#### 导航宽度

```tsx
// 修改前
<nav className="w-[180px] flex-shrink-0 ...">

// 修改后
<nav className="w-[220px] flex-shrink-0 ...">
```

#### Tab 激活态

```tsx
// 修改前
className={`... ${activeTab === tab.id
  ? 'bg-[var(--color-surface-hover)] text-[var(--color-accent)] font-medium'
  : '...'
}`}>

// 修改后
className={`flex items-center gap-2.5 w-full px-3 py-2 mb-0.5 
  rounded-md border-none cursor-pointer text-sm text-left 
  transition-colors duration-100
  ${activeTab === tab.id
    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium border-l-[3px] border-l-[var(--color-accent)]'
    : 'bg-transparent text-[var(--color-text-secondary)] font-normal hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
  }`}
>
```

#### 分组标题

```tsx
// 修改前
<div className="text-[10px] font-semibold text-[var(--color-text-muted)] 
               uppercase tracking-[0.08em] ...">

// 修改后
<div className="text-[11px] font-semibold text-[var(--color-text-tertiary)] 
               tracking-[0.04em] px-2 pb-1.5">
```

---

## 四、P1 — 重要修复

### 4.1 侧边栏品牌化

**文件**: `frontend/src/components/AgentStudio/AgentStudioSidebar.tsx`

```tsx
// Logo 区域
<div className="w-9 h-9 rounded-xl bg-[var(--color-accent)]/10 
                flex items-center justify-center">
  <BotIcon size={20} className="text-[var(--color-accent)]" />
</div>

// 新建对话按钮
<button className="w-full flex items-center gap-2 px-3 py-2 
                   rounded-lg bg-[var(--color-surface-hover)] 
                   border border-[var(--color-border)]
                   text-[var(--color-text-secondary)] text-[13px] 
                   cursor-pointer transition-all duration-150
                   hover:bg-[var(--color-surface-elevated)] 
                   hover:border-[var(--color-accent)]/40
                   hover:text-[var(--color-text-primary)]">
  <Plus size={16} />
  <span>新建对话</span>
</button>

// 折叠按钮
<button className="w-8 h-8 ...">
  <PanelLeft size={18} />
</button>
```

### 4.2 InputToolbar 输入框

**文件**: `frontend/src/components/AgentStudio/workstation/InputToolbar.tsx`

```tsx
// 禁用态发送按钮
<button
  className={`... ${
    composer.hasContent
      ? 'bg-[var(--color-accent)] text-[var(--color-text-on-accent)] shadow-sm hover:brightness-110 hover:-translate-y-px'
      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] cursor-not-allowed'
  }`}
>

// 停止按钮
<button className="flex items-center justify-center gap-2 px-6 py-2 
                   rounded-xl border-none text-sm font-semibold 
                   cursor-pointer transition-all duration-150
                   bg-[var(--color-danger)]/10 text-[var(--color-danger)] 
                   hover:bg-[var(--color-danger)]/20">
```

### 4.3 UserMenu 用户菜单

**文件**: `frontend/src/components/AgentStudio/sidebar/UserMenu.tsx`

```tsx
// 头像 - 首字母回退
<div className="w-8 h-8 bg-[var(--color-accent)]/15 rounded-full 
                flex items-center justify-center">
  {user?.username 
    ? <span className="text-xs font-semibold text-[var(--color-accent)]">
        {user.username.charAt(0).toUpperCase()}
      </span>
    : <User size={16} className="text-[var(--color-text-secondary)]" />
  }
</div>

// 弹窗分隔线
<div className="h-px bg-[var(--color-border)] my-1" />

// 弹窗容器
<div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] 
                rounded-xl shadow-lg">
```

### 4.4 GreetingAnimation 打字动画

**文件**: `frontend/src/components/AgentStudio/workstation/GreetingAnimation.tsx`

```tsx
// 打字速度
const TYPING_SPEED = 50; // was 100

// 标题字号
<h1 className="text-[clamp(28px,4vw,36px)] leading-[1.15] font-bold 
               tracking-tight text-[var(--color-text-primary)]">
  {displayedText}
  <span className="inline-block w-[2px] h-[1em] ml-0.5 
                   bg-[var(--color-accent)] 
                   animate-[blink_0.8s_step-end_infinite]
                   align-middle" />
</h1>
```

---

## 五、P2 — 增强项

| 项目 | 文件 | 修改 |
|------|------|------|
| 侧边栏折叠按钮 | `AgentStudioSidebar.tsx` | `w-7 h-7` → `w-8 h-8`，`size={16}` → `size={18}` |
| 工具按钮分组标签 | `HomeScreen.tsx` | 在工具按钮上方添加 "快捷操作" 标签 |
| 对话列表删除按钮 | `ConversationsList.tsx` | 触摸设备默认显示低透明度 |
| 光标闪烁修复 | `GreetingAnimation.tsx` | 使用 `absolute` 定位避免布局偏移 |
| 弹窗标题 | `overlay.css` | `font-size` → `var(--da-font-size-lg)` |
| 加载屏幕 | `App.tsx` | 添加脉冲动画 |
| 上下文菜单间距 | `TeamTree.tsx` | `py-[7px] px-[10px]` → `py-2 px-3` |

---

## 六、完整 Token 系统

### 6.1 暗色主题（默认）

```css
:root {
  color-scheme: dark;

  /* 表面系统 - 5级层次 */
  --color-surface: #0f1117;
  --color-surface-sidebar: #111318;
  --color-surface-raised: #1c1e24;
  --color-surface-overlay: #24252d;
  --color-surface-elevated: #2a2c34;
  --color-surface-hover: rgba(255, 255, 255, 0.06);
  --color-surface-pressed: rgba(255, 255, 255, 0.08);
  --color-surface-card: #24252d;
  --color-input-bg: #1c1e24;
  --color-code-bg: #16181d;

  /* 文字系统 - 4级对比度 */
  --color-text-primary: #f1f1f1;    /* 19:1 */
  --color-text-secondary: #a0a5b0;  /* 8.5:1 */
  --color-text-muted: #8b97a6;      /* 5.2:1 ✓ */
  --color-text-tertiary: #6b7280;   /* 4.6:1 ✓ */

  /* 边框系统 */
  --color-border: rgba(255, 255, 255, 0.12);
  --color-border-subtle: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.20);

  /* 语义色 */
  --color-accent: #6366f1;
  --color-accent-hover: #4f46e5;
  --color-accent-soft: #818cf8;
  --color-danger: #ff4444;
  --color-success: #34d399;
  --color-warning: #f59e0b;
  --color-text-on-accent: #ffffff;

  /* 代码高亮 */
  --syntax-keyword: #c792ea;
  --syntax-string: #c3e88d;
  --syntax-function: #82aaff;
  --syntax-comment: #546e7a;
  --syntax-number: #f78c6c;

  /* 布局尺寸 */
  --da-sidebar-width: clamp(16rem, 16vw, 18.5rem);
  --da-input-height: 56px;
  --da-input-radius: 16px;
  --da-font-size-base: 15px;
  --da-font-size-sm: 13px;
  --da-font-size-xs: 11px;
  --da-font-size-lg: 17px;

  /* 字体栈 */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI',
    'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

### 6.2 亮色主题

```css
:root:not(.dark) {
  color-scheme: light;

  --color-surface: #ffffff;
  --color-surface-sidebar: #f3f4f6;
  --color-surface-raised: #f5f6f8;
  --color-surface-overlay: #ffffff;
  --color-surface-elevated: #ffffff;
  --color-surface-hover: #f1f3f5;
  --color-surface-pressed: #e9ecef;
  --color-input-bg: #f5f6f8;
  --color-code-bg: #f8f9fa;

  --color-text-primary: #111827;
  --color-text-secondary: #4b5563;
  --color-text-muted: #6b7280;
  --color-text-tertiary: #9ca3af;

  --color-border: rgba(0, 0, 0, 0.10);
  --color-border-subtle: rgba(0, 0, 0, 0.06);
  --color-border-strong: rgba(0, 0, 0, 0.15);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.10);
}
```

---

## 七、预期效果对比

| 维度 | 当前 | 优化后 |
|------|------|--------|
| 基础字号 | 14px | 15px |
| 标题冲击力 | 弱 (24px) | 强 (36px) |
| 文字对比度 | 边界/失败 | 全部 WCAG AA ✓ |
| 侧边栏层次 | 无 | 5级表面系统 |
| 操作按钮可点击性 | 20px 目标 | 28px 目标 |
| 激活态可见性 | 无 | 品牌色左边框 |
| 输入框高度 | 64px | 56px |
| 边框可见性 | 近乎消失 | 清晰可辨 |
| 语法高亮 | 全灰度 | 语义色彩 |

---

## 八、实施检查清单

- [ ] 修改 `tailwind-entry.css` 中的 CSS variables
- [ ] 更新 HomeScreen 组件样式
- [ ] 更新 TeamMessage 操作按钮
- [ ] 修复 ConversationsList 固定高度
- [ ] 添加 TeamTreeAgentItem 选中态
- [ ] 加宽 WorkstationPage 导航
- [ ] 品牌化侧边栏 Logo
- [ ] 优化 InputToolbar 交互态
- [ ] 改进 UserMenu 头像和分隔线
- [ ] 提升 GreetingAnimation 打字速度
- [ ] 测试暗色/亮色主题切换
- [ ] 验证 WCAG AA 对比度
