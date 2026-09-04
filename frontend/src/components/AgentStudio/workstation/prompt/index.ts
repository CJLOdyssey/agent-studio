/* 对外 API——外部模块必须从这里导入，而非从内部文件导入。 */

export type { PromptEntry, PromptFormData, PromptSortField, CategoryFilter, PromptCategory, PromptData } from './types';
export { usePromptManagement } from './usePromptManagement';
export { usePromptImportExport } from './usePromptImportExport';
export { PROMPT_STATUS_LABEL, PROMPT_CATEGORY_LABEL, getCategoryLabel } from './constants';
export { MOCK_PROMPTS, MOCK_PROMPT_VERSIONS } from '@/mocks/prompt';
export { promptAPI } from './api';
export { t, setLang, getLang } from './locales';
export { default as PromptManagement } from './PromptManagement';
export { default as PromptFormModal } from './PromptFormModal';
