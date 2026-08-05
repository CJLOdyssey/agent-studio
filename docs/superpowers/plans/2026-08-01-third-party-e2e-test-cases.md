# 第三方资源端到端验证测试用例

日期：2026-08-01
目标：从**用户视角**添加第三方真实资源（skill/MCP/工具/提示词/输出约束）→ 配置 agent → 对话验证**真实调用**（非幻觉）。

## 核心原则：幻觉验证

**只看文本不可信**。模型可能"声称调用了工具"但实际没调、或编造结果。每条用例必须有**独立渠道核实**：
- 工具/脚本产生了**真实文件** → 用 pandas/python 打开文件验证内容（不是模型说的）
- MCP 返回**真实数据** → 与直接跑该 MCP server 的结果比对
- HTTP 工具 → 直接 curl 该 API 比对返回
- 会话日志里必须看到**工具调用记录**（thinking/tool_call 事件），而非仅最终文本

## 环境（已验证）

- 后端 :8081 healthy，DeepSeek key 已配置（sk-c3c...）
- 官方第三方资源已就绪：
  - skill：`anthropics/skills` 官方 **xlsx**（SKILL.md + scripts/recalc.py + office/soffice.py，真实下载）
  - MCP：`@modelcontextprotocol/server-everything`（官方测试服务器，提供 echo/add/longRunningCall 等工具）
  - MCP：`@modelcontextprotocol/server-filesystem`（官方文件系统服务器）
  - 工具：HTTP endpoint 类（待找公开 API）

---

## TC-1 第三方 skill 导入与真实文件生成

| 项 | 内容 |
|---|---|
| 前置 | 无 |
| 操作 | 用户视角：技能管理页 → 导入 SKILL.md → 上传官方 xlsx 目录（SKILL.md + scripts/recalc.py + office/soffice.py） |
| 预期 | 列表出现 xlsx，含 `script_files`（scripts/recalc.py 等） |
| 对话 | 用 agent（绑定 xlsx skill + execute_python）要求："生成一个销售报表 xlsx，含 SUM 公式" |
| **真实调用验证** | ① 会话日志出现 execute_python 工具调用；② 下载生成的文件，用 `openpyxl` 打开：工作表存在、`SUM` 公式真实存在（`cell.value == '=SUM(...)'`）、数值计算正确——**全部独立于模型文本** |

## TC-2 第三方 MCP server（everything）调用

| 项 | 内容 |
|---|---|
| 前置 | 添加 MCP：type=stdio，command=`npx -y @modelcontextprotocol/server-everything`，args 空 |
| 操作 | MCP 管理页新增 → 测试按钮 → 应成功 |
| 对话 | agent（绑定该 MCP）要求："用 echo 工具回显 hello，再调 add 工具计算 2+3" |
| **真实调用验证** | ① 会话日志出现 `mcp_everything_echo` / `mcp_everything_add` 调用；② add 结果 = 5（可预测）；③ 直接跑 `npx ... echo` 比对协议响应 |

## TC-3 第三方 MCP server（filesystem）真实读写

| 项 | 内容 |
|---|---|
| 前置 | 添加 MCP：command=`npx -y @modelcontextprotocol/server-filesystem /tmp/opencode/mcp-fs`（创建目录） |
| 操作 | MCP 管理页新增 → 测试成功 |
| 对话 | agent 要求："在 /tmp/opencode/mcp-fs 下创建文件 hello.txt 内容为 test123，然后读取它" |
| **真实调用验证** | ① 会话日志出现 `mcp_fs_write_file` / `mcp_fs_read_file`；② **直接 `cat /tmp/opencode/mcp-fs/hello.txt`** == test123（文件真实存在于磁盘，非模型编造） |

## TC-4 第三方工具（HTTP）真实调用

| 项 | 内容 |
|---|---|
| 前置 | 添加工具：HTTP endpoint（如公开 API，用 wttr.in 天气或 httpbin） |
| 操作 | 工具管理页新增 endpoint + parameters → 测试按钮成功 |
| 对话 | agent 要求："查询当前天气/调用 httpbin 返回数据" |
| **真实调用验证** | ① 会话日志出现该工具调用；② 返回内容与 `curl` 直调该 API 的结果一致（同一时刻数据匹配） |

## TC-5 第三方提示词 + 输出约束生效

| 项 | 内容 |
|---|---|
| 前置 | 添加提示词（第三方来源，如官方 prompt 模板）+ 输出约束（如"只输出 JSON"） |
| 操作 | 提示词/输出约束管理页新增 |
| 对话 | agent 配置了该提示词 + 输出约束，要求完成任务 |
| **真实调用验证** | ① 会话日志/最终消息体现了提示词指导；② 输出严格遵守输出约束（如 JSON 可被 json.loads 解析，而非模型声称"我按 JSON 输出了"） |

## TC-6 全部资源组合（一个 agent 全配置）

| 项 | 内容 |
|---|---|
| 前置 | 以上 skill/MCP×2/工具/提示词/输出约束均已添加 |
| 操作 | 创建 agent，在 Agent 配置弹窗绑定全部：Skills tab 选 xlsx、MCP tab 选 everything+filesystem、工具 tab 选 HTTP 工具、提示词/输出约束 |
| 对话 | 依次触发：xlsx 生成 + MCP 调用 + HTTP 调用 |
| **真实调用验证** | 每个资源分别独立核实（TC-1~5 的方法），确认一次会话内全部真实生效 |

---

## 执行顺序

1. TC-1 skill 导入（官方 xlsx）
2. TC-2/TC-3 两个第三方 MCP
3. TC-4 HTTP 工具
4. TC-5 提示词/输出约束
5. TC-6 组合验证

每条用例：**操作 → 预期 → 真实调用核实（独立渠道）→ PASS/FAIL 记录**。任何 FAIL 需区分「本实现 bug」vs「第三方资源问题」。
