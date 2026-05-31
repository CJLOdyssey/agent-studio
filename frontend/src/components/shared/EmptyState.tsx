import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: Props) {
  return (
    <div className="empty-state-inline">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title-sm">{title}</div>
      {description && <div className="empty-state-desc-sm">{description}</div>}
    </div>
  );
}
