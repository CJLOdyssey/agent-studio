import type { VersionEntry } from '../components/agentstudio/workstation/types';
import type { ToolEntry } from '../components/agentstudio/workstation/tool/tool.types';

const PARAMS = '{"type":"object","properties":{}}';

export const MOCK_TOOLS: ToolEntry[] = [
  { id: 't1', name: '代码搜索工具', description: '支持全文搜索和正则匹配的代码搜索功能', category: '内置工具', model: '内置', status: 'active', version: 'v2.3.0', endpoint: '', parameters: PARAMS, createdAt: '2026-04-20' },
  { id: 't2', name: '文件操作工具', description: '支持文件的创建、读取、编辑、删除等操作', category: '内置工具', model: '内置', status: 'active', version: 'v1.8.0', endpoint: '', parameters: PARAMS, createdAt: '2026-04-22' },
  { id: 't3', name: 'Git 操作工具', description: '提供 Git 版本控制的常用操作接口', category: '内置工具', model: '内置', status: 'active', version: 'v2.0.0', endpoint: '', parameters: PARAMS, createdAt: '2026-04-25' },
  { id: 't4', name: 'Jira 集成工具', description: '连接 Jira 进行任务和问题的增删改查', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.5.0', endpoint: 'https://jira.company.com/api/v2', parameters: PARAMS, createdAt: '2026-05-10' },
  { id: 't5', name: 'Slack 通知工具', description: '向指定 Slack 频道发送消息通知', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.2.0', endpoint: 'https://slack.com/api/chat.postMessage', parameters: PARAMS, createdAt: '2026-05-15' },
  { id: 't6', name: '数据库查询工具', description: '通过 SQL 查询数据库并返回结果', category: '内置工具', model: '内置', status: 'active', version: 'v2.1.0', endpoint: '', parameters: PARAMS, createdAt: '2026-04-28' },
  { id: 't7', name: 'Web 搜索工具', description: '通过搜索引擎获取网络信息', category: '内置工具', model: '内置', status: 'active', version: 'v1.9.0', endpoint: '', parameters: PARAMS, createdAt: '2026-05-01' },
  { id: 't8', name: 'Docker 管理工具', description: '管理 Docker 容器、镜像和服务的生命周期', category: '自定义工具', model: 'Claude Sonnet 4', status: 'disabled', version: 'v1.0.0', endpoint: 'unix:///var/run/docker.sock', parameters: PARAMS, createdAt: '2026-06-01' },
  { id: 't9', name: 'GitHub API 工具', description: '封装 GitHub REST API，支持仓库、Issue、PR 操作', category: '自定义工具', model: 'DeepSeek V3', status: 'active', version: 'v2.2.0', endpoint: 'https://api.github.com', parameters: PARAMS, createdAt: '2026-05-20' },
];

export const MOCK_TOOL_VERSIONS: Record<string, VersionEntry[]> = {
  t1: [
    { version: 'v2.3.0', date: '2026-06-10', author: 'admin', changes: '新增正则匹配模式' },
    { version: 'v2.2.0', date: '2026-05-20', author: 'admin', changes: '优化搜索结果排序' },
    { version: 'v1.0.0', date: '2026-04-20', author: 'admin', changes: '初始创建' },
  ],
  t4: [
    { version: 'v1.5.0', date: '2026-06-01', author: 'dev', changes: '支持自定义字段映射' },
    { version: 'v1.0.0', date: '2026-05-10', author: 'admin', changes: '初始创建' },
  ],
};
