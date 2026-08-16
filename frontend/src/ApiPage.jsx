import React, { useEffect, useState } from 'react';
import { Check, Clipboard, Code2, Eye, EyeOff, RefreshCw, ShieldCheck, Webhook, X } from 'lucide-react';
import { api } from './api';
import './api.css';

function mask(value) {
  if (!value) return '••••••••••••••••••••••••••••••••';
  return '••••••••••••••••••••••••••••••••';
}

export default function ApiPage() {
  const [credentials, setCredentials] = useState(null);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [webhook, setWebhook] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api('/account/api');
      setCredentials(data.credentials);
      setWebhook(data.credentials?.webhookUrl || '');
    } catch (error) {
      setToast({ type: 'error', text: error.message || 'Unable to load API credentials' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ type: 'success', text: `${label} copied` });
    } catch {
      setToast({ type: 'error', text: 'Copy failed. Please copy manually.' });
    }
  };

  const regenerate = async (type) => {
    setConfirm(null);
    try {
      setBusy(type);
      const data = await api('/account/api/regenerate', {
        method: 'POST',
        body: JSON.stringify({ type })
      });
      setCredentials(prev => ({ ...prev, ...data.credentials }));
      setToast({ type: 'success', text: data.message });
    } catch (error) {
      setToast({ type: 'error', text: error.message || 'Unable to regenerate credential' });
    } finally {
      setBusy('');
    }
  };

  const saveWebhook = async () => {
    const value = webhook.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      setToast({ type: 'error', text: 'URL must include http or https' });
      return;
    }
    try {
      setSaving(true);
      const data = await api('/account/api/webhook', {
        method: 'PUT',
        body: JSON.stringify({ webhookUrl: value })
      });
      setWebhook(data.webhookUrl || '');
      setToast({ type: 'success', text: 'Webhook URL updated successfully' });
    } catch (error) {
      setToast({ type: 'error', text: error.message || 'Unable to update webhook' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="api-page"><div className="api-loading">Loading API credentials…</div></div>;

  return (
    <div className="api-page">
      <div className="api-page-head">
        <div>
          <span className="api-eyebrow">DEVELOPER SETTING</span>
          <h1>API Details</h1>
          <p>Use your unique credentials to authenticate API requests and receive transaction updates.</p>
        </div>
        {credentials?.userId && <div className="api-user-badge">User ID: <b>{credentials.userId}</b></div>}
      </div>

      <CredentialCard
        title="API Token"
        description="Use this token to authenticate your API requests"
        value={credentials?.apiToken}
        visible={showToken}
        onToggle={() => setShowToken(v => !v)}
        onCopy={() => copy(credentials?.apiToken, 'API token')}
        onRegenerate={() => setConfirm('token')}
        busy={busy === 'token'}
        icon={<Code2 size={25} />}
      />

      <CredentialCard
        title="Instance Secret"
        description="Used to verify webhook signatures securely"
        value={credentials?.instanceSecret}
        visible={showSecret}
        onToggle={() => setShowSecret(v => !v)}
        onCopy={() => copy(credentials?.instanceSecret, 'Instance secret')}
        onRegenerate={() => setConfirm('secret')}
        busy={busy === 'secret'}
        icon={<ShieldCheck size={25} />}
        warning="Keep this secret private. It is required to verify webhook signatures."
      />

      <section className="api-card">
        <div className="api-card-title"><Webhook size={25} /><div><h2>Webhook URL</h2><p>Transaction updates will be sent to this URL</p></div></div>
        <label className="api-label">Webhook URL</label>
        <div className="api-input-wrap">
          <input value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://yourdomain.com/webhook" />
          <Eye size={20} />
        </div>
        {webhook && !/^https?:\/\//i.test(webhook) && <div className="api-error-text">URL must include http or https</div>}
        <button className="api-primary-btn" onClick={saveWebhook} disabled={saving}>
          <Check size={19} /> {saving ? 'Updating…' : 'Update Webhook'}
        </button>
      </section>

      <section className="api-card security-card">
        <div className="api-card-title"><ShieldCheck size={25} /><div><h2>API Security Instructions</h2><p>Keep your API credentials safe and secure</p></div></div>
        <ul>
          <li>👉 Never share your API token publicly.</li>
          <li>👉 Store credentials securely on server side.</li>
          <li>👉 Rotate API keys periodically.</li>
          <li>👉 Verify webhook signatures using your Instance Secret.</li>
          <li>👉 Contact support if suspicious activity is detected.</li>
        </ul>
      </section>

      {toast && <div className={`api-toast ${toast.type}`} onClick={() => setToast(null)}>{toast.type === 'success' ? <Check size={18} /> : <X size={18} />}{toast.text}</div>}

      {confirm && <div className="api-modal-backdrop">
        <div className="api-modal">
          <div className="api-modal-icon"><RefreshCw size={25} /></div>
          <h3>{confirm === 'token' ? 'Regenerate API Token?' : 'Regenerate Instance Secret?'}</h3>
          <p>The current {confirm === 'token' ? 'API token' : 'Instance Secret'} will stop working immediately. Any integration using it must be updated.</p>
          <div className="api-modal-actions">
            <button onClick={() => setConfirm(null)}>Cancel</button>
            <button className="danger" onClick={() => regenerate(confirm)}>Regenerate</button>
          </div>
        </div>
      </div>}
    </div>
  );
}

function CredentialCard({ title, description, value, visible, onToggle, onCopy, onRegenerate, busy, icon, warning }) {
  return <section className="api-card">
    <div className="api-card-title">{icon}<div><h2>{title}</h2><p>{description}</p></div></div>
    <label className="api-label">Your {title}</label>
    <div className="credential-row">
      <div className="credential-value">{visible ? value : mask(value)}</div>
      <button title={visible ? 'Hide' : 'Show'} onClick={onToggle}>{visible ? <EyeOff size={22} /> : <Eye size={22} />}</button>
      <button title="Copy" onClick={onCopy}><Clipboard size={22} /></button>
      <button className="regen" title="Regenerate" onClick={onRegenerate} disabled={busy}><RefreshCw size={21} className={busy ? 'spin' : ''} /></button>
    </div>
    {warning && <div className="api-warning">{warning}</div>}
  </section>;
}
