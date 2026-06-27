import type { VersionEntry } from '../types';
import type { PromptEntry } from './types';

export const MOCK_PROMPTS: PromptEntry[] = [
  { id: 'p1', name: '代码审查助手', content: '你是一个资深代码审查专家，负责检查代码质量、安全性和性能问题。请从以下几个方面进行审查：代码规范、潜在缺陷、安全漏洞、性能优化建议。', category: '系统提示词', model: 'Claude Sonnet 4', status: 'active', version: 'v3.2.0', createdAt: '2026-05-10' },
  { id: 'p2', name: '需求分析模板', content: '请分析以下需求，输出：1. 核心功能列表 2. 技术可行性评估 3. 工作量估算 4. 潜在风险', category: '任务模板', model: 'GPT-4o', status: 'active', version: 'v2.1.0', createdAt: '2026-05-15' },
  { id: 'p3', name: 'Bug 复现指令', content: '请根据以下错误描述，生成最小复现步骤。包括：环境配置、触发条件、预期行为、实际行为。', category: '用户提示词', model: 'DeepSeek V3', status: 'active', version: 'v1.5.0', createdAt: '2026-05-20' },
  { id: 'p4', name: '架构评审专家', content: '你是一个系统架构师，请从可扩展性、可维护性、性能、安全性四个维度评审以下架构方案。', category: '系统提示词', model: 'Claude Opus 4', status: 'active', version: 'v2.0.0', createdAt: '2026-05-25' },
  { id: 'p5', name: '单元测试生成', content: '请为以下代码生成单元测试，覆盖正常路径、边界条件和异常场景。使用 Jest 测试框架。', category: '任务模板', model: 'Gemini 2.5 Pro', status: 'draft', version: 'v1.0.0', createdAt: '2026-06-01' },
  { id: 'p6', name: 'API 文档生成', content: '根据以下代码注释和接口定义，生成规范的 API 文档，包含请求参数、响应格式、错误码说明。', category: '任务模板', model: 'Qwen Max', status: 'active', version: 'v1.2.0', createdAt: '2026-06-03' },
  { id: 'p7', name: '数据库设计助手', content: '你是一个数据库专家，请根据以下业务需求设计数据库 schema，包含表结构、索引策略和查询优化建议。', category: '系统提示词', model: 'Claude Sonnet 4', status: 'archived', version: 'v1.0.0', createdAt: '2026-06-05' },
  { id: 'p8', name: '用户体验评估', content: '请从用户体验角度评估以下设计方案，关注：信息架构、交互流程、视觉一致性、可访问性。', category: '用户提示词', model: 'Claude Opus 4', status: 'active', version: 'v2.3.0', createdAt: '2026-06-08' },
  { id: 'p9', name: '性能优化指南', content: '分析以下性能问题，提供优化方案。包括：瓶颈定位、优化策略、预期效果、实施步骤。', category: '系统提示词', model: 'GPT-4o', status: 'draft', version: 'v1.0.0', createdAt: '2026-06-10' },
  { id: 'p10', name: '安全审计脚本', content: '你是一个安全审计专家，请对以下系统进行安全审计，重点关注：认证授权、数据加密、输入验证、会话管理。', category: '系统提示词', model: 'DeepSeek V3', status: 'active', version: 'v1.1.0', createdAt: '2026-06-12' },
  { id: 'p11', name: '部署检查清单', content: '请根据以下部署计划生成检查清单，包含：前置条件、部署步骤、回滚方案、监控验证。', category: '任务模板', model: 'Gemini 2.5 Pro', status: 'active', version: 'v1.3.0', createdAt: '2026-06-15' },
];

export const MOCK_PROMPT_VERSIONS: Record<string, VersionEntry[]> = {
  p1: [
    { version: 'v3.2.0', date: '2026-06-10', author: 'admin', changes: '增加安全审查维度', content: '你是一个资深代码审查专家，负责检查代码质量、安全性和性能问题。请从以下几个方面进行审查：代码规范、潜在缺陷、安全漏洞、性能优化建议。' },
    { version: 'v3.1.0', date: '2026-05-25', author: 'admin', changes: '优化代码审查流程', content: '你是一个资深代码审查专家，负责检查代码质量和安全性。请从代码规范、潜在缺陷和安全漏洞方面进行审查。' },
    { version: 'v1.0.0', date: '2026-05-10', author: 'admin', changes: '初始创建', content: '你是一个代码审查专家，请审查以下代码。' },
  ],
  p2: [
    { version: 'v2.1.0', date: '2026-06-01', author: 'dev', changes: '增加技术可行性评估', content: '请分析以下需求，输出：1. 核心功能列表 2. 技术可行性评估 3. 工作量估算 4. 潜在风险' },
    { version: 'v1.0.0', date: '2026-05-15', author: 'admin', changes: '初始创建', content: '请分析以下需求，输出核心功能列表和潜在风险。' },
  ],
};
