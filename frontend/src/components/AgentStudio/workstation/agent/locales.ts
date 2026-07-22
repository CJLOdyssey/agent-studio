const langs: Record<string, [zh: string, en: string]> = {
  'agent.new': ['创建 Agent', 'New Agent'],
  'agent.edit': ['编辑 Agent', 'Edit Agent'],
  'agent.copy': ['复制', 'Copy'],
  'agent.delete': ['删除', 'Delete'],
  'agent.batch_delete': ['批量删除 ({n})', 'Batch Delete ({n})'],
  'agent.history': ['版本历史', 'History'],
  'agent.test': ['测试', 'Test'],
  'agent.testing': ['测试中...', 'Testing...'],
  'agent.search_placeholder': ['搜索 Agent 名称、团队、模型...', 'Search name, team, model...'],
  'agent.col_name': ['Agent 名称', 'Name'],
  'agent.col_desc': ['描述', 'Description'],
  'agent.col_team': ['团队', 'Team'],
  'agent.col_model': ['模型', 'Model'],
  'agent.col_status': ['状态', 'Status'],
  'agent.col.version': ['版本', 'Version'],
  'agent.col_actions': ['操作', 'Actions'],
  'agent.select_all': ['全选本页', 'Select All'],
  'agent.select_item': ['选择 {name}', 'Select {name}'],
  'agent.more_actions': ['更多操作', 'More'],
  'agent.empty_title': ['暂无 Agent{extra}', 'No Agents{extra}'],
  'agent.empty_desc_search': ['尝试修改搜索关键词', 'Try different keywords'],
  'agent.empty_desc_general': ['点击「创建 Agent」创建第一个 Agent', 'Click "New Agent" to create one'],
  'agent.pagination': ['共 {n} 条', '{n} total'],
  'agent.page_prev': ['上一页', 'Previous'],
  'agent.page_next': ['下一页', 'Next'],
  'agent.page_num': ['第 {n} 页', 'Page {n}'],
  'agent.toast_created': ['Agent 已创建', 'Agent created'],
  'agent.toast_updated': ['Agent 已更新', 'Agent updated'],
  'agent.toast_deleted': ['Agent 已删除', 'Agent deleted'],
  'agent.toast_copied': ['Agent 已复制', 'Agent copied'],
  'agent.toast_batch_deleted': ['已删除 {n} 个 Agent', '{n} Agents deleted'],
  'agent.running_block_delete': ['运行中 Agent 不可删除，请先停止', 'Cannot delete running Agent'],
  'agent.running_block_batch': ['{n} 个运行中 Agent 不可删除，请先停止', '{n} running Agents cannot be deleted'],
  'agent.loading': ['加载中...', 'Loading...'],
  'agent.error_render': ['模块出错了，请刷新页面重试', 'Module error, please refresh'],
  'agent.error_retry': ['重试', 'Retry'],
  'agent.error_loading': ['加载失败', 'Load failed'],
  'agent.form_title_new': ['创建 Agent', 'New Agent'],
  'agent.form_title_edit': ['编辑 Agent', 'Edit Agent'],
  'agent.form_name': ['Agent 名称', 'Name'],
  'agent.form_name_placeholder': ['2-30 个字符', '2-30 characters'],
  'agent.form_desc': ['描述', 'Description'],
  'agent.form_team': ['团队', 'Team'],
  'agent.form_model': ['模型', 'Model'],
  'agent.form_version': ['版本', 'Version'],
  'agent.form_version_placeholder': ['v1.0.0', 'v1.0.0'],
  'agent.form_prompt': ['系统提示词', 'System Prompt'],
  'agent.form_prompt_select': ['选择提示词', 'Select Prompt'],
  'agent.form_tools': ['已选工具', 'Tools'],
  'agent.form_mcp': ['已选 MCP', 'MCP'],
  'agent.form_skills': ['已选 Skills', 'Skills'],
  'agent.form_prompt_empty': ['未选择', 'None'],
  'agent.form_tool_select': ['选择工具', 'Select Tools'],
  'agent.form_mcp_select': ['选择 MCP', 'Select MCPs'],
  'agent.form_skill_select': ['选择 Skills', 'Select Skills'],
  'agent.form_desc_placeholder': ['描述...', 'Description...'],
  'agent.form_tool_count': ['{n} 个工具', '{n} tools'],
  'agent.form_mcp_count': ['{n} 个 MCP', '{n} MCPs'],
  'agent.form_skill_count': ['{n} 个 Skills', '{n} Skills'],
  'agent.form_section_basic': ['基本信息', 'Basic Info'],
  'agent.form_section_bindings': ['资源绑定', 'Resource Bindings'],
  'agent.form_cancel': ['取消', 'Cancel'],
  'agent.form_save_edit': ['保存修改', 'Save Changes'],
  'agent.form_save_create': ['创建 Agent', 'Create Agent'],
};

let lang: 'zh' | 'en' = typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en';

export function t(key: string, ...args: string[]): string {
  const v = (langs[key] as [string, string] | undefined)?.[lang === 'zh' ? 0 : 1];
  if (!v) return key;
  if (!args.length) return v;
  let i = -1;
  return v.replace(/\{(\w+)\}/g, () => args[++i] ?? '');
}

export function setLang(l: 'zh' | 'en'): void { lang = l; }
export function getLang(): 'zh' | 'en' { return lang; }
