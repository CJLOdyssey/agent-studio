# UI 缺陷修复设计文档

> **日期**: 2026-07-25
> **状态**: 设计稿
> **范围**: 全应用 UI 一致性修复，含侧边栏 / 主页 / 消息面板 / 弹窗系统 / Workspace / WorkstationPage

---

## 1. 修复策略

### 分层修复（按依赖关系排序）

```
Phase 0 — 全局 Token 修复（根字号、字号体系、对比度、hover 可见度）
  ↓
Phase 1 — 侧边栏整体修复（按钮、间距、对齐、空状态、触摸目标）
  ↓
Phase 2 — 弹窗系统统一（两套合并、按钮高度、active 态、内联 style 迁移）
  ↓
Phase 3 — 剩余组件修复（Header / HomeScreen / Messages / Workspace / WorkstationPage）
  ↓
Phase 4 — 清理遗留代码（devagents-* 命名、未定义变量引用、confirm()）
```

**原则**：
- P0/P1 优先修复，P2/P3 视情况并行
- 每个 Phase 可独立交付，不阻塞后续 Phase
- 不改动功能逻辑，纯 UI 层调整

---

## 2. Phase 0 — 全局 Token 修复

### 2.1 统一字号体系

**现状问题 (G1, G2)**：
- `html { font-size: 15px }` 使所有 rem 缩水 6.25%
- `--da-font-size-*`(xs:11, sm:13, base:15, lg:17, xl:22) 与 Tailwind `@theme --text-*`(xs:12, sm:13, base:14, lg:16, xl:20) 并存

**修复方案**：
```
html { font-size: 16px }  // 改回浏览器默认
body { font-size: 14px }  // 视觉字号在 body 层设
```

统一使用 Tailwind `@theme --text-*` 体系：
| Token | 值 | 用途 |
|-------|-----|------|
| `--text-xs` | 11px | 辅助标签、时间戳、版本 |
| `--text-sm` | 13px | 按钮、列表项、次要文字 |
| `--text-base` | 14px | 正文、段落、输入框 |
| `--text-lg` | 16px | 小标题 |
| `--text-xl` | 20px | 弹窗标题 |
| `--text-2xl` | 24px | 页面大标题 |

移除 `--da-font-size-base/sm/xs/lg/xl` 自定义变量，全局迁移到 Tailwind 的 `text-xs/sm/base/lg/xl/2xl`。

**改动范围**：
- `tailwind-entry.css`：修改 `@theme` 中字号值 + 移除 `--da-font-size-*`
- `reset.css`：html font-size 改为 16px
- 全项目搜索 `text-[15px]`, `text-[11px]`, `text-[12.5px]`, `text-[17px]`, `var(--da-font-size-*)`，替换为对应 Tailwind 类

### 2.2 修复对比度 (G3)

**现状问题**：`--color-text-tertiary: #6b7280` 在 `#111318` 上仅 3.57:1

**修复方案**：
```
--color-text-tertiary: #9ca3af  // 调亮至 #9ca3af（在 #111318 上 ≈ 5.2:1，通过 AA）
```

暗色下 text-tertiary 从 `#6b7280` 改为 `#9ca3af`，保持视觉层级但满足无障碍。

### 2.3 hover 可见度提升 (G4)

```
--color-surface-hover: rgba(255, 255, 255, 0.08)  // 从 0.06 提升到 0.08
```

### 2.4 修复未定义变量引用 (G5)

App.tsx 中的 `var(--da-text-muted)`, `var(--da-bg-hover)`, `var(--da-bg-elevated)`, `var(--da-bg-primary)` 替换为对应的 `--color-text-*` / `--color-surface-*`。

### 2.5 滚动条轨道色匹配 (G6)

```
scrollbar-color: var(--color-border) var(--color-surface-sidebar)
// 轨道色从 --color-surface-raised 改为 --color-surface-sidebar
```

---

## 3. Phase 1 — 侧边栏修复

### 3.1 Button "新建对话" 重设尺寸 (S14, S15)

**现状**：高 34.5px（`py-2`=7.5px + 19.5px 内容 + 7.5px），图标 16px，文字 text-sm(13px)

**修复方案**：
```
py-2.5 (10px) → 高度 ≈ 40px
图标 size={14} 匹配文字 text-sm(13px) → 视觉统一
容器 padding px-3 → px-4 (16px) 增加两侧呼吸空间
```

