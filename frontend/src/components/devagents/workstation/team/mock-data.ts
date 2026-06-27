import type { VersionEntry } from '../types';
import type { TeamEntry } from './team.types';

export const MOCK_TEAMS: TeamEntry[] = [
  { id: 't1', name: '前端开发团队', description: '负责前端架构和组件开发', leader: '张三', memberCount: 8, status: 'active', createdAt: '2026-03-10' },
  { id: 't2', name: '后端开发团队', description: '负责后端服务设计和API开发', leader: '李四', memberCount: 10, status: 'active', createdAt: '2026-03-12' },
  { id: 't3', name: 'AI/ML 团队', description: '负责人工智能模型训练和部署', leader: '王五', memberCount: 6, status: 'active', createdAt: '2026-03-15' },
  { id: 't4', name: '质量保障团队', description: '负责自动化测试和质量管理', leader: '赵六', memberCount: 5, status: 'active', createdAt: '2026-03-18' },
  { id: 't5', name: '运维团队', description: '负责基础设施和CI/CD流水线', leader: '钱七', memberCount: 4, status: 'inactive', createdAt: '2026-03-20' },
  { id: 't6', name: '产品设计团队', description: '负责产品方案和交互设计', leader: '孙八', memberCount: 7, status: 'active', createdAt: '2026-03-22' },
  { id: 't7', name: '数据分析团队', description: '负责数据分析和商业智能', leader: '周九', memberCount: 3, status: 'active', createdAt: '2026-03-25' },
  { id: 't8', name: '安全审计团队', description: '负责安全审计和合规检查', leader: '吴十', memberCount: 3, status: 'inactive', createdAt: '2026-04-01' },
  { id: 't9', name: '架构委员会', description: '负责技术架构评审和标准制定', leader: '郑一', memberCount: 5, status: 'active', createdAt: '2026-04-05' },
  { id: 't10', name: 'DevOps 团队', description: '负责开发者体验和内部工具', leader: '陈二', memberCount: 6, status: 'active', createdAt: '2026-04-08' },
  { id: 't11', name: '技术写作团队', description: '负责技术文档和知识库管理', leader: '林三', memberCount: 4, status: 'active', createdAt: '2026-04-10' },
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
