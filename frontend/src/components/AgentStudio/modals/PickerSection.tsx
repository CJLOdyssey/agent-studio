import ResourcePickerModal from '../workstation/shared/ResourcePickerModal';
import type { PickerItem } from './tabs/usePickerState';

interface Props {
  tab: string | null;
  items: Record<string, PickerItem[]>;
  onSelect: (tab: string, item: PickerItem) => void;
  onClose: () => void;
}

const TITLE_MAP: Record<string, string> = {
  system: '系统提示词',
  output: '输出约束',
  tools: '工具',
  mcp: 'MCP',
  skills: 'Skills',
};

export default function PickerSection({ tab, items, onSelect, onClose }: Props) {
  if (!tab) return null;

  const currentItems = items[tab] || [];

  return (
    <ResourcePickerModal
      title={`从工作台添加 - ${TITLE_MAP[tab] || tab}`}
      options={currentItems}
      selectedIds={[]}
      getOptionId={(item: PickerItem) => item.id}
      getOptionLabel={(item: PickerItem) => item.name}
      getOptionSecondary={(item: PickerItem) => item.description}
      multiple
      onConfirm={(ids) => {
        const selected = currentItems.filter((item) => (ids as string[]).includes(item.id));
        selected.forEach((item) => onSelect(tab, item));
      }}
      onClose={onClose}
    />
  );
}
