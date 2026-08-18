import React from 'react';
import './home-legal-footer.css';

const links = [
  ['Privacy Policy', '#privacy'],
  ['Terms & Conditions', '#terms'],
  ['Refund & Cancellation', '#refund'],
  ['Shipping & Delivery', '#shipping'],
  ['Contact Us', '#contact'],
];

export default function HomeLegalFooter() {
  return <footer className="home-legal-footer">
    <div className="home-legal-inner">
      <section className="omni-purpose">
        <div className="purpose-kicker">PURPOSE OF OMNIUPI</div>
        <h2>Built to simplify UPI payments for modern businesses.</h2>
        <p>OmniUPI provides UPI payment infrastructure and merchant tools that help businesses connect payment accounts, create payment links, accept customer payments and manage transaction activity from one place.</p>
        <p>Our platform is designed to make payment workflows simpler, faster and easier to manage, while giving merchants clear visibility into their payment operations.</p>
      </section>

      <div className="legal-footer-grid">
        <div className="legal-footer-brand">
          <div className="legal-footer-logo"><span>ϟ</span> OmniUPI</div>
          <p>Modern UPI payment infrastructure for businesses.</p>
        </div>
        <div className="legal-footer-links-wrap">
          <div className="legal-footer-title">LEGAL &amp; SUPPORT</div>
          <nav className="legal-footer-links" aria-label="Legal and support links">
            {links.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
          </nav>
        </div>
      </div>

      <div className="legal-footer-bottom">
        <span>© 2026 OmniUPI. All rights reserved.</span>
        <span>Secure • Reliable • Built for businesses</span>
      </div>
    </div>
  </footer>;
}
