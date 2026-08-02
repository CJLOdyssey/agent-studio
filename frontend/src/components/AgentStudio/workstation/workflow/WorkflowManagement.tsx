import { useEffect, useRef, useState } from 'react';
import WorkflowEditor from './WorkflowEditor';
import WorkflowList from './WorkflowList';
import { fetchWorkflow } from '../../../../api/client';
import { listTeams } from '../../../../api/client/teams';
import type { WorkflowConfig, WorkflowSummary } from '../../../../types/AgentStudio';
import { t } from './locales';

interface TeamItem {
  id: string;
  name: string;
  agents: Array<{
    id: string;
    name: string;
    agentConfigId?: string;
    role?: string;
  }>;
}

interface EditingTarget {
  teamId: string;
  teamName: string;
}

export default function WorkflowManagement() {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [config, setConfig] = useState<WorkflowConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => { listTeams().then((d) => setTeams(d as TeamItem[])).catch(() => {}); }, []);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setConfig(null);
      try {
        const c = await fetchWorkflow(editing.teamId);
        if (!cancelled) { setConfig(c); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [editing]);

  const selectedTeam = editing ? teams.find((team) => team.id === editing.teamId) : null;

  const handleOpenWorkflow = (workflow: WorkflowSummary) => {
    if (dirtyRef.current && !window.confirm(t('workflow.back_unsaved'))) return;
    dirtyRef.current = false;
    setEditing({ teamId: workflow.teamId, teamName: workflow.teamName });
  };

  const handleCreateWorkflow = (teamId: string) => {
    const team = teams.find((tm) => tm.id === teamId);
    setEditing({ teamId, teamName: team?.name || teamId });
  };

  const handleBack = () => {
    if (dirtyRef.current && !window.confirm(t('workflow.back_unsaved'))) return;
    dirtyRef.current = false;
    setEditing(null);
  };

  if (!editing) {
    return (
      <WorkflowList
        teams={teams.map((tm) => ({ id: tm.id, name: tm.name }))}
        onCreateWorkflow={handleCreateWorkflow}
        onOpenWorkflow={handleOpenWorkflow}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <button
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium cursor-pointer border-none bg-transparent text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          onClick={handleBack}
        >
          <span aria-hidden>←</span> {t('workflow.back_to_list')}
        </button>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{editing.teamName}</span>
        {loading && <span className="text-sm text-[var(--color-text-muted)]">{t('workflow.loading')}</span>}
      </div>
      {selectedTeam && (
        <WorkflowEditor
          key={editing.teamId}
          teamId={selectedTeam.id}
          agents={selectedTeam.agents}
          existingConfig={config}
          onSaved={() => fetchWorkflow(editing.teamId).then(setConfig)}
          onDeleted={() => { dirtyRef.current = false; setEditing(null); }}
          onDirtyChange={(dirty) => { dirtyRef.current = dirty; }}
        />
      )}
      {!selectedTeam && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>{t('workflow.loading')}</div>
      )}
    </div>
  );
}
