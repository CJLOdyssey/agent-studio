# 功能设计合理性判断：流程总结 + MCP 创建表单聚焦分析（2026-08-01）

> 本文两部分：
> 1. **流程总结**——提炼整套「判断功能该设计什么、什么合理什么不合理」的方法论为可复用流程
> 2. **聚焦分析**——用该流程落地到「新建 MCP」表单，含代码级消费链验证
>
> 支撑文件：`frontend/src/components/AgentStudio/workstation/mcp/MCPFormModal.tsx`（表单）、`api.ts`（字段映射）、`mcp.types.ts`（类型）、`validate.ts`（校验）、`mcp.constants.ts`（枚举）、`backend/src/routers/mcps.py`（API）、`backend/src/orm/content.py`（ORM）、`backend/src/tasks/agent_pipeline.py`（消费）、`backend/src/tasks/pipeline_utils.py`（消费）。

---

## 第一部分：方法论流程总结

### Step 0 — 先确认「要不要做」

判断三问，任一答不上来就先不做：
1. 不做它，用户会损失什么？
2. 验收标准能写成自动化测试吗？
3. 拆掉一半，核心价值还在吗？（在 → 镀金）

### Step 1 — 按 5 要素描述功能

`用户 → 场景 → 目标（可衡量） → 行为（输入输出） → 验收标准（可验证用例）`

### Step 2 — 定参照对象（判断标准的前提）

| 锚点类型 | 来源 |
|---------|------|
| 竞品/同类 | 别的产品怎么做 |
| 行业基准 | 公认 benchmark / **协议规范 / 配置格式标准** |
| 自身历史 | 上一版本、旧功能 |
| 用户原话 | 访谈、工单 |

> 规则：**标准必须能回答「凭什么这个数」**。没有参照的兜底标准 = 至少可写自动化测试。
> 注意「参照即合理」陷阱：竞品有 ≠ 你需要。

### Step 3 — 逐字段判定（表单场景）

每字段过 5 问：
1. 谁填？填的人手头有这信息吗
2. 系统消费它吗？在哪用
3. 必填/选填依据是什么
4. 有默认值吗（90% 填同一值 → 设默认或删）
5. 与其他字段冲突/冗余吗

**最硬判定法：反向追踪** `表单字段 → 数据模型 → 消费代码点`，grep 无消费点的字段直接删。

### Step 4 — 红旗检查

- 字段 >7 个且无分组
- 必填全选
- 技术字段透出（id、内部状态、时间戳）
- 状态/版本等系统维护值让用户填

### 铁律

> **表单不是「能收集什么」，而是「必须收集什么」**——每个字段都是对用户的索取，索取必须有回报（被消费）。

---

## 第二部分：聚焦「新建 MCP」表单分析

### 被评审表单字段（MCPFormModal.tsx）

| # | 字段 | 必填 | 类型 | 说明 |
|---|------|------|------|------|
| 1 | 名称 | * | input ≤50 | |
| 2 | 描述 | — | textarea ≤500 | |
| 3 | 类型 | — | select `stdio` / `sse` | 联动切换下方字段组 |
| 4 | 状态 | — | select `connected`/`disconnected`/`error` | |
| 5 | 版本 | * | input | 占位 v1.0.0 |
| 6 | 命令 | stdio* | input | 仅 stdio 显示 |
| 7 | 参数 args | — | textarea 每行一个 | 仅 stdio 显示 |
| 8 | 环境变量 env | — | textarea 每行一个 | 仅 stdio 显示 |
| 9 | URL | sse* | input | 仅 sse 显示 |

### 参照锚点 1：MCP 协议规范（最权威参照）

MCP 是**开放协议**，其标准配置形态（`claude_desktop_config.json` / 各客户端 MCP 配置）就是「新建 MCP」表单的行业参照：

```jsonc
// 标准 MCP 服务器配置
{
  "mcpServers": {
    "my-server": {              // 键 = 服务器名
      "type": "stdio",          // 或 sse / http
      "command": "npx",         // stdio: 启动命令
      "args": ["-y", "@model/..."],
      "env": { "KEY": "VALUE" } // 环境变量
      // sse 则用 url: "https://..."
    }
  }
}
```

