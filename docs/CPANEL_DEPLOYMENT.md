# cPanel Deployment

## Merchant panel

1. Enter `frontend/`.
2. Run `npm install`.
3. Run `npm run build`.
4. Upload the contents of `frontend/dist/` to the merchant panel document root.
5. Keep the included `.htaccess` so SPA routes resolve to `index.html`.

## Admin panel

1. Enter `admin/`.
2. Run `npm install`.
3. Run `npm run build`.
4. Upload the contents of `admin/dist/` to the admin panel document root.
5. Keep the included `.htaccess`.

## Backend

Run the backend as a cPanel Node.js application if the hosting plan supports Node.js. Configure environment variables in cPanel rather than committing secrets to GitHub.

## Important

Do not upload `.env` files containing production secrets to GitHub. Build the frontend with the correct public API base URL and keep private credentials exclusively server-side.
