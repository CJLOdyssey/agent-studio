import type { WorkspaceTab, FileNode } from '../types/devagents';
import { mockUiCode } from './mockUiCode';

const emptyFolder = (name: string): FileNode => ({ id: `${name}-root`, name, type: 'folder', children: [] });

export const mockFiles: Record<WorkspaceTab, FileNode> = {
  'code': emptyFolder('project'),
  'preview': { id: 'preview-root', name: 'preview', type: 'folder' },
  'ui-code': mockUiCode,
  'ui-preview': emptyFolder('ui-preview'),
  'frontend-code': emptyFolder('frontend'),
  'frontend-test': emptyFolder('frontend-test'),
  'frontend-preview': { id: 'frontend-preview-root', name: 'preview', type: 'folder' },
  'backend-code': emptyFolder('backend'),
  'backend-test': emptyFolder('backend-test'),
};
