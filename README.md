# OmniUPI

OmniUPI is an independent UPI payment-gateway platform with merchant and administrator panels.

## Production domains

- Website / merchant panel: https://omniupi.in
- API: https://api.omniupi.in
- Admin panel: https://admin.omniupi.in
- API documentation: https://omniupi.in/docs

## Project structure

- `frontend/` — OmniUPI merchant-facing web application
- `admin/` — OmniUPI administrator panel
- `backend/` — OmniUPI API and server-side services
- `docs/` — OmniUPI architecture, deployment and API documentation

## API base URL

Production API requests use:

`https://api.omniupi.in/api/v1`

The backend also exposes a health endpoint at:

`https://api.omniupi.in/health`

## Admin access

The administrator is bootstrapped securely from hosting-provider environment variables. Admin accounts are permanent and do not require a subscription or plan. Never commit the admin password or JWT secret to GitHub.

## Website navigation

The public landing-page footer includes a direct **Blog** link to `/blog.html`. The public blog listing, article pages, related-article cards, and admin Blog Manager are deployed from this repository.

## Security

Never commit API secrets, OAuth client secrets, tokens, webhook secrets, or production credentials.

Payment verification integrations must use authorized provider APIs/OAuth and server-side verification. Do not collect merchant passwords or bypass provider security controls.
