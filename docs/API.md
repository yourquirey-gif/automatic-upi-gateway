# OmniUPI API Documentation

**Production API:** `https://api.omniupi.in`

**Base path:** `https://api.omniupi.in/api/v1`

**Website:** `https://omniupi.in`

**Admin panel:** `https://admin.omniupi.in`

## Health

`GET https://api.omniupi.in/health`

Returns the API health and OmniUPI service identity.

## API information

`GET https://api.omniupi.in/api/v1`

Returns the API name, version and canonical OmniUPI URLs.

## Authentication

### Register merchant

`POST /auth/register`

```json
{
  "name": "Merchant Name",
  "email": "merchant@example.com",
  "password": "strong-password"
}
```

### Login

`POST /auth/login`

```json
{
  "email": "merchant@example.com",
  "password": "strong-password"
}
```

Use the returned JWT as:

`Authorization: Bearer <token>`

## Merchant API areas

- `/merchants` — merchant configuration and credentials
- `/orders` — payment/order operations
- `/account` — account information
- `/subscriptions` — merchant plans and subscription operations
- `/kyc` — KYC operations
- `/kyc-config` — KYC configuration
- `/videos` — merchant videos/settings
- `/support` — support operations

## Admin API areas

Admin endpoints are under `/admin` and require a valid JWT whose role is `admin`.

- `/admin/stats`
- `/admin/users`
- `/admin/orders`
- `/admin/plans`
- `/admin/settings`
- `/admin/admins`
- `/admin/kyc`
- `/admin/support/tickets`

## Webhooks and payment verification

Payment verification must use authorized provider APIs/OAuth and server-side verification. Never trust a client-provided payment-success flag. Webhook requests should be verified for signature and timestamp and processed idempotently.

## Admin account

OmniUPI administrators are bootstrapped through backend environment variables. The administrator account is permanent and does not require a paid plan or subscription.

Never put `ADMIN_PASSWORD`, `JWT_SECRET`, OAuth secrets, Gmail credentials or webhook secrets in frontend code or public documentation.
