import { useState } from 'react';
import { Modal, Input as AntdInput, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../api/client/instance';
import { useApprovalStore } from '../../stores/streamHandler';

/**
 * 团队审批请求的全局单例 Modal（store 驱动）。
 *
 * M6: approval_request 事件可能先于流式消息到达（流尚未开始、消息列表
 * 最后一条还是 user 消息）；若 Modal 挂在 TeamMessage 上，会因 user 消息
 * 分支提前 return 而静默消失。这里改为 store 驱动：request 一存在即显示，
 * 与消息挂载解耦。同时天然解决同 run 双审批时多个 Modal 同时弹出（L4）。
 */
export default function ApprovalModal() {
  const { t } = useTranslation();
  const request = useApprovalStore((s) => s.request);
  const [approvalNote, setApprovalNote] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  const submitApproval = async (approved: boolean) => {
    if (!request) return;
    setApproving(true);
    setApprovalError('');
    try {
      await api.post(`/team-runs/${request.runId}/approve`, { approved, reason: approvalNote.trim() || undefined });
      setApprovalNote('');
      useApprovalStore.getState().setRequest(null);
    } catch {
      setApprovalError(t('teamMessage.approvalFailed'));
    } finally {
      setApproving(false);
    }
  };

  const closeApproval = () => {
    if (approving) return;
    setApprovalNote('');
    useApprovalStore.getState().setRequest(null);
  };

  return (
    <Modal
      title={t('teamMessage.approvalRequired')}
      open={!!request}
      onCancel={closeApproval}
      footer={[
        <Button key="reject" data-testid="reject-btn" danger loading={approving} onClick={() => submitApproval(false)}>{t('teamMessage.approvalReject')}</Button>,
        <Button key="approve" data-testid="approve-btn" type="primary" loading={approving} onClick={() => submitApproval(true)}>{t('teamMessage.approvalApprove')}</Button>,
      ]}
    >
      {request && <p className="text-sm mb-3">{t('teamMessage.approvalNode', { node: request.node })}</p>}
      <AntdInput.TextArea
        data-testid="approval-note"
        value={approvalNote}
        onChange={(e) => setApprovalNote(e.target.value)}
        placeholder={t('teamMessage.approvalNote')}
        rows={3}
      />
      {approvalError && <p className="text-xs text-[#ef4444] mt-2">{approvalError}</p>}
    </Modal>
  );
}
