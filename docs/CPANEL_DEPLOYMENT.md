# OmniUPI cPanel Deployment

## Production domains

- Merchant website/panel: `https://omniupi.in`
- API: `https://api.omniupi.in`
- Admin panel: `https://admin.omniupi.in`

## Merchant panel

1. Enter `frontend/`.
2. Run `npm install`.
3. Build with `VITE_API_BASE_URL=https://api.omniupi.in/api/v1 npm run build`.
4. Upload the contents of `frontend/dist/` to the merchant panel document root for `omniupi.in`.
5. Keep the included `.htaccess` so SPA routes resolve to `index.html`.

## Admin panel

1. Enter `admin/`.
2. Run `npm install`.
3. Build with `VITE_API_BASE_URL=https://api.omniupi.in/api/v1 npm run build`.
4. Upload the contents of `admin/dist/` to the admin panel document root for `admin.omniupi.in`.
5. Keep the included `.htaccess`.

## Backend

Run the backend as a cPanel Node.js application if the hosting plan supports Node.js. Point `api.omniupi.in` to the Node.js application and configure environment variables in cPanel rather than committing secrets to GitHub.

Required production API variables include:

```text
PUBLIC_API_BASE_URL=https://api.omniupi.in
PUBLIC_WEB_BASE_URL=https://omniupi.in
JWT_SECRET=<strong-random-secret>
ADMIN_NAME=Ayush Raj
ADMIN_EMAIL=<your-admin-email>
ADMIN_PASSWORD=<strong-admin-password>
```

The admin account is permanent and does not require a subscription.

## Important

Do not upload `.env` files containing production secrets to GitHub. Build both panels with the correct OmniUPI public API base URL and keep private credentials exclusively server-side.
