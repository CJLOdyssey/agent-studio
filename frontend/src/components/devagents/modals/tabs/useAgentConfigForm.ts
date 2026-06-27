import { useState } from 'react';
import type { ToolFormData } from '../../workstation/tool/tool.types';
import type { MCPFormData } from '../../workstation/mcp/mcp.types';
import type { SkillFormData } from '../../workstation/skill/skill.types';

interface FormState {
  tool: { show: boolean; data: ToolFormData; errors: string[] };
  mcp: { show: boolean; data: MCPFormData; errors: string[] };
  skill: { show: boolean; data: SkillFormData; errors: string[] };
}

const defaultTool: ToolFormData = { name: '', description: '', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.0.0', endpoint: '', parameters: '{"type":"object"}' };
const defaultMCP: MCPFormData = { name: '', description: '', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: '', url: '' };
const defaultSkill: SkillFormData = { name: '', description: '', category: 'AI/ML', status: 'available', version: 'v1.0.0', author: '', instructions: '', prompt_id: '', tool_names: [], output_constraint: '' };

const initialState: FormState = {
  tool: { show: false, data: defaultTool, errors: [] },
  mcp: { show: false, data: defaultMCP, errors: [] },
  skill: { show: false, data: defaultSkill, errors: [] },
};

export function useAgentConfigForm() {
  const [forms, setForms] = useState<FormState>(initialState);

  function openForm(kind: 'tool' | 'mcp' | 'skill') {
    const defaults: Record<string, ToolFormData | MCPFormData | SkillFormData> = {
      tool: { ...defaultTool }, mcp: { ...defaultMCP }, skill: { ...defaultSkill },
    };
    setForms((prev) => ({ ...prev, [kind]: { show: true, data: defaults[kind], errors: [] } }));
  }

  function closeForm(kind: 'tool' | 'mcp' | 'skill') {
    setForms((prev) => ({ ...prev, [kind]: { ...prev[kind], show: false, errors: [] } }));
  }

  function updateFormData(kind: 'tool' | 'mcp' | 'skill', fn: (d: unknown) => unknown) {
    setForms((prev) => ({ ...prev, [kind]: { ...prev[kind], data: fn(prev[kind].data) } }));
  }

  function setFormErrors(kind: 'tool' | 'mcp' | 'skill', errors: string[]) {
    setForms((prev) => ({ ...prev, [kind]: { ...prev[kind], errors } }));
  }

  return { forms, openForm, closeForm, updateFormData, setFormErrors };
}
