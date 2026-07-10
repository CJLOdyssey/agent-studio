// AgentStudio 类型定义
import type { LucideIcon } from 'lucide-react';

// Agent 工具配置
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  type?: string;
  enabled: boolean;
  parameters?: string;
}

// Agent MCP 配置
export interface AgentMCP {
  id: string;
  name: string;
  description: string;
  serverUrl: string;
  type?: string;
  enabled: boolean;
}

// Agent Skills 配置
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  type?: string;
  enabled: boolean;
}

// Agent 配置
export interface Agent {
  id: string;
  name: string;
  role: string;
  agentConfigId?: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  systemPrompt?: string;
  outputConstraints?: string;
  responseFormat?: Record<string, unknown>;
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
  isPinned: boolean;
  agents: Agent[];
  workflowConfigId?: string;
}

export interface WorkflowNode {
  id: string;
  agentConfigId: string;
  roleIdentifier: string;
  strategy: string;
  order: number;
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  conditionKey?: string;
  isDefault: boolean;
  priority: number;
}

export interface WorkflowConfig {
  id: string;
  teamId: string;
  name: string;
  maxRounds: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// 对话历史记录
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  agentId?: string;
  sessionId?: string;
  teamId?: string;
  teamName?: string;
}

// 消息类型
export interface Message {
  id: string;
  role: 'user' | 'agent';
  agentId?: string;
  content: string;
  thinking?: string;
  answer?: string;
  timestamp?: number;
  type?: 'process';
  thinkingDone?: boolean;
  plan?: PlanStep[];
  action?: MessageAction;
  hasArtifact?: boolean;
  artifactType?: string;
  artifactTitle?: string;
  isTyping?: boolean;
  versions?: string[];
  thinkingVersions?: string[];
  currentVersion?: number;
  thumbsFeedback?: 'up' | 'down' | null;
  interrupted?: boolean;
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
