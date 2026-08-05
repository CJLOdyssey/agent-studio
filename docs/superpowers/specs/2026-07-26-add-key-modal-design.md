# 添加 Key 弹窗重构设计

> 团队/企业多 Key 管理场景下的 ProviderEditModal 重构方案。

## 背景

当前 `ProviderEditModal.tsx` 是一个 234 行的单体组件，存在以下问题：

- Capabilities（支持能力）和 Purpose（用途）信息重复展示
- Provider 下拉框无样式
- 缺少"设为默认 Key"功能
- 测试连接与保存流程断裂（需保存后再到列表页操作）
- 模型列表只能从 API 拉取，无法手动编辑
- 内联样式与 Tailwind class 混用

## 设计思路

采用**分区布局（Zone Layout）**，将弹窗内容按功能划分为三个清晰区域，每区一个子组件。

## 组件架构

```
ApiManagementModal (容器)
 └─ ProviderEditModal (弹窗骨架，持有所有 state)
     ├─ ProviderSelector      ← 第一区
     ├─ CredentialsSection    ← 第二区
     ├─ ModelSection          ← 第三区
     └─ ConnectionTest        ← 第三区附属
```

## 状态管理

ProviderEditModal 作为 state owner，统一管理所有表单字段，通过 props 下发给子组件：

- `providerType` → ProviderSelector
- `usageType` → ProviderSelector
- `name, baseUrl, apiKey, isDefault` → CredentialsSection
- `models` → ModelSection
- `testResult` → ConnectionTest
- `saving, fetchingModels` → 全局 loading

## 三区详细设计

### 第一区：供应商选择

消除 Capabilities 与 Purpose 的信息重复。供应商下拉框自带样式（已修复）。用途单选按钮仅在当前供应商支持对应能力时才可选中。

```
┌──────────────────────────────────────┐
│  供应商    [OpenAI              ▼]   │
│            支持:  LLM  Embed          │
│                                     │
│  用途      ● LLM                     │
│            ○ Embed                   │
│            ○ 两者都支持              │
└──────────────────────────────────────┘
```

### 第二区：认证信息

- "名称" 改 "备注名"，语义更清晰
- 已知供应商自动填充 Base URL
- 增加"设为默认 Key" checkbox + 说明文案
- 编辑时显示 masked key 占位

```
┌──────────────────────────────────────┐
│  备注名  [我的 OpenAI Key]    (可选) │
│         用于区分不同的 Key           │
│                                     │
│  Base URL [https://api.openai...]   │
│                                     │
│  API Key  [sk-................] [👁]│
│                                     │
│  □ 设为默认 Key                     │
│     当调用未指定 Key 时使用此 Key    │
└──────────────────────────────────────┘
```

### 第三区：模型 & 验证

- 模型标签可删除（点击标签上的 × 图标）
- 手动添加模型：点击 "+" 按钮 → 行内出现输入框 → 输入 model ID → 回车添加到列表 → 输入框消失
- 从 API 拉取改为*追加*模式（去重），而非替换
- Embedding 模式隐藏整个模型区

### 连接测试

- 测试连接与保存流程解耦，不阻塞表单填写
- 三种结果状态：未测试（显示按钮）、测试中（spinner）、完成（✅ 成功 / ❌ 失败，内联展示）
- 保存时自动触发测试，但如果用户已手动测试成功，不再重复测试
- 测试失败不影响保存（用户仍可强制保存）

```
┌─────────────────────────────────────────┐
│  模型列表                                │
│  ┌─────────────────────────────────────┐│
│  │ [gpt-4] [gpt-4-turbo] [gpt-3.5]   ││
│  │ [+ 手动添加]                       ││
│  │ [🔄 从 API 获取最新模型]            ││
│  └─────────────────────────────────────┘│
│                                          │
│  [测试连接]    ── 或保存时自动测试       │
│  ┌─────────────────────────────────────┐│
│  │ ✅ 连接成功 (120ms)                 ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## API 兼容性

与现有后端 API 完全兼容，字段映射保持不变：

| 表单字段 | API 参数 |
|---|---|
| providerType | provider |
| usageType | usage_type |
| name | label |
| apiKey | api_key |
| baseUrl | base_url |
| models | models |
| isDefault | is_default |

## 状态与边界处理

| 状态 | 表现 |
|---|---|
| Loading（供应商列表加载） | Header icon spinner |
| Empty（API Key 未填） | 模型区提示，保存按钮禁用 |
| Fetching（拉取模型） | 按钮 spinner，列表 disabled |
| Testing（测试连接） | 内联结果展示，不弹 alert |
| Saving（保存中） | 按钮 spinner + disabled |

错误处理：
- 测试失败 → 内联红色结果卡片
- 保存失败 → 通过父组件 error state 展示
- 拉取模型失败 → 保留当前列表，Toast 提示

## 当前问题评估

### 合理保留的
- ✅ Provider 选择器（核心字段）
- ✅ 用途选择（LLM/Embed/Both）
- ✅ 备注名（多 Key 必备）
- ✅ Base URL 输入（自定义 provider 必需）
- ✅ API Key 输入 + 显示/隐藏（安全基础）
- ✅ 从 API 拉取模型列表（便捷功能）

### 不合理/待修复的
- ❌ Capabilities 和 Purpose 信息重复 → 合并，capabilities 仅作为标签展示
- ❌ Provider 下拉框无样式 → 已修复
- ❌ 无"设为默认 Key"开关 → 新增
- ❌ 测试连接与保存流程断裂 → 弹窗内增加测试按钮
- ❌ 模型只能从 API 拉取 → 增加手动添加
- ❌ 标签文案混淆 → "提供商类型" → "供应商"，"名称" → "备注名"
