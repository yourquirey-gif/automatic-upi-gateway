# Merchant Panel

## cPanel deployment

1. On a Node.js-enabled development environment run `npm install` and `npm run build`.
2. Upload the contents of `dist/` to the document root of the merchant-panel domain/subdomain.
3. Keep the generated `.htaccess` from `dist/` if your deployment copies public assets automatically; otherwise copy `public/.htaccess` to the document root.
4. Configure `VITE_API_BASE_URL` before building.

Do not place API secrets in Vite environment variables; `VITE_*` values are public to browser users.
