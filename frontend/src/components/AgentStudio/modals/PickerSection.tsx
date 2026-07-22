import PickerModal from './PickerModal';
import type { PickerItem } from './PickerModal';

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

  return (
    <PickerModal
      title={`从工作台添加 - ${TITLE_MAP[tab] || tab}`}
      items={items[tab] || []}
      onSelect={(item) => onSelect(tab, item)}
      onClose={onClose}
    />
  );
}
