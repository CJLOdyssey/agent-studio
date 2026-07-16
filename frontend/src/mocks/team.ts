import type { VersionEntry } from '../components/agentstudio/workstation/types';
import type { TeamEntry } from '../components/agentstudio/workstation/team/team.types';

export const MOCK_TEAMS: TeamEntry[] = [
  { id: 't1', name: '前端开发团队', description: '负责前端架构和组件开发', status: 'active', category: 'dev', createdAt: '2026-03-10', agents: [], memberCount: 0 },
  { id: 't2', name: '后端开发团队', description: '负责后端服务设计和API开发', status: 'active', category: 'dev', createdAt: '2026-03-12', agents: [], memberCount: 0 },
  { id: 't3', name: 'AI/ML 团队', description: '负责人工智能模型训练和部署', status: 'active', category: 'dev', createdAt: '2026-03-15', agents: [], memberCount: 0 },
  { id: 't4', name: '质量保障团队', description: '负责自动化测试和质量管理', status: 'active', category: 'test', createdAt: '2026-03-18', agents: [], memberCount: 0 },
  { id: 't5', name: '运维团队', description: '负责基础设施和CI/CD流水线', status: 'inactive', category: 'ops', createdAt: '2026-03-20', agents: [], memberCount: 0 },
  { id: 't6', name: '产品设计团队', description: '负责产品方案和交互设计', status: 'active', category: 'dev', createdAt: '2026-03-22', agents: [], memberCount: 0 },
  { id: 't7', name: '数据分析团队', description: '负责数据分析和商业智能', status: 'active', category: 'dev', createdAt: '2026-03-25', agents: [], memberCount: 0 },
  { id: 't8', name: '安全审计团队', description: '负责安全审计和合规检查', status: 'inactive', category: 'ops', createdAt: '2026-04-01', agents: [], memberCount: 0 },
  { id: 't9', name: '架构委员会', description: '负责技术架构评审和标准制定', status: 'active', category: 'dev', createdAt: '2026-04-05', agents: [], memberCount: 0 },
  { id: 't10', name: 'DevOps 团队', description: '负责开发者体验和内部工具', status: 'active', category: 'ops', createdAt: '2026-04-08', agents: [], memberCount: 0 },
  { id: 't11', name: '技术写作团队', description: '负责技术文档和知识库管理', status: 'active', category: 'dev', createdAt: '2026-04-10', agents: [], memberCount: 0 },
];

export const MOCK_TEAM_VERSIONS: Record<string, VersionEntry[]> = {
  t1: [
    { version: 'v2.0.0', date: '2026-06-01', author: 'admin', changes: '团队重组，新增3名成员' },
    { version: 'v1.0.0', date: '2026-03-10', author: 'admin', changes: '初始创建' },
  ],
  t2: [
    { version: 'v1.5.0', date: '2026-05-15', author: 'admin', changes: '拆分微服务小组' },
    { version: 'v1.0.0', date: '2026-03-12', author: 'admin', changes: '初始创建' },
  ],
};
