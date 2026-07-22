import type { VersionEntry } from '../components/AgentStudio/workstation/types';
import type { MCPEntry } from '../components/AgentStudio/workstation/mcp/mcp.types';

export const MOCK_MCPS: MCPEntry[] = [
  { id: 'm1', name: '文件系统 MCP', description: '提供本地文件系统读写能力', type: 'stdio', status: 'connected', version: 'v2.1.0', command: 'npx @modelcontextprotocol/server-filesystem', url: '', createdAt: '2026-04-15' },
  { id: 'm2', name: 'GitHub MCP', description: '操作 GitHub 仓库、Issue、PR', type: 'sse', status: 'connected', version: 'v1.8.0', command: '', url: 'https://mcp.github.com/v1', createdAt: '2026-04-20' },
  { id: 'm3', name: '数据库 MCP', description: '通过 MCP 协议查询数据库', type: 'stdio', status: 'connected', version: 'v1.5.0', command: 'npx @modelcontextprotocol/server-postgres', url: '', createdAt: '2026-04-25' },
  { id: 'm4', name: 'Slack MCP', description: 'Slack 消息通信集成', type: 'sse', status: 'connected', version: 'v2.0.0', command: '', url: 'https://mcp.slack.com/v1', createdAt: '2026-05-01' },
  { id: 'm5', name: 'Web 搜索 MCP', description: '提供网络搜索能力', type: 'sse', status: 'connected', version: 'v1.3.0', command: '', url: 'https://mcp.search.io/v1', createdAt: '2026-05-05' },
  { id: 'm6', name: 'Redis MCP', description: 'Redis 缓存操作接口', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: 'npx @modelcontextprotocol/server-redis', url: '', createdAt: '2026-05-10' },
  { id: 'm7', name: 'Docker MCP', description: 'Docker 容器和服务管理', type: 'stdio', status: 'error', version: 'v1.1.0', command: 'npx @modelcontextprotocol/server-docker', url: '', createdAt: '2026-05-15' },
  { id: 'm8', name: 'Jira MCP', description: 'Jira 任务和项目管理', type: 'sse', status: 'disconnected', version: 'v1.0.0', command: '', url: 'https://mcp.jira.company.com/v1', createdAt: '2026-05-20' },
  { id: 'm9', name: 'Elasticsearch MCP', description: 'Elasticsearch 搜索和分析', type: 'stdio', status: 'connected', version: 'v1.2.0', command: 'npx @modelcontextprotocol/server-elasticsearch', url: '', createdAt: '2026-05-25' },
  { id: 'm10', name: '邮件发送 MCP', description: 'SMTP 邮件发送服务', type: 'sse', status: 'disconnected', version: 'v1.0.0', command: '', url: 'https://mcp.mail.company.com/v1', createdAt: '2026-06-01' },
  { id: 'm11', name: 'AI 翻译 MCP', description: '多语言翻译服务', type: 'sse', status: 'disconnected', version: 'v1.0.0', command: '', url: 'https://mcp.translate.io/v1', createdAt: '2026-06-05' },
];

export const MOCK_MCP_VERSIONS: Record<string, VersionEntry[]> = {
  m1: [
    { version: 'v2.1.0', date: '2026-06-01', author: 'admin', changes: '增加文件流式读取' },
    { version: 'v2.0.0', date: '2026-05-15', author: 'admin', changes: '支持文件写入操作' },
    { version: 'v1.0.0', date: '2026-04-15', author: 'admin', changes: '初始版本' },
  ],
  m2: [
    { version: 'v1.8.0', date: '2026-05-20', author: 'admin', changes: '增加 Issue 评论功能' },
    { version: 'v1.0.0', date: '2026-04-20', author: 'admin', changes: '初始版本' },
  ],
};
