import { useEffect, useState } from 'react';
import WorkflowEditor from './WorkflowEditor';
import { fetchWorkflow } from '../../../../api/client';
import { listTeams } from '../../../../api/client/teams';
import type { WorkflowConfig } from '../../../../types/AgentStudio';

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

export default function WorkflowManagement() {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [config, setConfig] = useState<WorkflowConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  useEffect(() => { listTeams().then((d) => setTeams(d as TeamItem[])).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedTeamId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setConfig(null);
      try {
        const c = await fetchWorkflow(selectedTeamId);
        if (!cancelled) { setConfig(c); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedTeamId]);

  return (
    <div className="agentstudio-page h-[calc(100dvh-120px)]">
      <div className="flex gap-2 mb-3">
        <select className="w-full px-3 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm transition-colors duration-150 focus:border-[var(--color-accent)] focus:outline-none" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
          <option value="">选择团队</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
        {loading && <span className="text-sm text-[var(--color-text-muted)]">加载中...</span>}
      </div>
      {selectedTeam && (
        <WorkflowEditor
          teamId={selectedTeam.id}
          agents={selectedTeam.agents}
          existingConfig={config}
          onSaved={() => fetchWorkflow(selectedTeamId).then(setConfig)}
          onDeleted={() => { setConfig(null); setSelectedTeamId(''); }}
        />
      )}
      {!selectedTeam && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>选择一个团队开始编排工作流</div>
      )}
    </div>
  );
}
