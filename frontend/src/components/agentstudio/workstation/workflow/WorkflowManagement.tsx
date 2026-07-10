import { useEffect, useState } from 'react';
import WorkflowEditor from './WorkflowEditor';
import { fetchWorkflow } from '../../../../api/client';
import { listTeams } from '../../../../api/client/teams';
import type { WorkflowConfig } from '../../../../types/agentstudio';

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
    <div className="agentstudio-page" style={{ height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select className="form-input" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
          <option value="">选择团队</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
        {loading && <span style={{ fontSize: 13, color: '#6b7280' }}>加载中...</span>}
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
