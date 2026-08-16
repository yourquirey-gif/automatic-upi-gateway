import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from './api';
import './password.css';

export default function PasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ current:false, next:false, confirm:false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setMessage(''); setError('');
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('New password and confirm password do not match.');
    if (newPassword === currentPassword) return setError('New password must be different from your current password.');
    setLoading(true);
    try {
      const data = await api('/account/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setMessage(data.message || 'Password changed successfully.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      setError(e.message || 'Unable to change password.');
    } finally { setLoading(false); }
  };

  const field = (key, label, value, setter, placeholder='') => (
    <label className="password-field">
      <span>{label}</span>
      <div className="password-input-wrap">
        <input
          type={show[key] ? 'text' : 'password'}
          value={value}
          onChange={e => setter(e.target.value)}
          placeholder={placeholder}
          autoComplete={key === 'current' ? 'current-password' : 'new-password'}
          minLength={8}
          required
        />
        <button type="button" className="password-eye" aria-label={`Show ${label}`} onClick={() => setShow(s => ({...s,[key]:!s[key]}))}>
          {show[key] ? <EyeOff size={21}/> : <Eye size={21}/>} 
        </button>
      </div>
    </label>
  );

  return (
    <div className="password-page">
      <header className="password-topbar">
        <button className="password-menu" onClick={() => { window.location.hash = 'dashboard'; }} aria-label="Back to dashboard"><ArrowLeft size={22}/></button>
        <div className="password-brand"><span>ϟ</span> AutoGateway</div>
        <div className="password-spacer" />
        <div className="password-security"><LockKeyhole size={16}/> Secure</div>
      </header>

      <main className="password-main">
        <button className="password-back" onClick={() => { window.location.hash='dashboard'; }}><ArrowLeft size={17}/> Dashboard</button>
        <section className="password-card">
          <div className="password-icon"><KeyRound size={28}/></div>
          <h1>Update Password</h1>
          <p className="password-subtitle">Use a strong password for better security</p>
          {message && <div className="password-alert success"><CheckCircle2 size={19}/><span>{message}</span></div>}
          {error && <div className="password-alert error"><AlertCircle size={19}/><span>{error}</span></div>}
          <form onSubmit={submit}>
            {field('current','Current Password',currentPassword,setCurrentPassword)}
            {field('next','New Password',newPassword,setNewPassword)}
            {field('confirm','Confirm Password',confirmPassword,setConfirmPassword)}
            <button className="password-submit" disabled={loading} type="submit">{loading ? 'Updating…' : 'Change Password'}</button>
          </form>
          <div className="password-hint">Password must contain at least 8 characters.</div>
        </section>
      </main>
    </div>
  );
}
