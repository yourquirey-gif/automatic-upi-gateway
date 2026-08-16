import { useEffect, useState } from 'react';
import { api } from './api';

const initialConfig = {
  enabled: false,
  required: false,
  price: 50,
  panField: true,
  aadhaarField: true,
  paymentUpiId: '',
  paymentName: 'AutoGateway'
};

export default function KycAdmin() {
  const [rows, setRows] = useState([]);
  const [cfg, setCfg] = useState(initialConfig);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [requests, settings] = await Promise.all([
      api('/kyc/admin/requests'),
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
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, type) => {
    try {
      await api(`/kyc/admin/${id}/${type}`, { method: 'POST', body: JSON.stringify({}) });
      setMsg(type === 'verify' ? 'KYC verified. User will see verification status.' : 'KYC request updated.');
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
            Control which document fields merchants can see and edit in their Account Settings.
          </p>

          <ToggleRow
            title="Show PAN Number"
            description="Show or hide PAN Number in the merchant user panel."
            checked={cfg.panField}
            onChange={v => setCfg({ ...cfg, panField: v })}
          />
          <ToggleRow
            title="Show Aadhaar Number"
            description="Show or hide Aadhaar Number in the merchant user panel."
            checked={cfg.aadhaarField}
            onChange={v => setCfg({ ...cfg, aadhaarField: v })}
          />
        </section>

        <section className="settings-card">
          <h2>KYC Controls</h2>
          <ToggleRow
            title="Enable KYC"
            description="Enable the KYC verification feature for merchants."
            checked={cfg.enabled}
            onChange={v => setCfg({ ...cfg, enabled: v })}
          />
          <ToggleRow
            title="Require KYC"
            description="When enabled, KYC becomes mandatory before gateway access."
            checked={cfg.required}
            onChange={v => setCfg({ ...cfg, required: v })}
          />

          <label>KYC price (₹)
            <input type="number" min="0" value={cfg.price} onChange={e => setCfg({ ...cfg, price: Number(e.target.value) })} />
          </label>
          <label>KYC payment UPI ID
            <input value={cfg.paymentUpiId} onChange={e => setCfg({ ...cfg, paymentUpiId: e.target.value })} />
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
            <div className="plan-row" key={x._id}>
              <div>
                <b>{x.user?.name} — {x.status}</b>
                <div>{x.user?.email}</div>
                <div>Payment: {x.paymentStatus} • ₹{x.amount}</div>
                <div>Aadhaar: {x.aadhaarNumber} • PAN: {x.panNumber}</div>
              </div>
              <div className="row-actions">
                {x.paymentStatus === 'PENDING' && (
                  <button onClick={() => api(`/kyc/admin/${x._id}/payment`, { method: 'POST', body: '{}' }).then(load)}>
                    Mark Payment Paid
                  </button>
                )}
                {x.status === 'PENDING_REVIEW' && (
                  <button className="primary" onClick={() => act(x._id, 'verify')}>Verify KYC</button>
                )}
                {x.status !== 'VERIFIED' && (
                  <button className="danger" onClick={() => act(x._id, 'reject')}>Reject</button>
                )}
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
