import type { VersionEntry } from '../components/AgentStudio/workstation/types';
import type { AgentEntry } from '../components/AgentStudio/workstation/agent/agent.types';

export const MOCK_AGENTS: AgentEntry[] = [
  { id: '1', name: '前端开发 Agent', description: '负责前端项目的开发与维护', team: '前端团队', teams: ['前端开发团队'], model: 'Claude Sonnet 4', status: 'running', version: 'v2.1.0', systemPromptId: 'agent-prompt-1', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-10' },
  { id: '2', name: '后端开发 Agent', description: '负责后端服务的 API 开发', team: '后端团队', teams: ['后端开发团队'], model: 'GPT-4o', status: 'running', version: 'v1.8.3', systemPromptId: 'agent-prompt-2', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-12' },
  { id: '3', name: 'UI/UX 设计 Agent', description: '负责产品界面与交互设计', team: '前端团队', teams: [], model: 'Claude Opus 4', status: 'stopped', version: 'v3.0.1', systemPromptId: 'agent-prompt-3', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-06-01' },
  { id: '4', name: '测试 Agent', description: '负责自动化测试与质量保障', team: '质量团队', teams: ['质量保障团队'], model: 'Gemini 2.5 Pro', status: 'running', version: 'v1.5.0', systemPromptId: 'agent-prompt-4', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-20' },
  { id: '5', name: '架构师 Agent', description: '负责系统架构设计与技术选型', team: '全栈团队', teams: ['架构委员会'], model: 'Claude Opus 4', status: 'error', version: 'v2.0.0', systemPromptId: 'agent-prompt-5', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-06-05' },
  { id: '6', name: 'DevOps Agent', description: '负责 CI/CD 与运维自动化', team: '运维团队', teams: [], model: 'DeepSeek V3', status: 'running', version: 'v1.2.0', systemPromptId: 'agent-prompt-6', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-28' },
  { id: '7', name: '产品助理 Agent', description: '负责需求分析与产品文档', team: '产品团队', teams: ['产品设计团队'], model: 'Qwen Max', status: 'stopped', version: 'v1.0.0', systemPromptId: 'agent-prompt-7', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-06-08' },
  { id: '8', name: '全栈开发 Agent', description: '负责全栈项目的端到端开发', team: '全栈团队', teams: [], model: 'Claude Sonnet 4', status: 'running', version: 'v2.3.0', systemPromptId: 'agent-prompt-8', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-15' },
  { id: '9', name: '数据分析 Agent', description: '负责数据挖掘与分析报告', team: '产品团队', teams: ['数据分析团队'], model: 'GPT-4o', status: 'running', version: 'v1.1.0', systemPromptId: 'agent-prompt-9', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-06-12' },
  { id: '10', name: '安全审计 Agent', description: '负责系统安全审查与漏洞扫描', team: '运维团队', teams: ['安全审计团队'], model: 'Claude Opus 4', status: 'error', version: 'v1.0.0', systemPromptId: 'agent-prompt-10', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-06-15' },
  { id: '11', name: 'API网关 Agent', description: '负责 API 网关的配置与监控', team: '后端团队', teams: [], model: 'DeepSeek V3', status: 'running', version: 'v1.3.0', systemPromptId: 'agent-prompt-11', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-06-18' },
];

export const MOCK_VERSIONS: Record<string, VersionEntry[]> = {
  '1': [
    { version: 'v2.1.0', date: '2026-06-10', author: 'admin', changes: '优化代码生成逻辑' },
    { version: 'v2.0.0', date: '2026-05-20', author: 'admin', changes: '升级模型至 Claude Sonnet 4' },
    { version: 'v1.0.0', date: '2026-05-10', author: 'admin', changes: '初始创建' },
  ],
  '2': [
    { version: 'v1.8.3', date: '2026-06-08', author: 'dev', changes: '修复API调用问题' },
    { version: 'v1.8.0', date: '2026-06-01', author: 'admin', changes: '重构核心逻辑' },
    { version: 'v1.0.0', date: '2026-05-12', author: 'admin', changes: '初始创建' },
  ],
};

export const MOCK_AGENT_PROMPTS: { id: string; name: string }[] = [
  { id: 'agent-prompt-1', name: '前端开发工程师' },
  { id: 'agent-prompt-2', name: '后端开发工程师' },
  { id: 'agent-prompt-3', name: 'UI/UX 设计专家' },
];

/** Self-contained reference fallback — no cross-module imports needed. */
export const MOCK_AGENT_TOOLS: { id: string; name: string }[] = [
  { id: 'tool-1', name: 'FileSystem' },
  { id: 'tool-2', name: 'WebSearch' },
  { id: 'tool-3', name: 'Git' },
];
export const MOCK_AGENT_MCPS: { id: string; name: string }[] = [
  { id: 'mcp-1', name: 'Database MCP' },
  { id: 'mcp-2', name: 'Analytics MCP' },
];
export const MOCK_AGENT_SKILLS: { id: string; name: string }[] = [
  { id: 'skill-1', name: '前端开发' },
  { id: 'skill-2', name: '后端开发' },
  { id: 'skill-3', name: '代码审查' },
];