### 3.2 触摸目标放大 (S3)

| 元素 | 现状 | 修复 |
|------|------|------|
| 折叠箭头 | `w-[18px] h-[18px]` | `w-[22px] h-[22px]` (padding 占位) |
| 更多按钮 | `w-[22px] h-[22px]` | `w-[24px] h-[24px]` (满足 WCAG) |
| 侧边栏折叠 | `w-8 h-8` (30px) | 桌面可接受，保持现状 |

### 3.3 Virtuoso 嵌套滚动修复 (S2)

移除 ConversationsList 父容器 `overflow-y-auto`，让 Virtuoso 独自管理垂直滚动。

### 3.4 对齐修复 (S6, S7)

**左边缘对齐**：
- TeamTree 列表项从 `pl-[6px]` 改为 `pl-2` (8px)
- ConversationsList 从 `px-2` 改为与容器对齐（`px-0`）
- 团队行与对话行共享同一左边缘

**激活态宽度跳动**：
- 非激活对话项加 `border-l-2 border-l-transparent` 占位

### 3.5 垂直间距统一 (S5)

| 层级 | 现状 | 统一为 |
|------|------|--------|
| 团队行 | `py-[6px]` | `py-1.5` (6px) |
| Agent 项 | `py-[5px]` | `py-1` (4px) |
| 对话项 | `py-2` (8px) | `py-1.5` (6px) |

### 3.6 TeamTree 空状态 (S8)

当 `teams.length === 0` 时，显示空状态消息 "暂无团队，点击 + 创建"。

### 3.7 UserMenu 定位 (S11)

用 `bottom: calc(100% + 8px); left: 12px; right: 12px` 替代当前的 `left: 3px; right: 3px`。
或用浮层方案（Radix Popover 或 Floating UI）简化。

### 3.8 Agent 数量徽标 (S12)

`min-w-[14px]` → `min-w-fit px-1` 适配双位数。

### 3.9 未使用的 pinned 分组 (S13)

移除 `groupedConversations.pinned` 定义及相关死代码。

---

## 4. Phase 2 — 弹窗系统统一

### 4.1 统一两套弹窗 (MD1)

- `agentstudio-modal` 和 `shared/Modal` 组件统一使用 `shared/Modal`
- 确认弹窗迁移使用 `shared/Modal` + `ConfirmModal` 组件

### 4.2 按钮高度标准 (MD2)

```
.agentstudio-modal-btn: height: 34px → height: 36px（最低标准）
Settings/ApiModals 中的按钮也统一为 36px
```

### 4.3 `.active` 类无样式 (SM2, AM1)

SettingsModal 和 ApiManagementModal 的左侧导航 tab 需要 `.active` 样式：
```css
/* 添加到 modal 样式文件 */
.nav-tab.active {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}
.nav-tab.active svg {
  color: var(--color-accent);
  opacity: 1;
}
```

### 4.4 SettingsModal About 页内联样式迁移 (SM3)

将 80 行内联 `style={{}}` 迁移为 Tailwind 类 + CSS 变量：
- `display: 'flex'` → `flex`
- `padding: '24px 20px'` → `px-5 py-6`
- `borderRadius: 10` → `rounded-lg`
- `fontSize: 11` → `text-xs`
- 依此类推

### 4.5 删除操作用自定义 ConfirmModal (AM2)

`ApiManagementModal.handleDeleteKey` 中的 `confirm()` 改为使用项目的 `ConfirmModal`。

### 4.6 SettingsModal 字体滑块 CSS 提取 (SM4)

将 300+ 字符的 Tailwind arbitrary variants 提取到 `workstation/ant-overrides.css` 中作为一个 CSS 类。

### 4.7 原生 checkbox 样式 (CI1)

在 CSS 中添加 checkbox 样式覆盖：
```css
.agent-config-list input[type="checkbox"] {
  accent-color: var(--color-accent);
}
```

---

## 5. Phase 3 — 剩余组件修复

### 5.1 Header 主题切换 (H1)

Header 主题切换按钮改为使用 `useSettings` 的 `updateSettings`，遵循 light/dark/system 三档。
（修改 `AgentStudioWorkstation.tsx:75`）

### 5.2 消息区 max-width 弹性化 (M1)

`max-w-[900px]` → `max-w-[min(900px,85vw)]`，使小屏设备不浪费空间。

### 5.3 消息操作按钮触摸目标 (M2, M3, M4)

