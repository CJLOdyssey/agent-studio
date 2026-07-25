# Tailwind + Ant Design 样式体系改造设计

> **日期**: 2026-07-25
> **状态**: 已批准
> **目标**: 将当前三重样式体系（Ant Design + 52 个手写 CSS 文件 9,472 行 + Tailwind 几乎未用）统一为 Tailwind v4（布局/视觉）+ Ant Design（组件库）双栈

---

## 1. 当前状态

### 问题摘要

| 问题 | 严重度 | 详情 |
|------|--------|------|
| 暗色模式背景全黑 `#000000` | 🔴 致命 | 8 个 `--da-bg-*` 变量全部为 `#000000`，无视觉层次 |
| ConfigProvider 配置失效 | 🔴 致命 | 包裹空 `<div/>`，所有 Ant Design 组件不受主题影响 |
| 强调色全部为灰色 | 🔴 致命 | 7 个 `--da-accent-*` 解析为 `#666`~`#999`，无品牌色 |
| 19+ 种字号无阶梯 | 🟡 高 | 设计令牌仅 6 级，实际使用 19+ 种 |
| 152 处内联样式 | 🟡 高 | 绕过了 CSS 变量体系，不可主题化 |
| 24 种 border-radius | 🟡 中 | 无统一圆角阶梯 |
| 28 个未用 CSS 变量 | 🟢 低 | 占 tokens.css 14% 体积 |
| 52 个 CSS 文件 9,472 行 | — | 主力样式源，与 Tailwind 理念矛盾 |

### 样式体系分层

| 层 | 文件数 | 行数 | 角色 |
|----|--------|------|------|
| Ant Design (antd ^5.29.3) | 10 组件 | — | Input/Select/Button/Dropdown/Pagination |
| 自定义 CSS | 52 | 9,472 | 主力样式源 |
| Tailwind v4 | — | ~35 类 | 安装但几乎未用 |

---

## 2. 改造目标

### 分工边界

```
Ant Design 负责:              Tailwind 负责:
─────────────────────────     ─────────────────────────
· Input / Select / Button     · 布局 (flex, grid)
· Table / Pagination          · 间距 (p-, m-, gap-)
· Modal / Badge / Menu        · 文字 (text-, font-)
· Dropdown / Checkbox         · 颜色 (bg-, text-, border-)
                               · 圆角 (rounded-)
                               · 阴影 (shadow-)
                               · 宽度/高度 (w-, h-)
                               · 自定义组件视觉
```

### 完成标准

每个模块替换完成后需满足：
- [ ] 改前改后视觉对比一致（或更好）
- [ ] 零新增 CSS 文件
- [ ] 所有内联 `style={{}}` 已消除
- [ ] 亮色模式 + 暗色模式均验证
- [ ] 无新增 ESLint/TypeScript 错误
- [ ] 原有测试继续通过

---

## 3. Phase 1：基础设施 + 紧急修复（1-2 天）

### 3.1 Tailwind @theme 定义

在 `frontend/src/styles/tailwind-entry.css` 中用 `@theme` 定义设计令牌，替代 `tokens.css`：

```css
@import "tailwindcss";

@theme {
  /* 暗色背景层级 — 替代纯黑 #000000 */
  --color-surface: #0d0d0d;
  --color-surface-raised: #1a1a1a;
  --color-surface-overlay: #242424;
  --color-surface-elevated: #2a2a2a;
  --color-surface-hover: #333333;

  /* 品牌强调色 — 替代 7 个灰色强调色 */
  --color-accent: #6366f1;         /* Indigo-500 */
  --color-accent-soft: #4f46e5;    /* Indigo-600 */

  /* 文字色阶 */
  --color-text-primary: #f1f1f1;
  --color-text-secondary: #a0a0a0;
  --color-text-muted: #6b7280;

  /* 边框 */
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.16);

  /* 字号阶梯 */
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 24px;

  /* 圆角阶梯 */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

### 3.2 ConfigProvider 修复

将 ConfigProvider 移到组件树根部，同步 Ant Design token 与 Tailwind 主题：

```tsx
// App.tsx
<ConfigProvider
  theme={{
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#6366f1',
      colorBgContainer: isDark ? '#1a1a1a' : '#ffffff',
      colorBgElevated: isDark ? '#242424' : '#ffffff',
      borderRadius: 6,
      fontSize: 14,
      colorTextSecondary: '#a0a0a0',
    },
  }}
