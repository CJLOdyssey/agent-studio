export interface LogEntry { id: string; timestamp: string; level: 'info' | 'warn' | 'error'; module: string; user: string; action: string; details: string; ip: string; }

function generateMockLogs(): LogEntry[] {
  const logs: LogEntry[] = [];
  const actions = ['创建', '更新', '删除', '启用了', '禁用了', '配置了', '查看了', '导入了', '导出了', '备份了'];
  const users = ['admin', 'dev', 'ops', '张三', '李四', '王五', 'system'];
  const modules = ['agent', 'prompt', 'tool', 'mcp', 'skill', 'team', 'system'];
  const targets = ['前端开发 Agent', '代码审查助手', 'GitHub API 工具', 'Redis MCP', 'TypeScript 类型系统', '前端开发团队', '系统配置'];

  for (let i = 0; i < 87; i++) {
    const d = new Date('2026-06-20');
    d.setHours(0, 0, 0, 0);
    d.setSeconds(d.getSeconds() - i * 347);
    const level = (['info', 'info', 'info', 'info', 'warn', 'warn', 'error'] as const)[i % 7];
    logs.push({
      id: `log-${i}`, timestamp: d.toISOString().replace('T', ' ').slice(0, 19), level,
      module: modules[i % modules.length], user: users[i % users.length],
      action: `${actions[i % actions.length]}了`, details: `对 ${targets[i % targets.length]} 执行了 ${actions[i % actions.length]} 操作`, ip: `192.168.1.${(i % 254) + 1}`,
    });
  }
  return logs;
}

export const MOCK_LOGS = generateMockLogs();
