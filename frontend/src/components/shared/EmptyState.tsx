import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-[var(--da-text-muted)] text-center">
      <div className="mb-2 opacity-50">{icon}</div>
      <div className="text-sm font-medium text-[var(--da-text-secondary)]">{title}</div>
      {description && <div className="text-xs text-[var(--da-text-muted)] mt-1">{description}</div>}
    </div>
  );
}