**协议标准定义的字段只有：名称、type、command、args、env、url。没有描述、没有版本、没有状态。**

### 参照锚点 2-4：行业多源（opencode + Claude Desktop + MCP 规范连接层）

MCP 是**开放协议**，客户端配置是「新建 MCP」表单的直接参照。抓取**两个独立客户端源** + 协议规范传输层，验证字段形态是否为行业共识：

**锚点 2：opencode MCP 配置**（https://opencode.ai/docs/mcp-servers/，AgentStudio 直接同类产品）

| opencode 字段 | 类型 | 必填 | 说明 |
|--------------|------|------|------|
| name（配置键） | String | Y | 服务器唯一名 |
| type | String | Y | `local` / `remote` |
| command | Array | Y(local) | **命令 + 参数合并为一个数组** |
| cwd | String | — | 服务器进程工作目录 |
| environment | Object | — | **结构化 key-value**，非文本 |
| enabled | Boolean | — | **启用/禁用开关（布尔）** |
| timeout | Number | — | 拉取工具超时，默认 5000ms |
| url | String | Y(remote) | 远程服务器地址 |
| headers | Object | — | 远程请求头 |
| oauth | Object\|false | — | 远程认证 |

**锚点 3：Claude Desktop 官方配置**（https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers.md，MCP 生态事实标准客户端）

```jsonc
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",           // 字符串命令
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": { "APPDATA": "...", "BRAVE_API_KEY": "..." }  // 结构化对象
    }
  }
}
```

**Claude Desktop 字段：name（键）+ command（字符串）+ args（数组）+ env（对象）+ url（remote）。无 status/version/description。**

**锚点 4：MCP 协议 stdio 传输规范**（https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio.md）

确认连接层语义：**client 作为子进程启动服务器**，command/args/env 即启动参数——连接配置层字段由各客户端定义，命令+参数+环境变量是共识核心。

### 三源共性结论（高可信度）

| 字段形态 | opencode | Claude Desktop | 判定 |
|---------|----------|---------------|------|
| 无 status 三态，用 enabled/开关或隐含 | ✅ enabled | ⚠️ 无状态字段 | **状态非连接配置字段** |
| command（+args 数组） | ✅ 数组 | ✅ 字符串+数组 | **命令+参数是连接核心** |
| env 是结构化对象 | ✅ | ✅ | **2/2 源结构化** |
| 无 version / description | ✅ | ✅ | **自加字段无支撑** |
| cwd / timeout / headers | ✅ | ⚠️ env 覆盖 | 增强字段，非必需 |

**竞品揭示的关键差异**（多源反衬本表单）：
1. **状态三态无任何源支持**——opencode 用 `enabled` 布尔开关，Claude Desktop 无状态字段（连接态是系统探测结果）
2. **command 是数组**（含 args），本项目拆成 command + args 两个字段
3. **environment 是结构化对象**（2/2 源），本项目用 `\n` 分隔文本（`MCPFormModal.tsx:64`）
4. **cwd / timeout / headers / oauth** 竞品有、本项目缺失
5. 无 description、无 version、无 status —— 与协议标准一致，**自加字段无竞品支撑**

### 字段对照表（多源：协议 + 2 客户端）

| 表单字段 | MCP 协议 | opencode | Claude Desktop | 判定 |
|---------|---------|----------|---------------|------|
| 名称 | ✅ 服务器名 | ✅ 配置键 | ✅ 配置键 | **3/3 对齐，合理** |
| 类型 | ✅ stdio/sse | ✅ local/remote | ✅ | 对齐，合理（命名可对齐） |
| 命令/URL | ✅ command/url | ✅ | ✅ | **3/3 对齐，合理** |
| 参数 args | ✅ args | ⚠️ 并入 command | ✅ args | 合理，可考虑合并 |
| 环境变量 env | ✅ env(对象) | ✅ environment(对象) | ✅ env(对象) | **3/3 结构化，本表单形态错误** |
| 描述 | ❌ 无 | ❌ 无 | ❌ 无 | **0/3，自加** |
| 版本 | ❌ 无 | ❌ 无 | ❌ 无 | **0/3，自加** |
| 状态 | ❌ 无 | ⚠️ enabled 开关 | ❌ 无 | **0/3，形态错误** |
| — cwd | ❌ | ✅ | ❌ | 缺失（opencode 增强） |
| — timeout | ❌ | ✅ | ❌ | 缺失（opencode 增强） |
| — headers | ❌ | ✅ | ⚠️ env 可带 | 缺失（remote 认证） |

