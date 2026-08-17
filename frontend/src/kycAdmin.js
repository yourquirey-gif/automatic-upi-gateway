import { useEffect, useState } from 'react';
import { api } from './api';

const initialConfig = {
  enabled: false,
  required: false,
  price: 50,
  panField: true,
  aadhaarField: true,
  paymentUpiId: '',
  paymentName: 'OmniUPI'
};

export default function KycAdmin() {
  const [rows, setRows] = useState([]);
  const [cfg, setCfg] = useState(initialConfig);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [requests, settings] = await Promise.all([
      api('/admin/kyc'),
      api('/kyc-config')
    ]);
    setRows(requests.requests || []);
    setCfg({ ...initialConfig, ...(settings.config || {}) });
  };

  useEffect(() => {
    load().catch(e => setMsg(e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api('/kyc-config', { method: 'PUT', body: JSON.stringify(cfg) });
      setMsg('KYC & Account Settings saved successfully.');
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, type) => {
    try {
      await api(`/admin/kyc/${id}/${type}`, { method: 'POST', body: JSON.stringify({}) });
      setMsg(type === 'verify' ? 'KYC verified. User will see the verification status.' : 'KYC request updated.');
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <div className="admin">
      <main style={{ width: '100%' }}>
        <header>
          <div>
            <small>ADMIN CONSOLE</small>
            <h1>KYC & Account Settings</h1>
          </div>
        </header>

        {msg && <div className="notice">{msg}</div>}

        <section className="settings-card">
          <h2>Account Settings Fields</h2>
          <p style={{ color: '#70798a', marginTop: -6 }}>
            These switches are stored in KycConfig and immediately control the merchant Account Settings page.
          </p>

          <ToggleRow title="Show PAN Number" description="Show or hide PAN Number in the merchant user panel." checked={cfg.panField} onChange={v => setCfg({ ...cfg, panField: v })} />
          <ToggleRow title="Show Aadhaar Number" description="Show or hide Aadhaar Number in the merchant user panel." checked={cfg.aadhaarField} onChange={v => setCfg({ ...cfg, aadhaarField: v })} />
        </section>

        <section className="settings-card">
          <h2>KYC Controls</h2>
          <ToggleRow title="Enable KYC" description="Enable the KYC verification feature for merchants." checked={cfg.enabled} onChange={v => setCfg({ ...cfg, enabled: v })} />
          <ToggleRow title="Require KYC" description="When enabled, KYC must be verified before protected gateway access." checked={cfg.required} onChange={v => setCfg({ ...cfg, required: v })} />

          <label>KYC price (₹)
            <input type="number" min="0" value={cfg.price} onChange={e => setCfg({ ...cfg, price: Number(e.target.value) })} />
          </label>
          <label>KYC payment UPI ID
            <input value={cfg.paymentUpiId} onChange={e => setCfg({ ...cfg, paymentUpiId: e.target.value })} placeholder="yourupi@bank" />
          </label>
          <label>Payment name
            <input value={cfg.paymentName} onChange={e => setCfg({ ...cfg, paymentName: e.target.value })} />
          </label>

          <button className="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save KYC & Account Settings'}
          </button>
        </section>

        <section className="settings-card">
          <h2>KYC Requests</h2>
          {rows.length === 0 && <div style={{ color: '#7a8494' }}>No KYC requests yet.</div>}
          {rows.map(x => (
            <div className="plan-row" key={x.id}>
              <div>
                <b>{x.user?.name || 'Unknown user'} — {x.status}</b>
                <div>User ID: {x.user?.userId || '—'}</div>
                <div>{x.user?.email || '—'} {x.user?.mobile ? `• ${x.user.mobile}` : ''}</div>
                <div>Order: {x.orderId} • Payment: {x.paidAt ? 'PAID' : 'PENDING'} • ₹{x.amount}</div>
                <div>Aadhaar: {x.aadhaar?.number || 'Not submitted'} • PAN: {x.pan?.number || 'Not submitted'}</div>
              </div>
              <div className="row-actions">
                {x.status === 'SUBMITTED' && <button className="primary" onClick={() => act(x.id, 'verify')}>Verify KYC</button>}
                {x.status !== 'VERIFIED' && x.status !== 'REJECTED' && <button className="danger" onClick={() => act(x.id, 'reject')}>Reject</button>}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid #edf0f4' }}>
      <div>
        <strong style={{ display: 'block' }}>{title}</strong>
        <small style={{ color: '#7a8494' }}>{description}</small>
      </div>
      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 20, height: 20 }} />
      </label>
    </div>
  );
}
