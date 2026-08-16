import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, FileText, KeyRound, Mail, MapPin, Phone, Save, UserRound } from 'lucide-react';
import { api } from './api';
import './kyc.css';

export default function AccountPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [ip, setIp] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const d = await api('/account');
      setData(d);
      setForm({
        name: d.user?.name || '',
        mobile: d.user?.mobile || '',
        companyName: d.user?.companyName || '',
        panNumber: d.user?.panNumber || '',
        aadhaarNumber: d.user?.aadhaarNumber || '',
        location: d.user?.location || '',
        whitelistedIps: d.user?.whitelistedIps || []
      });
    } catch (e) {
      setMsg(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const d = await api('/account', { method: 'PUT', body: JSON.stringify(form) });
      setData(v => ({ ...v, user: d.user }));
      setMsg('Account settings saved successfully.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addIp = () => {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      return setMsg('Enter a valid IPv4 address.');
    }
    if (!form.whitelistedIps.includes(ip)) {
      setForm({ ...form, whitelistedIps: [...form.whitelistedIps, ip] });
    }
    setIp('');
  };

  if (!data) return <div className="kyc-page"><div className="kyc-card">Loading account…</div></div>;

  const settings = data.settings || {};

  return (
    <div className="kyc-page">
      <div className="kyc-wrap account-settings-wrap">
        <button className="kyc-back" onClick={() => { location.hash = 'dashboard'; }}>
          <ArrowLeft size={18} /> Dashboard
        </button>

        <section className="kyc-section account-card">
          <div className="account-titlebar">
            <UserRound size={25} />
            <h1>Personal Information</h1>
          </div>

          {msg && <div className="kyc-message">{msg}</div>}

          <div className="account-fields">
            <Field label="Instance ID" value={data.user?._id || ''} readOnly icon={<KeyRound size={20} />} />
            <Field label="Mobile Number *" value={form.mobile} icon={<Phone size={20} />} onChange={v => setForm({ ...form, mobile: v.replace(/\D/g, '').slice(0, 10) })} />
            <Field label="Email Address" value={data.user?.email || ''} readOnly icon={<Mail size={20} />} />
            <Field label="Full Name *" value={form.name} icon={<UserRound size={20} />} onChange={v => setForm({ ...form, name: v })} />
            <Field label="Company Name *" value={form.companyName} icon={<Building2 size={20} />} onChange={v => setForm({ ...form, companyName: v })} />

            {settings.showPanField && (
              <Field
                label="PAN Number"
                value={form.panNumber}
                icon={<FileText size={20} />}
                onChange={v => setForm({ ...form, panNumber: v.toUpperCase().slice(0, 10) })}
              />
            )}

            {settings.showAadhaarField && (
              <Field
                label="Aadhaar Number"
                value={form.aadhaarNumber}
                icon={<FileText size={20} />}
                onChange={v => setForm({ ...form, aadhaarNumber: v.replace(/\D/g, '').slice(0, 12) })}
              />
            )}

            <Field label="User ID" value={data.user?.userId || data.user?.merchantId || ''} readOnly icon={<KeyRound size={20} />} />
            <Field label="Location" value={form.location} icon={<MapPin size={20} />} onChange={v => setForm({ ...form, location: v })} />
          </div>

          <div className="kyc-field ip-field">
            <span>Whitelisted IPs</span>
            <div className="ip-add-row">
              <input value={ip} onChange={e => setIp(e.target.value)} placeholder="Enter IP (e.g. 148.135.136.111)" />
              <button type="button" className="ip-add-btn" onClick={addIp}>Add</button>
            </div>
          </div>

          {form.whitelistedIps?.length > 0 && (
            <div className="ip-list">
              {form.whitelistedIps.map(x => (
                <span className="ip-chip" key={x}>
                  {x}
                  <button type="button" onClick={() => setForm({ ...form, whitelistedIps: form.whitelistedIps.filter(v => v !== x) })}>×</button>
                </span>
              ))}
            </div>
          )}

          <div className="account-save-row">
            <button className="kyc-submit account-save" onClick={save} disabled={saving}>
              <Save size={18} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, readOnly, icon }) {
  return (
    <label className="kyc-field account-field">
      <span>{label}</span>
      <div className="account-input-wrap">
        <input
          value={value || ''}
          readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          className={readOnly ? 'account-readonly' : ''}
        />
        <span className="account-field-icon">{icon}</span>
      </div>
    </label>
  );
}
