import { useState, useEffect } from 'react';
import type { PickerItem } from '../PickerModal';
import { promptAPI } from '../../workstation/prompt/api';
import { outputAPI } from '../../workstation/output/api';
import { toolAPI } from '../../workstation/tool/api';
import { mcpAPI } from '../../workstation/mcp/api';
import { skillAPI } from '../../workstation/skill/api';

export interface PickerDeps {
  setSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  setOutputConstraints: React.Dispatch<React.SetStateAction<string>>;
  addTool: (item: PickerItem) => void;
  addMcp: (item: PickerItem) => void;
  addSkill: (item: PickerItem) => void;
}

export function usePickerState(deps: PickerDeps) {
  const { setSystemPrompt, setOutputConstraints, addTool, addMcp, addSkill } = deps;
  const [pickerTab, setPickerTab] = useState<string | null>(null);
  const [pickerItems, setPickerItems] = useState<Record<string, PickerItem[]>>({});

  useEffect(() => {
    let cancelled = false;
    promptAPI
      .fetchAll()
      .then((items) => {
        if (!cancelled)
          setPickerItems((prev) => ({
            ...prev,
            system: items.map(
              (p) =>
                ({
                  id: p.id,
                  name: p.name,
                  description: p.content.length > 120 ? p.content.slice(0, 120) + '…' : p.content,
                  source: '提示词管理',
                }) as PickerItem,
            ),
          }));
      })
      .catch(() => {});
    outputAPI
      .fetchAll()
      .then((items) => {
        if (!cancelled)
          setPickerItems((prev) => ({
            ...prev,
            output: items.map(
              (o) =>
                ({ id: o.id, name: o.name, description: o.content, source: '输出管理' }) as PickerItem,
            ),
          }));
      })
      .catch(() => {});
    toolAPI
      .fetchAll()
      .then((items) => {
        if (!cancelled)
          setPickerItems((prev) => ({
            ...prev,
            tools: items.map((tool) => ({
              id: tool.id,
              name: tool.name,
              description: tool.description || '',
              source: '工具管理',
            })),
          }));
      })
      .catch((e) => console.error('AgentConfigModal: tool fetch failed', e));
    mcpAPI
      .fetchAll()
      .then((items) => {
        if (!cancelled)
          setPickerItems((prev) => ({
            ...prev,
            mcp: items.map((m) => ({
              id: m.id,
              name: m.name,
              description: m.description || '',
              source: 'MCP 管理',
            })),
          }));
      })
      .catch((e) => console.error('AgentConfigModal: mcp fetch failed', e));
    skillAPI
      .fetchAll()
      .then((items) => {
        if (!cancelled)
          setPickerItems((prev) => ({
            ...prev,
            skills: items.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description || '',
              source: '技能管理',
            })),
          }));
      })
      .catch((e) => console.error('AgentConfigModal: skill fetch failed', e));
    return () => {
      cancelled = true;
    };
  }, []);

  function handlePickerSelect(tab: string, item: PickerItem) {
    switch (tab) {
      case 'system':
        setSystemPrompt((prev) => prev + (prev ? '\n\n' : '') + item.description);
        break;
      case 'output':
        setOutputConstraints((prev) => prev + (prev ? '\n' : '') + item.description);
        break;
      case 'tools':
        addTool(item);
        break;
      case 'mcp':
        addMcp(item);
        break;
      case 'skills':
        addSkill(item);
        break;
    }
    setPickerTab(null);
  }

  return { pickerTab, pickerItems, handlePickerSelect, setPickerTab, setPickerItems };
}
