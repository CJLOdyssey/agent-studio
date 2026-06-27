import { PanelLeft } from 'lucide-react';

interface Props {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: Props) {
  return (
    <header className="devagents-header">
      <div className="devagents-header-left">
        <button 
          className="devagents-header-btn"
          onClick={onToggleSidebar}
        >
          <PanelLeft size={20} />
        </button>
      </div>
    </header>
  );
}
