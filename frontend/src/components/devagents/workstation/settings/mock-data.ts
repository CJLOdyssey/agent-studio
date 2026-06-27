import { Bell, Shield, Link, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SettingField { id: string; label: string; type: 'text' | 'select' | 'toggle' | 'number'; value: string | number | boolean; options?: { label: string; value: string }[]; placeholder?: string; }

export interface SettingSection { id: string; title: string; icon: LucideIcon; fields: SettingField[]; }

export const MOCK_SECTIONS: SettingSection[] = [
  { id: 'basic', title: '基本设置', icon: Globe, fields: [
    { id: 'pageSize', label: '每页显示条数', type: 'number', value: 10, placeholder: '10' },
    { id: 'autoRefresh', label: '启用自动刷新', type: 'toggle', value: true },
  ]},
  { id: 'notification', title: '通知设置', icon: Bell, fields: [
    { id: 'notifyAgentErr', label: 'Agent 异常通知', type: 'toggle', value: true },
    { id: 'notifyDisconnect', label: 'MCP 断开通知', type: 'toggle', value: true },
    { id: 'notifyDaily', label: '每日摘要报告', type: 'toggle', value: false },
    { id: 'notifyWebhook', label: 'Webhook URL', type: 'text', value: '', placeholder: 'https://hooks.example.com/notify' },
  ]},
  { id: 'security', title: '安全设置', icon: Shield, fields: [
    { id: 'sessionTimeout', label: '会话超时时间', type: 'number', value: 30, placeholder: '30' },
    { id: 'maxLoginAttempts', label: '最大登录尝试次数', type: 'number', value: 5, placeholder: '5' },
    { id: 'auditLog', label: '启用审计日志', type: 'toggle', value: true },
    { id: 'twoFactor', label: '双因素认证', type: 'toggle', value: false },
  ]},
  { id: 'integration', title: '集成设置', icon: Link, fields: [
    { id: 'npmRegistry', label: 'NPM 镜像源', type: 'text', value: 'https://registry.npmmirror.com', placeholder: 'https://registry.npmjs.org' },
    { id: 'dockerRegistry', label: 'Docker 镜像源', type: 'text', value: 'https://docker.mirrors.ustc.edu.cn', placeholder: 'https://index.docker.io' },
    { id: 'aiProvider', label: 'AI 服务商', type: 'select', value: 'openai', options: [{ label: 'OpenAI', value: 'openai' }, { label: 'Azure OpenAI', value: 'azure' }, { label: 'Anthropic', value: 'anthropic' }, { label: '本地部署', value: 'local' }] },
    { id: 'aiEndpoint', label: 'AI API 端点', type: 'text', value: 'https://api.openai.com/v1', placeholder: 'https://api.openai.com/v1' },
  ]},
];
