import type { OutputEntry } from './output.types';

export const MOCK_OUTPUTS: OutputEntry[] = [
  { id: 'o1', name: '中文输出', content: '回复必须使用中文', category: '语言约束', model: '全部模型', status: 'active', version: 'v1.0.0', createdAt: '2026-05-10' },
  { id: 'o2', name: 'Markdown 格式', content: '使用 Markdown 格式化输出，代码块必须包含语言标识', category: '格式约束', model: '全部模型', status: 'active', version: 'v1.1.0', createdAt: '2026-05-12' },
  { id: 'o3', name: '简洁回复', content: '每次回复不超过 300 字，避免冗长', category: '长度约束', model: '全部模型', status: 'active', version: 'v1.0.0', createdAt: '2026-05-15' },
  { id: 'o4', name: 'JSON 格式', content: '必须以 JSON 格式输出，包含 code 和 message 字段', category: '格式约束', model: 'DeepSeek V3', status: 'active', version: 'v2.0.0', createdAt: '2026-05-20' },
  { id: 'o5', name: '代码规范', content: '代码必须通过 ESLint 检查，遵循项目代码规范', category: '内容约束', model: '全部模型', status: 'draft', version: 'v1.0.0', createdAt: '2026-06-01' },
  { id: 'o6', name: '安全约束', content: '禁止输出敏感信息如 API Key、密码等', category: '内容约束', model: '全部模型', status: 'active', version: 'v1.2.0', createdAt: '2026-06-05' },
];
