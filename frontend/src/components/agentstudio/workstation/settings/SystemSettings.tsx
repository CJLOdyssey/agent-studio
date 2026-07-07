import { Input, Select, Switch, InputNumber, Button, message } from 'antd';
import { Info, ToggleRight, ShieldCheck, Save, RotateCcw, Trash2 } from 'lucide-react';
import { ErrorBoundary } from '../shared/ErrorBoundary';

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--da-border)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--da-text-primary)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--da-text-muted)' }}>{desc}</span>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function SystemSettings() {
  const [messageApi, contextHolder] = message.useMessage();

  return (
    <ErrorBoundary fallback={<div className="wsta-settings wsta-error-state" role="alert"><p>加载失败</p></div>}>
    {contextHolder}
    <div className="wsta-settings">
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Section 1: 基本信息 */}
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--da-border-subtle)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--da-accent)' }}>
                <Info size={16} strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--da-text-primary)', margin: 0 }}>基本信息</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><label style={{ fontSize: 13, fontWeight: 500, color: 'var(--da-text-secondary)' }}>系统名称</label><Input defaultValue="AgentStudio" /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><label style={{ fontSize: 13, fontWeight: 500, color: 'var(--da-text-secondary)' }}>系统描述</label><Input defaultValue="AI Agent 协作系统" /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><label style={{ fontSize: 13, fontWeight: 500, color: 'var(--da-text-secondary)' }}>默认语言</label><Select defaultValue="zh" options={[{ value: 'zh', label: '简体中文' }, { value: 'en', label: 'English' }]} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><label style={{ fontSize: 13, fontWeight: 500, color: 'var(--da-text-secondary)' }}>时区</label><Select defaultValue="shanghai" options={[{ value: 'shanghai', label: 'Asia/Shanghai (UTC+8)' }, { value: 'utc', label: 'UTC' }]} /></div>
            </div>
          </section>

          {/* Section 2: 功能开关 */}
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--da-border-subtle)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--da-accent)' }}>
                <ToggleRight size={16} strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--da-text-primary)', margin: 0 }}>功能开关</h3>
            </div>
            <ToggleRow label="启用用户注册" desc="允许新用户注册账户" defaultChecked />
            <ToggleRow label="启用邮件通知" desc="系统事件发送邮件通知" defaultChecked />
            <ToggleRow label="启用操作审计" desc="记录所有用户操作日志" defaultChecked />
            <ToggleRow label="启用 API 访问" desc="允许通过 API 访问系统" />
          </section>

          {/* Section 3: 安全策略 */}
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--da-border-subtle)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--da-accent)' }}>
                <ShieldCheck size={16} strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--da-text-primary)', margin: 0 }}>安全策略</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><label style={{ fontSize: 13, fontWeight: 500, color: 'var(--da-text-secondary)' }}>会话超时（分钟）</label><InputNumber defaultValue={30} style={{ width: '100%' }} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><label style={{ fontSize: 13, fontWeight: 500, color: 'var(--da-text-secondary)' }}>最大登录尝试次数</label><InputNumber defaultValue={5} style={{ width: '100%' }} /></div>
            </div>
          </section>

        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: 16, borderTop: '1px solid var(--da-border-subtle)', background: 'var(--da-bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Button danger icon={<Trash2 size={14} />} onClick={() => messageApi.success('缓存数据已清除')}>清除缓存</Button>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button icon={<RotateCcw size={14} />} style={{ color: 'var(--da-text-secondary)', borderColor: 'var(--da-border-strong)' }}>重置</Button>
          <Button type="primary" icon={<Save size={14} />} style={{ background: 'var(--da-bg-hover)', borderColor: 'var(--da-bg-hover)', color: 'var(--da-text-primary)' }}>保存设置</Button>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default SystemSettings;
