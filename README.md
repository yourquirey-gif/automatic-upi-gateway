# Automatic UPI Gateway

Independent payment-gateway platform with merchant and admin panels.

## Project structure

- `frontend/` — merchant-facing web application
- `admin/` — administrator panel
- `backend/` — API and server-side services
- `docs/` — integration documentation
- `.env.example` — environment variable template

## Security

Never commit API secrets, OAuth client secrets, tokens, webhook secrets, or production credentials.

Payment verification integrations must use authorized provider APIs/OAuth and server-side verification. Do not collect merchant passwords or bypass provider security controls.
