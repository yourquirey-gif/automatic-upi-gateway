(() => {
  const footerHtml = `
    <footer class="home-legal-footer" data-omni-legal-footer>
      <div class="home-legal-inner">
        <section class="omni-purpose" aria-labelledby="omni-purpose-title">
          <div class="purpose-kicker">PURPOSE OF OMNIUPI</div>
          <h2 id="omni-purpose-title">UPI payment infrastructure for modern businesses.</h2>
          <p>OmniUPI is a merchant payment platform designed to help businesses connect supported UPI payment accounts, create payment links and checkout experiences, accept customer payments, and monitor transaction activity from one dashboard.</p>
          <div class="purpose-grid">
            <article class="purpose-card"><strong>Connect &amp; manage</strong><span>Connect supported merchant payment accounts and manage payment settings from one place.</span></article>
            <article class="purpose-card"><strong>Accept payments</strong><span>Create payment links and customer checkout flows for collecting UPI payments.</span></article>
            <article class="purpose-card"><strong>Track activity</strong><span>View transaction status, payment activity and merchant analytics through the dashboard.</span></article>
            <article class="purpose-card"><strong>Account information</strong><span>Basic account information is used to create, secure and operate your OmniUPI merchant account and provide the requested services.</span></article>
          </div>
          <p class="purpose-note">We request account information only for authentication, account management, security and the OmniUPI features you choose to use. Details about collection, use, storage and sharing of personal and account information are provided in our Privacy Policy.</p>
        </section>
        <div class="legal-footer-grid">
          <div class="legal-footer-brand"><div class="legal-footer-logo"><span>ϟ</span> OmniUPI</div><p>Modern UPI payment infrastructure for businesses.</p></div>
          <div class="legal-footer-links-wrap"><div class="legal-footer-title">LEGAL &amp; SUPPORT</div><nav class="legal-footer-links" aria-label="Legal and support links">
            <a href="/blog.html">Blog</a><a href="/privacy.html">Privacy Policy</a><a href="/terms.html">Terms &amp; Conditions</a><a href="/refund.html">Refund &amp; Cancellation</a><a href="/shipping.html">Shipping &amp; Delivery</a><a href="/contact.html">Contact Us</a>
          </nav></div>
        </div>
        <div class="legal-footer-bottom"><span>© 2026 OmniUPI. All rights reserved.</span><span>Secure • Reliable • Built for businesses</span></div>
      </div>
    </footer>`;

  function mount() {
    const landing = document.querySelector('.landing');
    if (!landing) return false;

    // Always keep exactly one footer on the landing page.
    landing.querySelectorAll('[data-omni-legal-footer]').forEach(el => el.remove());
    landing.querySelectorAll(':scope > .footer').forEach(el => el.remove());

    landing.insertAdjacentHTML('beforeend', footerHtml);
    return true;
  }

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }
})();