### 逐字段设计合理性深度分析

每个字段按「**设计动机 → 当前设计 → 合理性判定 → 竞品对比**」四段分析。竞品 = MCP 协议标准（`claude_desktop_config.json`）+ opencode `mcp` 配置。

#### D1. 名称

- **设计动机**：MCP 服务器唯一标识，用户靠它区分/引用多个服务器；opencode 用 `use context7` 在提示中按名引用，名称即寻址键。设计合理。
- **当前设计**：必填 input ≤50 字符（`:31-32`）；`validate.ts:10-13` 非空 + ≥2 字符 + ≤50 + 去重。
- **合理性判定**：✅ **合理**。消费点明确（后端按 `name` 匹配：`agent_pipeline.py:194` `m.name == name`），校验完备（去重是加分）。仅「≥2 字符」对中文单字名（如「测」）偏紧，小瑕疵。
- **竞品对比**：opencode/协议均以「配置键」作名称，无长度限制概念，本项目 50 字符上限合理。

#### D2. 类型

- **设计动机**：区分连接协议——stdio（本地子进程）vs sse（远程 HTTP），决定后续字段组与运行方式。设计合理。
- **当前设计**：select `stdio`/`sse`（`:40-43`）；按 type 条件渲染字段组（`:52-72`）；切换时联动清空对端字段（`:56/:70`）。
- **合理性判定**：✅ **合理**。条件渲染避免无关字段同屏是正确设计。命名可对齐竞品（local/remote）。
- **竞品对比**：opencode 用 `local`/`remote`、协议用 `stdio`/`sse`/`http`。**本项目 `stdio`/`sse` 缺 http（Streamable HTTP 单独类型）**，且语义对齐竞品 local/remote 更清晰——命名与枚举可商榷但非缺陷。

#### D3. 命令 / URL

- **设计动机**：连接目标——stdio 的启动命令、sse 的服务地址。两者是 MCP 服务器的核心连接参数，必填。设计合理。
- **当前设计**：stdio 必填 command input（`:55-56`）、sse 必填 url input（`:69-70`）；`validate.ts:15-16` 按类型校验非空。
- **合理性判定**：✅ **合理**。消费于 `agent_pipeline.py:205-234`（stdio 子进程/sse 请求），核心字段无争议。
- **竞品对比**：opencode 命令是**数组**（`command: ["npx","-y","..."]`），本项目拆成 command（input）+ args（textarea）两字段——**合并更贴近竞品且避免「args 是否属于 command」的歧义**。URL 两端一致。

#### D4. 参数 args

- **设计动机**：stdio 启动命令的附加参数（如 `-y @model/...`）。设计合理。
- **当前设计**：textarea 每行一个参数（`:59-60`），`split('\n').trim().filter(Boolean)` 转数组；`validate.ts` 不校验。
- **合理性判定**：⚠️ **合理但形态可优化**。消费于 `agent_pipeline.py:209` 注入 stdio。但 `\n` 分隔使「含换行的参数值」无法表达，且与竞品「命令数组一体」的结构偏离。
- **竞品对比**：opencode 将 args 并入 `command: [...]` 数组；本项目独立成 textarea 文本字段，**采集形态与存储结构（数组）不一致，是设计缺陷**。

#### D5. 环境变量 env

- **设计动机**：为 MCP 子进程注入环境变量（密钥、配置）。设计合理，MCP 连接几乎必配。
- **当前设计**：textarea 每行一个（`:63-64`），`split('\n')` 转字符串数组；`validate.ts` **无 `KEY=VALUE` 格式校验**。
- **合理性判定**：❌ **形态设计错误**。三个问题：
  1. env 本质是 **key-value 键值对**，却用「每行一条裸文本」采集——`api.ts:36` 存成 `env: string[]` 数组，后端 `agent_pipeline.py:209` 需自行解析成字典，**采集形态、存储结构、消费形态三层不一致**
  2. 无 `KEY=VALUE` 校验，用户填 `foo`（缺 `=`）也通过，运行时 env 注入静默失败
  3. 竞品是结构化对象 `environment: {KEY: VALUE}`，本项目文本数组是退化形态