| 元素 | 现状 | 修复 |
|------|------|------|
| 版本切换 | `w-5 h-5` (18.75px) | `w-6 h-6` (24px) |
| 赞/踩 | `w-6 h-6` (22.5px) | `min-w-[24px] min-h-[24px]` |
| 复制/编辑/重新生成 | `px-1 py-0.5` | `px-1.5 py-1` |

### 5.4 时间戳可读性 (M5)

`opacity-70` 移除，`text-xs` 改为 `text-[11px]`（或 `text-xs`+ 不降透明度）。

### 5.5 WorkstationPage 导航激活态 (WP2)

激活态从 `bg-surface-hover` 改为 `bg-[var(--color-accent)]/10` + `font-medium`，使其与 hover 态视觉区分。

### 5.6 Workspace 宽度响应 (W1)

`w-[320px]` → `clamp(280px, 22vw, 360px)` 使其随视口变化。

### 5.7 Workspace Tab 激活态 (W2)

实心 accent 背景改为 `bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium`，与 WorkstationPage 的激活态一致。

### 5.8 HomeScreen 快捷按钮间距 (H3)

`py-1.5` (5.6px) → `py-[7px]` 增加垂直呼吸空间。

### 5.9 Header 通知红点定位 (H2)

`top-[6px] right-2` → 用 flex 布局替代绝对定位，避免与按钮大小耦合。

---

## 6. Phase 4 — 遗留清理

### 6.1 命名清理

- `Header.tsx`：`devagents-header` → `agentstudio-header`
- App.tsx loadingScreenStyle：检查是否仍在使用

### 6.2 移除死代码

- ConversationsList 中的 pinned 分组
- `--da-line-height`（已通过 Tailwind 管理）

---

## 7. 组件影响面汇总

| 文件 | Phase | 改动类型 | 预估改动行数 |
|------|-------|---------|------------|
| `tailwind-entry.css` | 0 | Token 值调整 | ~20 行 |
| `reset.css` | 0 | font-size | 1 行 |
| `scrollbar.css` | 0 | 颜色变量 | 1 行 |
| `App.tsx` | 0 | 变量引用修复 | ~5 行 |
| `AgentStudioSidebar.tsx` | 1 | padding/class | ~10 行 |
| `TeamTree.tsx` | 1 | spacing/empty state | ~15 行 |
| `TeamTreeAgentItem.tsx` | 1 | 触摸目标 | ~5 行 |
| `ConversationsList.tsx` | 1 | 滚动/间距/死代码 | ~15 行 |
| `UserMenu.tsx` | 1 | 定位 | ~5 行 |
| `overlay.css` | 2 | button height | 1 行 |
| `buttons.css` | 2 | height | 1 行 |
| `WorkstationPage.tsx` | 3 | active 态 class | ~5 行 |
| `Workspace.tsx` | 3 | 宽度/样式 | ~5 行 |
| `HomeScreen.tsx` | 3 | spacing | ~5 行 |
| `MessagesPanel.tsx` | 3 | max-width | 1 行 |
| `TeamMessage.tsx` | 3 | 触摸/透明度 | ~10 行 |
| `SettingsModal.tsx` | 2 | 内联样式迁移 | ~60 行 |
| `ApiManagementModal.tsx` | 2 | confirm/active | ~5 行 |
| `ConfigItemList.tsx` | 2 | checkbox | ~3 行 |

**总计预估**：约 170 行改动（含内联样式迁移），纯 UI 层，不改功能逻辑。

---

## 8. 验收标准

- [ ] `html` font-size 改为 16px，rem 计算结果符合预期
- [ ] 全局字号统一使用 `text-xs/sm/base/lg/xl`，无硬编码 `text-[Npx]` 或 `--da-font-size-*`
- [ ] 暗色下 `--color-text-tertiary` 在侧边栏 ≥ WCAG AA (4.5:1)
- [ ] 侧边栏按钮高度 ≥ 40px，图标与文字尺寸匹配
- [ ] 所有触摸目标 ≥ 24×24px
- [ ] 弹窗按钮高度统一 ≥ 36px
- [ ] SettingsModal `/about` 无内联 style
- [ ] 删除操作用自定义 ConfirmModal 而非 browser `confirm()`
- [ ] WorkstationPage 导航激活态与 hover 态视觉可区分
- [ ] no `var(--da-text-muted)` / `var(--da-bg-*)` 等未定义引用
