// DevAgents 类型定义
import type { LucideIcon } from 'lucide-react';

// Agent 工具配置
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

// Agent MCP 配置
export interface AgentMCP {
  id: string;
  name: string;
  serverUrl: string;
  enabled: boolean;
}

// Agent Skills 配置
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

// Agent 配置
export interface Agent {
  id: string;
  name: string;
  role: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  // 扩展配置
  systemPrompt?: string;
  outputConstraints?: string;
  tools?: AgentTool[];
  mcp?: AgentMCP[];
  skills?: AgentSkill[];
  isConfigured?: boolean;
}

// 团队配置
export interface Team {
  id: string;
  name: string;
  isExpanded: boolean;
  agents: Agent[];
}

// 对话历史记录
export interface Conversation {
  id: number;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  agentId?: string;
}

// 消息类型
export interface Message {
  id: number;
  role: 'user' | 'agent';
  agentId?: string;
  content: string;
  timestamp?: number;
  type?: 'process';
  plan?: PlanStep[];
  action?: MessageAction;
  hasArtifact?: boolean;
  artifactType?: string;
  artifactTitle?: string;
  isTyping?: boolean;
}

// 计划步骤
export interface PlanStep {
  step: string;
  status: 'completed' | 'running' | 'pending';
}

// 消息动作
export interface MessageAction {
  type: string;
  label: string;
}

// 工作区标签
export type WorkspaceTab =
  | 'code'
  | 'preview'
  | 'ui-code'
  | 'ui-preview'
  | 'frontend-code'
  | 'frontend-test'
  | 'frontend-preview'
  | 'backend-code'
  | 'backend-test';

// 文件节点
export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

// Agent 类型
export type AgentType = 'ui' | 'frontend' | 'backend';
