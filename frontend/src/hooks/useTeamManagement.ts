import { useTeamData } from './useTeamData';
import { useTeamAgents } from './useTeamAgents';

type ToastFn = (msg: string, type: 'success' | 'info' | 'error') => void;

export { removeConversationsByAgentIds, teamMemberToAgent } from './useTeamData';

export function useTeamManagement(toast?: ToastFn) {
  const {
    teams,
    setTeams,
    editingTeamId,
    editTeamName,
    setEditTeamName,
    toggleTeam,
    handleAddTeam,
    startEditTeam,
    saveEditTeam,
    cancelEditTeam,
    saveTeamName,
    handleTeamNameKeyDown,
    handleRename,
    handleDeleteTeam,
    handleTogglePinTeam,
    allAgents,
  } = useTeamData(toast);

  const {
    handleAddAgent,
    handleRenameAgent,
    handleDeleteAgent,
    handleAgentConfigSave,
    replaceAgentId,
    linkMemberAgent,
  } = useTeamAgents(teams, setTeams, toast);

  return {
    teams,
    editingTeamId,
    editTeamName,
    setEditTeamName,
    toggleTeam,
    handleAddTeam,
    handleAddAgent,
    startEditTeam,
    saveEditTeam,
    cancelEditTeam,
    saveTeamName,
    handleTeamNameKeyDown,
    handleRename,
    handleRenameAgent,
    handleDeleteTeam,
    handleDeleteAgent,
    handleTogglePinTeam,
    handleAgentConfigSave,
    replaceAgentId,
    linkMemberAgent,
    allAgents,
  };
}