- **竞品对比**：opencode `environment: {K:V}` 对象、协议 `env: {K:V}` 对象——**本项目应改为结构化 key-value 编辑**（键值对输入或 JSON），而非 `\n` 文本。

#### D6. 描述

- **设计动机**：给 MCP 服务器加人类可读说明。设计动机存疑——MCP 服务器是「运行时配置」而非「文档资源」。
- **当前设计**：选填 textarea ≤500（`:35-36`）；`api.ts:18` 存入 config JSON，仅列表展示消费。
- **合理性判定**：⚠️ **弱价值字段**。无后端逻辑消费（`agent_pipeline` 从不读 description），仅展示。MCP 列表用户更想看到「连什么服务」（endpoint）而非自填描述。可保留但需标注「仅展示用途」。
- **竞品对比**：opencode `mcp` 配置、协议标准**均无 description 字段**——自加字段，竞品无支撑。

#### D7. 版本

- **设计动机**：MCP 服务器版本号。设计动机存疑——MCP 服务器无「版本」概念（不是库，是配置）。
- **当前设计**：必填 input，占位 v1.0.0（`:74-75`）；`validate.ts:14` 校验 `/^v\d+\.\d+\.\d+$/`；`api.ts:36` 存 config JSON。
- **合理性判定**：❌ **必填不合理**。三点：
  1. 90% 用户填 v1.0.0（占位即答案）——**有默认值却标必填，索取无意义信息**
  2. 消费点仅审计快照（`mcps.py:68`）与表格展示，后端 pipeline 不读
  3. 版本无更新来源——建完永远是 v1.0.0，字段名存实亡
- **竞品对比**：opencode、协议标准**均无 version 字段**——纯自加，应取消必填或删字段。

#### D8. 状态

- **设计动机**：标识 MCP 连接是否正常。设计动机合理——连接健康态是用户关心的核心信息。
- **当前设计**：select `connected/disconnected/error`（`:46-49`）；`api.ts:20` 映射 `active→connected` 之外一律 `disconnected`；`/test`（`mcps.py:150`）**不回写 status**。
- **合理性判定**：❌ **放错位置**。连接状态是**创建后由系统探测**得到的运行时值，不是创建时用户能提供的信息——让用户填「未连接/异常」是索要无法提供的数据。且：
  - `error` 是**死选项**（后端永不回显，`api.ts:20` 只有两种映射）
  - `/test` 探测结果不落库，状态实际无人维护
- **竞品对比**：opencode 用 `enabled: true/false`（**用户控制的启停开关**），连接状态交给系统；本项目用连接三态（**用户填不了的运行时状态**）——**概念错位，应改为 enabled 开关 + 系统探测回写**。

#### D9. 竞品有、本项目缺失的字段

| 缺失字段 | 竞品做法 | 本项目 | 判定 |
|---------|---------|--------|------|
| enabled（启停开关） | opencode `enabled: bool` | 无，用状态 select 替代 | ❌ 缺——用户最常见的操作是临时禁用 MCP 省 context |
| cwd（工作目录） | opencode `cwd` | 无 | ❌ 缺——stdio 进程工作目录 |
| timeout（拉取超时） | opencode `timeout`（默认 5000ms） | 无 | ⚠️ 缺——后端可用默认值 |
| headers/oauth（远程认证） | opencode `headers` + `oauth` | 仅裸 url | ❌ 缺——remote 场景基本都要认证 |

### 消费链与字段去向（反向追踪图）

```
MCPFormModal 收集
  name/type/command/url  → api.ts:35  → endpoint         → agent_pipeline.py:207/236  消费 ✅
  args/env               → api.ts:36  → config JSON      → agent_pipeline.py:209-210  消费 ✅
  description            → api.ts:36  → config JSON      → api.ts:18 回显            消费 ⚠️（仅展示）
  version                → api.ts:36  → config JSON      → mcps.py:68 快照           消费 ⚠️（仅审计）
  status                 → api.ts:37  → active/inactive  → 后端存储，创建时由用户填     状态 ❌ 系统维护
```

