import React from 'react';
import './home-legal-footer.css';

const links = [
  ['Privacy Policy', '/privacy.html'],
  ['Terms & Conditions', '/terms.html'],
  ['Refund & Cancellation', '/refund.html'],
  ['Shipping & Delivery', '/shipping.html'],
  ['Contact Us', '/contact.html'],
];

export default function HomeLegalFooter() {
  return <footer className="home-legal-footer">
    <div className="home-legal-inner">
      <section className="omni-purpose" aria-labelledby="omni-purpose-title">
        <div className="purpose-kicker">PURPOSE OF OMNIUPI</div>
        <h2 id="omni-purpose-title">UPI payment infrastructure for modern businesses.</h2>
        <p>OmniUPI is a merchant payment platform designed to help businesses connect supported UPI payment accounts, create payment links and checkout experiences, accept customer payments, and monitor transaction activity from one dashboard.</p>
        <div className="purpose-grid">
          <article className="purpose-card"><strong>Connect &amp; manage</strong><span>Connect supported merchant payment accounts and manage payment settings from one place.</span></article>
          <article className="purpose-card"><strong>Accept payments</strong><span>Create payment links and customer checkout flows for collecting UPI payments.</span></article>
          <article className="purpose-card"><strong>Track activity</strong><span>View transaction status, payment activity and merchant analytics through the dashboard.</span></article>
          <article className="purpose-card"><strong>Account information</strong><span>Basic account information is used to create, secure and operate your OmniUPI merchant account and provide the requested services.</span></article>
        </div>
        <p className="purpose-note">We request account information only for authentication, account management, security and the OmniUPI features you choose to use. Details about collection, use, storage and sharing of personal and account information are provided in our Privacy Policy.</p>
      </section>
      <div className="legal-footer-grid"><div className="legal-footer-brand"><div className="legal-footer-logo"><span>ϟ</span> OmniUPI</div><p>Modern UPI payment infrastructure for businesses.</p></div><div className="legal-footer-links-wrap"><div className="legal-footer-title">LEGAL &amp; SUPPORT</div><nav className="legal-footer-links" aria-label="Legal and support links">{links.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</nav></div></div>
      <div className="legal-footer-bottom"><span>© 2026 OmniUPI. All rights reserved.</span><span>Secure • Reliable • Built for businesses</span></div>
    </div>
  </footer>;
}
