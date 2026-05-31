import {
  Palette, Code2, Server, TestTube, Cloud, Zap,
  ClipboardList, Layers
} from 'lucide-react';
import type { Team } from '../types/devagents';

export const INITIAL_TEAMS: Team[] = [
  {
    id: 'team-core',
    name: '核心开发团队',
    isExpanded: false,
    agents: [
      { id: 'pm', name: '产品经理', role: '需求分析与产品规划', icon: ClipboardList, color: 'text-[var(--icon-planning)]', bg: 'bg-[var(--icon-planning)]/15', border: 'border-[var(--icon-planning)]/25' },
      { id: 'architect', name: '架构师', role: '系统架构与技术选型', icon: Layers, color: 'text-[var(--icon-planning)]', bg: 'bg-[var(--icon-planning)]/15', border: 'border-[var(--icon-planning)]/25' },
      { id: 'ui', name: 'UI 设计师', role: '界面与交互设计', icon: Palette, color: 'text-[var(--icon-design)]', bg: 'bg-[var(--icon-design)]/15', border: 'border-[var(--icon-design)]/25' },
      { id: 'frontend', name: '前端工程师', role: 'React/Vue 开发', icon: Code2, color: 'text-[var(--icon-dev-frontend)]', bg: 'bg-[var(--icon-dev-frontend)]/15', border: 'border-[var(--icon-dev-frontend)]/25' },
      { id: 'backend', name: '后端工程师', role: 'API 与数据库设计', icon: Server, color: 'text-[var(--icon-dev-backend)]', bg: 'bg-[var(--icon-dev-backend)]/15', border: 'border-[var(--icon-dev-backend)]/25' },
      { id: 'qa', name: '测试工程师', role: '自动化与安全测试', icon: TestTube, color: 'text-[var(--icon-quality)]', bg: 'bg-[var(--icon-quality)]/15', border: 'border-[var(--icon-quality)]/25' },
      { id: 'devops', name: 'DevOps', role: 'CI/CD 与部署运维', icon: Cloud, color: 'text-[var(--icon-ops)]', bg: 'bg-[var(--icon-ops)]/15', border: 'border-[var(--icon-ops)]/25' },
      { id: 'fullstack', name: '全栈工程师', role: '跨领域快速开发', icon: Zap, color: 'text-[var(--icon-dev-fullstack)]', bg: 'bg-[var(--icon-dev-fullstack)]/15', border: 'border-[var(--icon-dev-fullstack)]/25' },
    ]
  },
  {
    id: 'team-growth',
    name: '增长业务团队',
    isExpanded: false,
    agents: []
  }
];
