const langs: Record<string, [zh: string, en: string]> = {
  'team.new': ['新建团队', 'New Team'],
  'team.edit': ['编辑团队', 'Edit Team'],
  'team.copy': ['复制', 'Copy'],
  'team.delete': ['删除', 'Delete'],
  'team.batch_delete': ['批量删除 ({n})', 'Batch Delete ({n})'],
  'team.history': ['版本历史', 'History'],
  'team.search_placeholder': ['搜索团队名称、描述...', 'Search name, description...'],
  'team.all_status': ['全部状态', 'All Status'],
  'team.status_active': ['活跃', 'Active'],
  'team.status_inactive': ['停用', 'Inactive'],
  'team.col_name': ['团队名称', 'Name'],
  'team.col_leader': ['负责人', 'Leader'],
  'team.col_status': ['状态', 'Status'],
  'team.col_members': ['人数', 'Members'],
  'team.col_actions': ['操作', 'Actions'],
  'team.select_all': ['全选本页', 'Select All'],
  'team.select_item': ['选择 {name}', 'Select {name}'],
  'team.more_actions': ['更多操作', 'More'],
  'team.empty_title': ['暂无团队{extra}', 'No Teams{extra}'],
  'team.empty_desc_search': ['尝试修改搜索关键词', 'Try different keywords'],
  'team.empty_desc_general': ['点击「新建团队」创建第一个团队', 'Click "New Team" to create one'],
  'team.pagination': ['共 {n} 条', '{n} total'],
  'team.page_prev': ['上一页', 'Previous'],
  'team.page_next': ['下一页', 'Next'],
  'team.page_num': ['第 {n} 页', 'Page {n}'],
  'team.toast_created': ['团队已创建', 'Team created'],
  'team.toast_updated': ['团队已更新', 'Team updated'],
  'team.toast_deleted': ['团队已删除', 'Team deleted'],
  'team.toast_copied': ['团队已复制', 'Team copied'],
  'team.toast_batch_deleted': ['已删除 {n} 个团队', '{n} Teams deleted'],
  'team.loading': ['加载中...', 'Loading...'],
  'team.error_render': ['模块出错了，请刷新页面重试', 'Module error, please refresh'],
  'team.error_retry': ['重试', 'Retry'],
  'team.form_title_new': ['新建团队', 'New Team'],
  'team.form_title_edit': ['编辑团队', 'Edit Team'],
  'team.form_name': ['团队名称', 'Name'],
  'team.form_name_placeholder': ['输入团队名称', 'Enter team name'],
  'team.form_desc': ['描述', 'Description'],
  'team.form_desc_placeholder': ['输入团队描述', 'Enter description'],
  'team.form_status': ['状态', 'Status'],
  'team.form_cancel': ['取消', 'Cancel'],
  'team.form_save_edit': ['保存修改', 'Save Changes'],
  'team.form_save_create': ['创建团队', 'Create Team'],
  'team.form_category': ['分类', 'Category'],
  'team.all_category': ['全部分类', 'All Categories'],
  'team.category_dev': ['开发', 'Development'],
  'team.category_ops': ['运维', 'Operations'],
  'team.category_test': ['测试', 'Testing'],
  'team.manage_members': ['管理成员', 'Manage Members'],
  'team.name_required': ['团队名称不能为空', 'Team name is required'],
  'team.name_length': ['团队名称长度需在 2-50 个字符之间', 'Name must be 2-50 characters'],
  'workstation.name': ['名称', 'Name'],
  'workstation.memberCount': ['成员数', 'Members'],
  'workstation.category': ['分类', 'Category'],
  'workstation.status': ['状态', 'Status'],
  'workstation.createdAt': ['创建时间', 'Created'],
  'workstation.actions': ['操作', 'Actions'],
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
