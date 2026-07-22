import type { VersionEntry } from '../components/AgentStudio/workstation/types';
import type { SkillEntry } from '../components/AgentStudio/workstation/skill/skill.types';

export const MOCK_SKILLS: SkillEntry[] = [
  { id: 's1', name: 'React 组件开发', description: '提供 React 组件开发的最佳实践和代码生成能力', category: '前端开发', status: 'installed', version: 'v3.1.0', author: 'admin', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-04-10' },
  { id: 's2', name: 'Python 后端开发', description: 'Python/Flask 后端服务开发技能包', category: '后端开发', status: 'installed', version: 'v2.5.0', author: 'admin', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-04-12' },
  { id: 's3', name: 'Docker 容器管理', description: 'Docker 容器化部署和编排能力', category: 'DevOps', status: 'installed', version: 'v1.8.0', author: 'admin', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-04-15' },
  { id: 's4', name: 'SQL 优化分析', description: 'SQL 查询优化和数据库性能分析', category: '数据分析', status: 'installed', version: 'v2.0.0', author: 'dev', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-04-18' },
  { id: 's5', name: 'TypeScript 类型系统', description: 'TypeScript 进阶类型编程和工具函数', category: '前端开发', status: 'installed', version: 'v1.5.0', author: 'admin', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-04-20' },
  { id: 's6', name: 'API 设计规范', description: 'RESTful/GraphQL API 设计最佳实践', category: '后端开发', status: 'installed', version: 'v1.3.0', author: 'admin', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-04-22' },
  { id: 's7', name: '机器学习流水线', description: 'ML 模型训练和部署流水线管理', category: 'AI/ML', status: 'available', version: 'v1.0.0', author: '社区', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-05-01' },
  { id: 's8', name: 'CI/CD 流水线', description: '持续集成/持续部署流水线配置', category: 'DevOps', status: 'installed', version: 'v2.1.0', author: 'admin', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-04-25' },
  { id: 's9', name: 'Vue 3 组件库', description: 'Vue 3 Composition API 组件开发', category: '前端开发', status: 'available', version: 'v1.0.0', author: '社区', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-05-05' },
  { id: 's10', name: '数据可视化', description: 'ECharts/D3.js 数据可视化图表生成', category: '数据分析', status: 'installed', version: 'v1.2.0', author: 'dev', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-04-28' },
  { id: 's11', name: '安全扫描工具包', description: '代码安全审计和漏洞扫描能力', category: 'DevOps', status: 'available', version: 'v1.0.0', author: '社区', instructions: '', prompt_id: '', tool_names: [], output_constraint: '', createdAt: '2026-05-10' },
];

export const MOCK_SKILL_VERSIONS: Record<string, VersionEntry[]> = {
  s1: [
    { version: 'v3.1.0', date: '2026-06-01', author: 'admin', changes: '支持 React 19 新特性' },
    { version: 'v3.0.0', date: '2026-05-10', author: 'admin', changes: '重构为 Composition API 风格' },
    { version: 'v1.0.0', date: '2026-04-10', author: 'admin', changes: '初始创建' },
  ],
  s8: [
    { version: 'v2.1.0', date: '2026-05-20', author: 'admin', changes: '增加 GitHub Actions 支持' },
    { version: 'v1.0.0', date: '2026-04-25', author: 'admin', changes: '初始版本' },
  ],
};