### 双挂载点：MCP 表单也是「一个组件、两个入口」（修正补全）

同 Skill 审查结论，MCPFormModal 也是**同一个组件挂载在两个地方**：

| 挂载点 | 位置 | 数据来源 |
|--------|------|---------|
| 管理工作台 | `MCPManagement.tsx` → `MCPFormModal` | `useMcpManagement` + `validate.ts` EMPTY_FORM |
| Agent 弹窗 | `MCPTab.tsx` → `MCPFormModal`；`ItemEditor.tsx:66-76` kind==='mcp' 转发 | `useAgentConfigForm` defaultMCP + `useConfigItemEdit` |

上一轮我只分析了工作站路径，**漏了 Agent 弹窗路径**。补齐后发现比工作站更严重的问题：

#### M1. Agent 弹窗路径保存时静默丢弃 7 个字段（P0）

- **位置**：`useConfigItemEdit.ts:164-174` `saveFormItem('mcp')`
- 编辑：`mcp.update(id, { name, description })` —— 只保留 name/description
- 新建：`mcp.addCustom(() => ({ id, name, description, enabled: true }))` —— 只保留 name/description
- **MCPFormModal 收集的 type/command/url/args/env/version/status 全部静默丢弃**，无任何提示。用户在 Agent 弹窗内新建 MCP，配的 stdio 命令、env、版本全没了。

#### M2. MCP 没有 `buildMCPItem`，靠强转（P1）

- **位置**：`ItemEditor.tsx:69` `editingItem as MCPEntry | null` 直接断言
- Skill/Tool 都有 `buildSkillItem`/`buildToolItem` 做字段映射，**唯独 MCP 直接强转**。配合 M1，编辑回显的 type/command/url/args/env 无从谈起。

#### M3. `handleEditMcp` 回显字段全落默认值（P1）

- **位置**：`useConfigItemEdit.ts:201-221`
- AgentMCP item 只有 `{id, name, description, serverUrl, enabled}`（`useConfigItemEdit.ts:68`），但 `handleEditMcp` 从 `item.type/item.version/item.command/item.args` 读值——这些键在 item 里根本不存在 → 回显全走 `|| 'stdio' / 'v1.0.0' / ''` 默认值。
- 用户点编辑看到的表单是**假值**，保存后又丢弃（M1）。这条路径基本是坏的。

#### 加分对比：MCP 默认值没有漂移

- 工作站 `validate.ts:4` EMPTY_FORM：`status: 'disconnected'`、`version: 'v1.0.0'`
- Agent 弹窗 `useAgentConfigForm.ts:13` defaultMCP：`status: 'disconnected'`、`version: 'v1.0.0'`
- **两入口默认值一致**（不像 Skill 的 `installed`/`available` 漂移 F-B），这点 MCP 做对了。

### 比 Skill 表单更严重的一点：字段没落库

Skill 表单的 version/category 至少是 `registered_skills` 表的独立列（`content.py:79-87`）。**MCP 的 description/version/args/env 全部挤进一个 `config` JSON 字符串**（`content.py:63`），字段不是一等公民——这同时造成：
- 无法按描述/版本检索（无独立列，SQL 查询要靠 JSON 提取）
- 前后端字段名双层映射（form ↔ config JSON ↔ DB），改一个字段要动 `MCPFormModal` + `api.ts:36/54` + 后端 3 处
- 版本快照（`mcps.py:45 _snapshot_mcp`）也要解 config JSON 才能比较差异

### 修复优先级

