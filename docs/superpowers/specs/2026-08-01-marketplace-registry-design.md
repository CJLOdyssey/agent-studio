# 技能/MCP 市场与注册表设计 — 一键发现与安装

日期：2026-08-01
状态：草稿（待确认）

## 背景

当前 AgentStudio 的 skill / MCP / 工具获取方式是**手动配置**：
- skill：用户上传/粘贴 SKILL.md（已支持），或手填表单
- MCP：用户手填 type/command/url/args/env
- 工具：用户手填 endpoint/parameters

行业主流（GitHub 生态实测）是**注册表/市场**形态——用户点一下或敲一条命令就装好、自动配置：
- MCP 市场/注册表：`mcpMarketplace`、`mcp-marketplace`、`mcpreg`、`atlarix-mcps`（网页浏览 + `npx`/`installUrl`/CLI 一键装）
- 跨平台包管理器：`skillet`（一条命令装 SKILL.md 到 Claude Code/Cursor/Codex）
- 应用内插件市场：`taocode-plugins`（`/plugins` 一键安装）
- 按需发现：`agent-discover`（发现→安装→激活 MCP 工具）

本设计把 AgentStudio 升级为「注册表/市场」形态：内置一个可浏览、可一键安装的目录，
支持从远程注册表拉取 skill（SKILL.md 目录）、MCP 服务器配置、工具定义。

## 核心概念

**三个可复用抽象**（对齐现有 skill/MCP/tool 三种资源，共用一套市场机制）：

1. **Registry**（注册表）：一个数据源，提供「可安装项列表」。
   - 内置注册表：项目自带的 curated 列表（内置 skill/MCP/工具）
   - 远程注册表：GitHub 仓库（如 `anthropics/skills`、MCP server 列表）或 JSON 索引 URL
2. **MarketplaceItem**（市场项）：注册表里的一项，统一描述：
   - `id`：唯一标识（如 `anthropics/skills/xlsx`、`mcp/servers/brave-search`）
   - `kind`：`skill` | `mcp` | `tool`
   - `name`、`description`、`version`、`author`、`category`
   - `source`：获取方式（见下）
3. **Installer**（安装器）：把市场项转成现有资源。
   - skill → 走现有 `POST /api/skills/import`（multipart 目录导入，已实现）
   - mcp → 解析配置 → `POST /api/mcps`（填 type/command/args/env，已支持）
   - tool → `POST /api/tools`

## 数据流

```
前端市场页 (Marketplace)
  │  GET /api/marketplace/items            ← 聚合内置 + 远程注册表
  ▼
后端 RegistryService
  ├─ 内置注册表（静态常量）
  └─ 远程注册表适配器
       ├─ GitHub 仓库适配器（读仓库目录，支持 anthropics/skills 风格：SKILL.md + scripts）
       └─ JSON 索引适配器（读远程 index.json：mcpMarketplace / atlarix 风格）
  │
  ├─ POST /api/marketplace/install        ← 一键安装
  │    { kind, source, ... }
  │    安装器 → 拉取 → 调现有资源创建 API
  ▼
现有资源（skills / mcps / tools）

前端
  ├─ Marketplace 页面/抽屉（浏览、搜索、分类、安装按钮）
  └─ 安装成功 → 跳转对应管理页 / 直接可用
```

## 组件设计

### 1. 注册表模型（backend/src/marketplace/）

**`registry.py`** — 注册表抽象
```python
class MarketplaceItem(BaseModel):
    id: str
    kind: Literal["skill", "mcp", "tool"]
    name: str
    description: str = ""
    version: str = "v1.0.0"
    author: str = ""
    category: str = ""
    source: str          # 获取方式描述，如 "anthropics/skills/xlsx"
    install_url: str = ""  # 远程拉取地址（GitHub raw / JSON）
    metadata: dict = {}

class RegistryProvider(Protocol):
    async def list_items(self) -> list[MarketplaceItem]: ...
    async def fetch(self, item: MarketplaceItem) -> dict:
        """返回安装所需的数据：
        skill → { "markdown_files": {"SKILL.md": str, "scripts/x.py": str} }
        mcp   → { "type", "command", "args", "env", "url" }
        tool  → { "name", "description", "endpoint", "parameters" }
        """
```

