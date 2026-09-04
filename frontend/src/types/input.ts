/**
 * 输入组件系统的共享类型。
 *
 * 所有输入相关的组件和 hook 都依赖此单一文件，
 * 而非相互导入——零循环依赖。
 */

// ── 模型 ──

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  status?: 'deprecated' | 'sunset';
}

// ── 命令 ──

export interface CommandOption {
  id: string;
  name: string;
  description?: string;
  source?: 'local' | 'agent';
}

// ── 文件 / 附件 ──

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  /** 预上传状态（选中即上传，行业模式） */
  status?: 'uploading' | 'done' | 'error';
  progress?: number;
  attachmentId?: string;
}

export interface FileRejection {
  file: File;
  reason: 'size_exceeded' | 'type_denied';
}