>
  <RouterProvider />
</ConfigProvider>
```

### 3.3 紧急可访问性修复

| 修复项 | 位置 | 操作 |
|--------|------|------|
| 添加 skip-link HTML 元素 | App.tsx 顶部 | `<a class="skip-link" href="#main-content">跳转到主内容</a>` |
| 15 个 modal-close 添加 aria-label | 各 Modal 组件 | `aria-label={t('common.close')}` |

### 3.4 清理未用变量

删除 `tokens.css` 中 28 个未用变量（`--da-shadow-*`, `--da-bg-pressed`, `--da-font-size-2xl`, 等 14 个 da 变量 + 14 个别名变量）。

---

## 4. Phase 2：布局/导航/侧栏（3-4 天）

### 文件清单

| 文件 | 行数 | 替换方式 |
|------|------|---------|
| `styles/layout.css` | 948 | → Tailwind 布局类 (flex, grid, gap, p-) |
| `styles/sidebar/logo.css` | 54 | → Tailwind |
| `styles/sidebar/headers.css` | 69 | → Tailwind |
| `styles/sidebar/teams.css` | 396 | → Tailwind |
| `styles/sidebar/conversations.css` | 113 | 合并到 layout，删除重复 |
| `styles/sidebar/projects.css` | 23 | 直接删除（无对应组件）|
| `styles/sidebar/usermenu.css` | 90 | 直接删除（被 layout.css 替代）|
| `styles/sidebar/misc.css` | 49 | → Tailwind |

### 重点工作

- **`WorkstationPage.tsx`**: 迁移 9 处内联样式到 Tailwind className
- **合并两套对话列表样式**: 删除 `agentstudio-chat-*`（layout.css 中未使用的）或 `agentstudio-conv-*`（conversations.css 中的），保留活跃的一套
- **`layout.css` 中与 sidebar 子文件重复的样式**: 删除重复定义，只保留一份

---

## 5. Phase 3a：消息体系（3-4 天）

### 文件清单

| 目录 | 文件数 | 行数 |
|------|--------|------|
| `styles/chat/*.css` | 12 | 1,744 |
| `styles/components/*.css` | 7 | 881 |

### 包含组件

- 消息气泡（用户气泡 + Agent 气泡 + 代码块）
- Thinking 树形节点
- 输入工具栏
- 模型选择器
- 欢迎页 + 问候动画
- 骨架屏/加载状态
- 按钮/表单/切换/滑块

### 内联样式修复

| 位置 | 数量 | 操作 |
|------|------|------|
| `TeamMessage.tsx` | 4 | 替换为 CSS modifier class |
| `CodeBlock.tsx` | 1 | 提取到常量 |

---

## 6. Phase 3b：弹窗体系（2-3 天）

### 文件清单

| 文件 | 行数 | 替换方式 |
|------|------|---------|
| `styles/modals/*.css` (8 文件) | 1,344 | → Tailwind + Ant Design Modal |

### 重点

- 复用 Ant Design 的 Modal 组件（目前 Modal 是原生 div 实现但 CSS 覆写了 `.ant-modal`）
- 确认弹窗、表单弹窗、Picker 弹窗、版本历史弹窗统一风格
- 合并 `DeleteConfirmModal` 和 `BatchDeleteModal`（几乎相同）

---

## 7. Phase 3c：工作台模块（4-7 天，并行）

### 文件清单

| 文件 | 行数 |
|------|------|
| `styles/workstation.css` | 802 |
| `styles/workstation-modal.css` | 579 |
| `styles/workstation-table.css` | 739 |
| `styles/workstation-toolbar.css` | 309 |
| `styles/workstation-layout.css` | 110 |
| `styles/workstation-dropdown.css` | 70 |
| `styles/workstation-monitor.css` | 290 |
| `styles/workstation-settings.css` | 120 |
| `styles/workstation-responsive.css` | 少量 |

### 并行策略

| 批次 | 模块 | 并行度 | 预计天数 |
|------|------|--------|---------|
| Batch 1 | 团队管理 + Agent 管理 + 提示词管理 | 3 个并行 | 2 天 |
| Batch 2 | 工具管理 + MCP 管理 + Skills 管理 | 3 个并行 | 2 天 |
| Batch 3 | 工作流 + 监控中心 + 审计日志 + 输出约束 | 4 个并行 | 3 天 |

### 内联样式修复重点

| 文件 | 数量 | 处理方式 |
|------|------|---------|
| `TeamMemberManager.tsx` | 33 | Tailwind + color-mix |
| `WorkflowEditor.tsx` | 19 | Tailwind + CSS 变量 |
| `MonitorActivity.tsx` | 9 | Tailwind |
| `MonitorCenter.tsx` | 8 | Tailwind |
| 其余 22 文件 | 1-5 各 | 逐个替换 |

---

## 8. Phase 4：收尾验证（2-3 天）

### 清理清单

| 清理项 | 预期减少 |
|--------|---------|
| 删除不再使用的 .css 文件 | -9,000 行 |
| 删除 tokens.css（已由 @theme 替代）|-219 行 |
| 合并重复 @keyframes `wsta-toast-in` | — |
| 统一 z-index 魔法数字（`9999`, `99999` 等）| 9 处修复 |

### 验证清单

- [ ] 全局视觉回归测试（每个阶段后截图对比）
- [ ] Lighthouse 评分无明显下降
- [ ] 零 `!important`（当前已零，保持）
- [ ] ESLint/TypeScript 无新增错误
- [ ] 全部单元测试通过
- [ ] 亮色/暗色模式均通过视觉检查

---

## 9. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Phase 2 layout.css 替换破坏布局 | 中 | 高 | 逐步替换 + 每改一个 section 就截图对比 |
| Phase 3c 并行合并冲突 | 高 | 中 | 每个模块独立分支，各自 PR |
| Phase 3b Ant Design Modal 行为差异 | 中 | 中 | 先在非核心模块验证，再推广 |
| 工期估计偏差 | 中 | 低 | 每阶段设停止条件，不追求完美 |

---

## 10. 改造成本预估

| 阶段 | 工作量 | CSS 减少 | 风险 |
|------|--------|---------|------|
| Phase 1: 基础设施 | 1-2 天 | 0 | 低 |
| Phase 2: 布局/导航 | 3-4 天 | ~1,800 | 中 |
| Phase 3a: 消息体系 | 3-4 天 | ~2,600 | 中 |
| Phase 3b: 弹窗体系 | 2-3 天 | ~1,300 | 中 |
| Phase 3c: 工作台模块 | 4-7 天 | ~3,900 | 中高 |
| Phase 4: 收尾 | 2-3 天 | ~200 | 低 |
| **总计** | **3-4 周** | **~8,500 行** | — |

### 改后预期

| 指标 | 改前 | 改后 |
|------|------|------|
| CSS 文件数 | 52 | ~5 |
| CSS 总行数 | 9,472 | ~1,000 |
| Tailwind 使用量 | ~35 类 | ~3,000+ |
| 内联样式 style={{}} | 152 | 0 |
| z-index 魔法数字 | 9 处 | 0 |
| 未用 CSS 变量 | 28 个 | 0 |
| 死 CSS 文件 | 3 个 | 0 |

---

## 11. 设计决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| Tailwind 主题定义方式 | `@theme` vs `tailwind.config.js` | `@theme` | Tailwind v4 官方推荐 |
| 暗色背景层级方案 | 自定义 vs Zinc 色阶 | 自定义 `--color-surface-*` | 更精确控制 |
| 品牌色 | Indigo vs 其他 | Indigo-500 `#6366f1` | 与当前 Ant Design 默认色一致 |
| 内联样式替换策略 | 全部替换 vs 逐步 | Phase 逐一推进 | 可独立验证 |
| 模块替换顺序 | 独立模块优先 vs 核心模块优先 | 核心模块优先 | Phase 1 修复核心体验（布局/消息） |
