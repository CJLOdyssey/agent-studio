import {
  Palette, Code2, Server, TestTube, Cloud, Zap,
  ClipboardList, Layers,
} from 'lucide-react';
import type { Team } from '../types/devagents';

/**
 * Default teams with sensible tool/skill assignments per role.
 * These are used as fallback when the backend API returns no agents.
 *
 * Each agent's tools/skills reflect what that role would realistically use.
 * Users can customize them in AgentConfigModal.
 */
export const INITIAL_TEAMS: Team[] = [
  {
    id: 'team-core',
    name: '核心开发团队',
    isExpanded: true,
    agents: [
      {
        id: 'pm', name: '产品经理', role: '需求分析与产品规划',
        icon: ClipboardList, color: 'text-[var(--icon-planning)]', bg: 'bg-[var(--icon-planning)]/15', border: 'border-[var(--icon-planning)]/25',
        tools: [
          { id: 'read_file', name: '读取文件', description: '读取工作区文件内容', enabled: true },
          { id: 'web_search', name: '网络搜索', description: '搜索互联网获取最新信息', enabled: true },
          { id: 'web_fetch', name: '网页抓取', description: '抓取指定 URL 的网页内容', enabled: true },
        ],
        skills: [
          { id: 'docs-gen', name: '文档生成', description: '生成 API 文档和 README', enabled: true },
          { id: 'api-design', name: 'API 设计', description: '设计 RESTful API 接口规范', enabled: true },
        ],
      },
      {
        id: 'architect', name: '架构师', role: '系统架构与技术选型',
        icon: Layers, color: 'text-[var(--icon-planning)]', bg: 'bg-[var(--icon-planning)]/15', border: 'border-[var(--icon-planning)]/25',
        tools: [
          { id: 'read_file', name: '读取文件', description: '读取工作区文件内容', enabled: true },
          { id: 'list_files', name: '列出文件', description: '列出目录中的文件列表', enabled: true },
          { id: 'search_code', name: '搜索代码', description: '在代码库中搜索符号和文本', enabled: true },
        ],
        skills: [
          { id: 'code-review', name: '代码审查', description: '审查代码质量、安全性和可维护性', enabled: true },
        ],
      },
      {
        id: 'ui', name: 'UI 设计师', role: '界面与交互设计',
        icon: Palette, color: 'text-[var(--icon-design)]', bg: 'bg-[var(--icon-design)]/15', border: 'border-[var(--icon-design)]/25',
        tools: [
          { id: 'web_search', name: '网络搜索', description: '搜索互联网获取最新信息', enabled: true },
          { id: 'web_fetch', name: '网页抓取', description: '抓取指定 URL 的网页内容', enabled: true },
        ],
        skills: [
          { id: 'ui-design', name: 'UI 设计', description: '设计用户界面和交互流程', enabled: true },
        ],
      },
      {
        id: 'frontend', name: '前端工程师', role: 'React/Vue 开发',
        icon: Code2, color: 'text-[var(--icon-dev-frontend)]', bg: 'bg-[var(--icon-dev-frontend)]/15', border: 'border-[var(--icon-dev-frontend)]/25',
        tools: [
          { id: 'read_file', name: '读取文件', description: '读取工作区文件内容', enabled: true },
          { id: 'write_file', name: '写入文件', description: '创建或修改工作区文件', enabled: true },
          { id: 'search_code', name: '搜索代码', description: '在代码库中搜索符号和文本', enabled: true },
          { id: 'run_tests', name: '运行测试', description: '执行测试套件并返回结果', enabled: true },
          { id: 'lint_check', name: '代码检查', description: '运行 Linter 检查代码质量', enabled: true },
        ],
        skills: [
          { id: 'ui-design', name: 'UI 设计', description: '设计用户界面和交互流程', enabled: true },
          { id: 'perf-optimize', name: '性能优化', description: '分析和优化系统性能瓶颈', enabled: true },
        ],
      },
      {
        id: 'backend', name: '后端工程师', role: 'API 与数据库设计',
        icon: Server, color: 'text-[var(--icon-dev-backend)]', bg: 'bg-[var(--icon-dev-backend)]/15', border: 'border-[var(--icon-dev-backend)]/25',
        tools: [
          { id: 'read_file', name: '读取文件', description: '读取工作区文件内容', enabled: true },
          { id: 'write_file', name: '写入文件', description: '创建或修改工作区文件', enabled: true },
          { id: 'search_code', name: '搜索代码', description: '在代码库中搜索符号和文本', enabled: true },
          { id: 'run_tests', name: '运行测试', description: '执行测试套件并返回结果', enabled: true },
          { id: 'run_command', name: '终端命令', description: '执行 Shell 命令并返回输出', enabled: true },
        ],
        skills: [
          { id: 'api-design', name: 'API 设计', description: '设计 RESTful API 接口规范', enabled: true },
          { id: 'db-design', name: '数据库设计', description: '设计数据库表结构和索引', enabled: true },
          { id: 'docs-gen', name: '文档生成', description: '生成 API 文档和 README', enabled: true },
        ],
      },
      {
        id: 'qa', name: '测试工程师', role: '自动化与安全测试',
        icon: TestTube, color: 'text-[var(--icon-quality)]', bg: 'bg-[var(--icon-quality)]/15', border: 'border-[var(--icon-quality)]/25',
        tools: [
          { id: 'read_file', name: '读取文件', description: '读取工作区文件内容', enabled: true },
          { id: 'search_code', name: '搜索代码', description: '在代码库中搜索符号和文本', enabled: true },
          { id: 'run_tests', name: '运行测试', description: '执行测试套件并返回结果', enabled: true },
          { id: 'lint_check', name: '代码检查', description: '运行 Linter 检查代码质量', enabled: true },
        ],
        skills: [
          { id: 'test-gen', name: '测试生成', description: '自动生成单元测试和集成测试', enabled: true },
          { id: 'security-audit', name: '安全审计', description: '检查代码安全漏洞和风险', enabled: true },
          { id: 'debug', name: '调试排错', description: '分析错误日志并定位根因', enabled: true },
        ],
      },
      {
        id: 'devops', name: 'DevOps', role: 'CI/CD 与部署运维',
        icon: Cloud, color: 'text-[var(--icon-ops)]', bg: 'bg-[var(--icon-ops)]/15', border: 'border-[var(--icon-ops)]/25',
        tools: [
          { id: 'run_command', name: '终端命令', description: '执行 Shell 命令并返回输出', enabled: true },
          { id: 'git_diff', name: 'Git 差异', description: '查看代码变更差异', enabled: true },
          { id: 'list_files', name: '列出文件', description: '列出目录中的文件列表', enabled: true },
        ],
        skills: [
          { id: 'perf-optimize', name: '性能优化', description: '分析和优化系统性能瓶颈', enabled: true },
          { id: 'debug', name: '调试排错', description: '分析错误日志并定位根因', enabled: true },
        ],
      },
      {
        id: 'fullstack', name: '全栈工程师', role: '跨领域快速开发',
        icon: Zap, color: 'text-[var(--icon-dev-fullstack)]', bg: 'bg-[var(--icon-dev-fullstack)]/15', border: 'border-[var(--icon-dev-fullstack)]/25',
        tools: [
          { id: 'read_file', name: '读取文件', description: '读取工作区文件内容', enabled: true },
          { id: 'write_file', name: '写入文件', description: '创建或修改工作区文件', enabled: true },
          { id: 'search_code', name: '搜索代码', description: '在代码库中搜索符号和文本', enabled: true },
          { id: 'run_tests', name: '运行测试', description: '执行测试套件并返回结果', enabled: true },
          { id: 'run_command', name: '终端命令', description: '执行 Shell 命令并返回输出', enabled: true },
          { id: 'web_fetch', name: '网页抓取', description: '抓取指定 URL 的网页内容', enabled: true },
        ],
        skills: [
          { id: 'code-review', name: '代码审查', description: '审查代码质量、安全性和可维护性', enabled: true },
          { id: 'refactor', name: '代码重构', description: '重构代码结构和命名', enabled: true },
          { id: 'debug', name: '调试排错', description: '分析错误日志并定位根因', enabled: true },
        ],
      },
    ],
  },
  {
    id: 'team-growth',
    name: '增长业务团队',
    isExpanded: false,
    agents: [],
  },
];