| 优先级 | 编号 | 问题 | 建议 |
|--------|------|------|------|
| P0 | M1 | Agent 弹窗路径保存丢 7 字段 | `saveFormItem('mcp')` 改为完整持久化（像工作站一样走 `mcpAPI.create`），或声明该路径只支持简配 |
| P0 | D8 | 状态字段让用户填系统才知道的值 | 移除；用 enabled 布尔开关 + `/test` 探测回写 status（`mcps.py:150` 目前 `MCPTestResult` 无 status 输出） |
| P0 | D9 | 缺失 enabled 启停开关 | 对照 opencode 补齐，替代状态 select |
| P1 | D5 | env 文本切分 + 无格式校验 | 改结构化 key-value 编辑（对齐竞品 `environment: {K:V}`），或至少加 `KEY=VALUE` 校验 |
| P1 | D9 | 缺失 cwd / timeout / headers/oauth | 对照 opencode 补齐；remote 认证（headers/oauth）是真实场景 |
| P1 | M3 | `handleEditMcp` 回显全落默认值 | AgentMCP item 补字段或映射 `serverUrl→url`；M2 补 `buildMCPItem` |
| P1 | — | description/version/args/env 挤在 config JSON | 落独立列或抽象单一映射函数收敛双层映射 |
| P2 | D7 | 版本必填 + 90% 填同一值 | 设默认 v1.0.0 取消必填，或删字段 |
| P2 | D4 | args 独立文本与 command 分离 | 对齐竞品并入 command 数组，或保留但说明形态 |
| P2 | D6 | 描述弱价值 | 保留但标注「仅展示用途」，或在列表用 endpoint 替代描述列 |

### 健康形态建议

```
新建 MCP 表单最小集（对齐协议标准 + 竞品）：
  名称 * | 类型 (local/remote) | 命令(数组) */URL * | 环境变量(结构化 key-value) | enabled 开关
可选补齐（对照 opencode）：cwd / timeout / headers(remote 认证)
移除：状态（改由系统探测 + enabled 开关）、版本可降为选填
说明：描述保留但标注"仅展示用途"
```

### 结论

逐字段设计合理性总览（详析见 D1-D9）：

| 字段 | 判定 | 一句话理由 |
|------|------|-----------|
| 名称 | ✅ 合理 | 寻址键，消费点明确，去重完备 |
| 类型 | ✅ 合理 | 决定连接方式，条件渲染正确 |
| 命令/URL | ✅ 合理 | 核心连接参数，必填合理 |
| 参数 args | ⚠️ 形态可优化 | 应并入 command 数组（对齐竞品） |
| 环境变量 env | ❌ 形态错误 | 文本 `\n` 而非结构化 key-value，无格式校验 |
| 描述 | ⚠️ 弱价值 | 无后端消费，竞品无此字段 |
| 版本 | ❌ 必填不合理 | 90% 填 v1.0.0，无更新来源，竞品无此字段 |
| 状态 | ❌ 放错位置 | 系统探测的运行时值，不该用户填；`error` 死选项 |
| 缺失 cwd/timeout/headers | ❌ 缺失 | 竞品全有，本项目无（enabled 最要紧） |

**最严重的不在字段本身，而在 Agent 弹窗挂载路径（M1）**——`saveFormItem('mcp')` 保存时静默丢弃 7 个字段，该路径基本是坏的。工作站路径完整，Agent 弹窗路径残缺，两个挂载点行为不一致。加分项：type 联动条件渲染 + sse warning 提示条。

### 消费点修正记录（codegraph 核实）

1. 初稿曾判「版本零消费点」，经 codegraph 核实 `MCPManagement.tsx:92,108`（表格版本列）与 `mcps.py:68`（`_snapshot_mcp` 快照记录 version）后修正为「弱消费：仅展示/审计级，后端 pipeline 不读」。方法论意义：**反向追踪要覆盖 UI 展示层与审计层，不能只查业务逻辑消费点**——展示/审计也算消费，只是价值分级不同。
2. 二稿只分析工作站挂载点，经 codegraph 确认 MCPFormModal 有 **3 个调用方**（`MCPManagement`、`MCPTab`、`ItemEditor`）后补全 Agent 弹窗路径，发现 M1 丢字段问题。方法论意义：**同 Skill 审查，表单组件要先查「所有挂载点」再判字段——挂载点之间可能存在行为漂移**。

---

## 附：方法论在本仓库 Skill/MCP 两次应用的对照

