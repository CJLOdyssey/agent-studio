import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center w-full min-w-full">
      <div className="text-da-text-muted opacity-40 mb-2">{icon}</div>
      <div className="text-base font-medium text-da-text-primary">{title}</div>
      {description && (
        <div className="text-sm text-da-text-muted max-w-[320px] leading-relaxed">{description}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
