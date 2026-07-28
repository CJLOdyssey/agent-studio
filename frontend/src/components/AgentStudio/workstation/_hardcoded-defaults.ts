/**
 * ============================================================
 * 前端硬编码默认值 — 集中登记
 *
 * 以下所有值均为前端占位数据，后端 API 尚未提供对应接口。
 * 后续对接真实 API 后，应逐步替换为从接口获取的动态数据。
 * ============================================================
 *
 * 使用规范：
 * - 新建模块时，在此文件登记所有硬编码值
 * - 对接 API 后，删除对应条目并改为 API 调用
 * - 不要直接修改此文件中的值作为业务逻辑变更
 */

// ── 工具管理 ──────────────────────────────────────────────
// 所在文件: tool/tool.constants.ts
// TODO: 从 GET /api/tools/categories 获取
export const HARDCODED_TOOL_CATEGORIES = ['内置工具', '自定义工具'] as const;

// ── Skills 管理 ───────────────────────────────────────────
// 所在文件: skill/skill.constants.ts
// TODO: 从 GET /api/skills/categories 获取
export const HARDCODED_SKILL_CATEGORIES = [
  '前端开发', '后端开发', 'AI/ML', 'DevOps', '数据分析',
] as const;

// ── 提示词管理 ────────────────────────────────────────────
// 所在文件: prompt/constants.ts
// TODO: 从 GET /api/prompts/categories 获取
export const HARDCODED_PROMPT_CATEGORIES = [
  '系统提示词', '用户提示词', '任务模板', '角色定义',
] as const;

// ── 输出约束 ──────────────────────────────────────────────
// 所在文件: output/output.constants.ts
// TODO: 从 GET /api/output-constraints/categories 获取
export const HARDCODED_OUTPUT_CATEGORIES = [
  '格式约束', '内容约束', '语言约束', '长度约束',
] as const;

// ── MCP 管理 ──────────────────────────────────────────────
// 所在文件: mcp/mcp.constants.ts
// TODO: 从 GET /api/mcps/types 获取
export const HARDCODED_MCP_TYPES = ['stdio', 'sse'] as const;

// ── 模型列表 ──────────────────────────────────────────────
// 所在文件: constants.ts → useModelOptions()
// 优先从 API 获取，无结果时回落至此列表
// TODO: 确保 GET /api/models 覆盖所有可用模型
export const HARDCODED_MODEL_OPTIONS = [
  'GPT-4o', 'Claude Opus 4', 'Claude Sonnet 4',
  'Gemini 2.5 Pro', 'DeepSeek V3', 'Qwen Max',
] as const;

// ── 状态值汇总 ────────────────────────────────────────────
// 各模块的状态值已在各自 constants 文件中定义，
// 后端尚未提供统一的状态字典接口，当前均为前端写死。
// 涉及模块: team, tool, skill, prompt, output, mcp, agent