| 维度 | Skill 表单 | MCP 表单 |
|------|-----------|---------|
| 参照锚点 | Agent Skills 规范 + opencode + Anthropic 仓库 | MCP 协议 + **opencode + Claude Desktop（三源）** |
| 标准必填集 | name + description + instructions | name + type + command/url |
| 对齐标准字段 | 3/9 | 5/9 |
| 最严重问题 | 描述违反标准做成选填；tool_names 前后端割裂 | **M1 Agent 弹窗路径保存丢 7 字段**；状态形态错误 |
| 状态/版本 | 自加且可疑 | 状态形态错误（应 enabled 开关）、版本弱消费 |
| 竞品反衬 | 描述必填、name 需 lowercase-hyphen | enabled 布尔开关、env 结构化、缺失 cwd/timeout/headers |
| 加分设计 | — | 类型联动条件渲染、双入口默认值一致 |

> 方法一致、锚点不同、结论各异的两次应用，验证了流程的可复用性。

---

## 附 2：修正记录（竞品分析补全 + 聚焦回归）

### A. 竞品分析补全

Skill 分析产出两份文档：代码级 `design-review-skill-form-modal-2026-08-01.md` + 真实竞品 `design-review-skill-form-competitor-analysis-2026-08-01.md`。本 MCP 文档初稿**只做了协议规范参照，漏了真实竞品对照**。经拉取 opencode MCP 配置文档补全后，结论发生三处实质变化：
1. **状态判定升级**：从「系统维护值」升为「形态错误」——竞品用 `enabled` 布尔开关，本表单用连接三态
2. **env 判定升级**：从「合理但有隐患」升为「形态错误」——竞品是结构化对象，本表单是 `\n` 文本
3. **新增缺失字段**：cwd / timeout / headers/oauth 竞品都有、本项目全无，原判定未覆盖

方法论意义：**协议规范定义「最小集」，真实竞品定义「完整集的合理形态」**——只参照规范会漏掉形态错误与字段缺失两类问题。

### B. 聚焦回归

初稿曾把分析扩散到 `MCPManagement.tsx` 的**列表表格列**设计（列合理/缺失列/工具栏）。用户指正：Skill 审查聚焦的是 `SkillFormModal` 这个**新建表单组件**，MCP 应同样聚焦 `MCPFormModal` 字段设计。已删除表格列章节，仅保留表格列作为字段消费点的证据引用。

### C. 设计合理性分析格式（D1-D9）

用户进一步指正：要的是「**设计合理性**」——每个字段为什么设计、定义是否合理、和竞品对比，而非工程实现批判。已把初稿的「逐字段判定」表（过浅）+「内容呈现批判 MC1-MC9」（跑偏到错误绑定/提交态/清空交互等实现细节）合并重构为 D1-D9 逐字段深度分析：**设计动机 → 当前设计 → 合理性判定 → 竞品对比**。

方法论意义：**字段级审查分两层，别混**——「内容设计合理性」（该字段该不该有、定义对不对、对照竞品）是产品层判断；「工程实现质量」（错误绑定、提交态、状态管理）是代码层判断。审查要明确自己答的是哪一层。

### D. 多源参照升级（opencode → 协议 + 2 客户端）

初稿参照只有「协议规范 + opencode」两个源。按用户指正（参考标准太单一无法代表行业最优），补拉 **Claude Desktop 官方配置**（MCP 生态事实标准客户端）与 **MCP stdio 传输规范**，形成「协议 + opencode + Claude Desktop」三源。

多源对照验证的核心结论：
1. **状态三态 0/3 源支持**——opencode 用 enabled 开关、Claude Desktop 无状态字段，连接态是系统探测结果
2. **env 结构化 3/3 一致**——opencode `environment:{}`、Claude Desktop `env:{}`、协议 `env:{}`，本表单 `\n` 文本孤立于所有源
3. **version/description 0/3 源**——自加字段定性更硬
4. **cwd/timeout/headers 属增强层**——opencode 有、Claude Desktop 无，定性从「竞品都有」细化为「增强字段，非必需」

方法论意义：**MCP 是多客户端生态，客户端配置字段形态（command+args+env 结构化）是跨产品共识**——用 2 个独立客户端交叉验证，比单看 opencode 更可信；协议规范定义最小集，客户端生态定义共识形态。