**`providers.py`** — 三个内置 Provider：
- `BuiltinProvider`：静态列表（curated 内置项）
- `GithubSkillsProvider`：GitHub 仓库（`anthropics/skills` 风格，目录 = 一个 skill，`SKILL.md` + `scripts/`）
- `JsonIndexProvider`：远程 `index.json`（`mcpMarketplace`/`atlarix-mcps` 风格，含 installUrl）

**`service.py`** — RegistryService
- `list_items()`：聚合所有 provider 的项
- `install(item)`：调 provider.fetch → 转调现有资源 API（skills/mcps/tools 的 repository 函数）

### 2. 后端 API（backend/src/routers/marketplace.py）

```
GET  /api/marketplace/items                # 浏览（kind/category/search 过滤，可选分页）
POST /api/marketplace/install              # 一键安装 { item_id }
     → 200 { resource_id, kind, name }    # 或 409 已存在
GET  /api/marketplace/registry             # 列出已注册的远程注册表
POST /api/marketplace/registry             # 添加远程注册表 { provider, url }
DELETE /api/marketplace/registry/{id}      # 移除
```

### 3. 前端市场 UI（frontend/src/components/AgentStudio/workstation/marketplace/）

- **Marketplace 页**（新 tab「市场」或抽屉）：
  - 分类 tab：Skills / MCP / 工具
  - 搜索框 + 分类过滤
  - 卡片列表：name、description、author、版本、**安装**按钮
  - 安装中 loading → 成功 toast → 跳转对应管理页；已安装标记（对比现有资源列表）
- **远程注册表管理**：添加/移除注册表（URL 输入）

### 4. 一键安装的复用

安装 skill 直接复用现有 `POST /api/skills/import` 的 multipart 逻辑（把 provider.fetch 的
`markdown_files` dict 转成 multipart files）；安装 MCP 复用 `create_mcp`；安装工具复用 `create_tool`。
不重造解析逻辑——注册表层只负责「取数据」，落库走现有代码。

## 错误处理

- 远程拉取失败（网络/仓库不存在）→ 安装接口返回明确错误，前端 toast「拉取失败: <原因>」
- 已存在同名资源 → 409「已存在」，前端提示可跳过或用现有项
- 安装一半失败 → 幂等：先校验/预拉取，再落库；失败回滚（删除已建资源或仅报告）

## 测试

后端：
- `test_marketplace.py`：
  - BuiltinProvider 返回项列表
  - JsonIndexProvider 解析远程 index.json（mock 响应）
  - GithubSkillsProvider 拉取 SKILL.md 目录（mock）
  - install(skill) → 落到 skills 表（复用 import 逻辑，断言 script_files 入库）
  - install(mcp) → 落到 mcps 表（含 args/env）
  - install(tool) → 落到 tools 表
  - 已存在 → 409

前端：
- 市场页浏览/搜索/分类
- 安装按钮 → 调用 /install → 成功跳转

手动：
- 真实添加 `anthropics/skills` 远程注册表 → 浏览 xlsx 技能 → 一键安装 → 出现在技能管理页 → 绑定 agent 可用

## 范围外（不做）

- 不实现跨平台安装（skillet 那种装到 Claude Code/Cursor 的 CLI）——AgentStudio 只管理自己的资源
- 不做发布/上传到市场（本次只做「消费方」：浏览 + 安装）
- 不做评分/评论/下载量统计
- 不做自动更新（版本检测可后置）

## 与现有工作的关系

- skill 的 multipart 导入（本次已实现）是注册表 install 的基础设施，直接复用
- MCP 的 args/env（本次已实现）是 MCP 市场项的标准字段，直接复用
- 死字段清理（本次已做）保证 market item 的 schema 干净

## 后续可扩展

- 一键更新（检测新版本）
- 本地发布（把用户自建 skill 打包成可分享项）
- 更多 Provider（npm/pypi 上的 skill 包）
