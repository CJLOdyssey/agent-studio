const langs: Record<string, [zh: string, en: string]> = {
  'skill.new': ['新建 Skill', 'New Skill'],
  'skill.edit': ['编辑', 'Edit'],
  'skill.copy': ['复制', 'Copy'],
  'skill.delete': ['删除', 'Delete'],
  'skill.history': ['版本历史', 'History'],
  'skill.batch_delete': ['批量删除 ({n})', 'Batch Delete ({n})'],
  'skill.search_placeholder': ['搜索名称、分类、描述...', 'Search name, category...'],
  'skill.all_categories': ['全部分类', 'All Categories'],
  'skill.col_name': ['Skill 名称', 'Name'],
  'skill.col_desc': ['描述', 'Description'],
  'skill.col_category': ['分类', 'Category'],
  'skill.col_status': ['状态', 'Status'],
  'skill.col_version': ['版本', 'Version'],
  'skill.col_author': ['作者', 'Author'],
  'skill.col_actions': ['操作', 'Actions'],
  'skill.select_all': ['全选本页', 'Select All'],
  'skill.select_item': ['选择 {name}', 'Select {name}'],
  'skill.more_actions': ['更多操作', 'More'],
  'skill.empty_title': ['暂无 Skill{extra}', 'No Skills{extra}'],
  'skill.empty_desc_search': ['尝试修改搜索关键词', 'Try different keywords'],
  'skill.empty_desc_general': ['点击右上角「新建 Skill」创建第一个 Skill', 'Click "New Skill" to create one'],
  'skill.pagination': ['共 {n} 条', '{n} total'],
  'skill.page_prev': ['上一页', 'Previous'],
  'skill.page_next': ['下一页', 'Next'],
  'skill.page_num': ['第 {n} 页', 'Page {n}'],
  'skill.toast_created': ['Skill 已创建', 'Skill created'],
  'skill.toast_updated': ['Skill 已更新', 'Skill updated'],
  'skill.toast_deleted': ['Skill 已删除', 'Skill deleted'],
  'skill.toast_copied': ['Skill 已复制', 'Skill copied'],
  'skill.toast_batch_deleted': ['已删除 {n} 个 Skill', '{n} Skills deleted'],
  'skill.form_title_new': ['新建 Skill', 'New Skill'],
  'skill.form_title_edit': ['编辑 Skill', 'Edit Skill'],
  'skill.form_name': ['Skill 名称', 'Name'],
  'skill.form_name_placeholder': ['2-50 个字符', '2-50 characters'],
  'skill.form_desc': ['描述', 'Description'],
  'skill.form_desc_placeholder': ['Skill 功能描述...', 'Describe skill...'],
  'skill.form_category': ['分类', 'Category'],
  'skill.form_status': ['状态', 'Status'],
  'skill.form_author': ['作者', 'Author'],
  'skill.form_author_placeholder': ['作者名称', 'Author name'],
  'skill.form_version': ['版本', 'Version'],
  'skill.form_version_placeholder': ['v1.0.0', 'v1.0.0'],
  'skill.form_instructions': ['Skill 指令', 'Instructions'],
  'skill.form_instructions_placeholder': ['LLM 激活此 Skill 后会收到的指令', 'Instructions the LLM receives when activated'],
  'skill.form_prompt': ['关联提示词', 'Linked Prompt'],
  'skill.form_no_prompt': ['不使用提示词', 'No prompt'],
  'skill.form_tools': ['关联工具/MCP', 'Linked Tools / MCP'],
  'skill.form_no_tools': ['加载中...', 'Loading...'],
  'skill.form_output_constraint': ['输出约束', 'Output Constraint'],
  'skill.form_output_constraint_placeholder': ['自定义输出格式要求', 'Custom output format requirements'],
  'skill.form_pick_constraint': ['+ 从约束库选择', '+ Pick from constraints'],
  'skill.form_cancel': ['取消', 'Cancel'],
  'skill.form_save_edit': ['保存修改', 'Save Changes'],
  'skill.form_save_create': ['创建 Skill', 'Create Skill'],
  'skill.error_render': ['模块出错了，请刷新页面重试', 'Module error, please refresh'],
  'skill.error_retry': ['重试', 'Retry'],
  'skill.loading': ['加载中...', 'Loading...'],
  'skill.status_installed': ['已安装', 'Installed'],
  'skill.status_available': ['未安装', 'Available'],
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
