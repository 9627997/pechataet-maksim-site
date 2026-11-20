# Calc → Studio → Order: server-issued quoteId (implementation contract)

Status: **draft PR #203 / phase 2 implemented for gated server API, not enabled in production**. GitHub Issue #201.

## Security invariants

- Only the private PHP Pricing 2 engine decides the current customer price. Pricing 3 stays shadow-only.
- A 192-bit opaque token refers to an immutable private record, stored outside web-root, expires after 30 minutes and is invalidated when the source pricing snapshot changes.
- Only server-canonicalized items reach the pricing engine and token store. Order quantities and variant geometry have exact structural checks; final combinations are validated by the pricing engine.
- The quote records contain only the canonical basket, public preliminary amount, issue/expiration timestamps and private snapshot SHA-256, not contacts or procurement data.
- Browser-supplied totals, markups, supplier costs or formulas cannot authorize a quote or an order.
- Rate limits, same-origin checks, JSON content type and size limit from the existing gateway apply to all token operations.
- Order submission and production remain disabled: every response has `canSubmitOrder:false`. Studio cannot trust token price until its basket is reconciled by the order receiver.

## Phase 2 API, protected by private config

The live `POST /api/calc/` request `{"orderItems":[...]}` and exact four-field response remain **unchanged**. The current production private config does not have `quote_tokens_enabled`, so the new operations fail closed.

Only when `config.php` outside web-root explicitly sets `quote_tokens_enabled=true`:

- `POST /api/calc/` `{"operation":"issue","orderItems":[...]}` validates the full 1–6 line basket (max 3 ribbon + 3 sticker), requotes using server Pricing 2 and returns `status:quote_issued`, `quoteId`, `expiresAt`, `finalClientPrice`, `currency:RUB`, `canSubmitOrder:false`.
- `POST /api/calc/` `{"operation":"resolve","quoteId":"<48 hex chars>"}` verifies token existence, expiration and current snapshot SHA and returns `status:quote_resolved`, immutable canonical `orderItems`, public amount, expiration, currency and `canSubmitOrder:false`.
- Invalid token → 404; expired → 410; stale snapshot → 409; structurally invalid → 422; unavailable private engine/storage → 503. No private exception detail in HTTP.
- Quotes are stored under `private/pm-calc/quote-tokens/` with directory permissions 0700 and records 0600. Public-source PHP token classes contain no confidential formulas and are deployed by an explicit two-file allowlist. Never publish the token records.
- URL must not contain price or internal calculations; a same-origin Studio link may transport only the opaque token fragment. Avoid using the token in analytics/referrers.

## Physical and UX constraints to solve before enabling

Studio presently supports artwork for one ribbon and one sticker; Calc can quote up to 3+3. Studio quantity presets do not cover arbitrary Calc quantities. Tokens **do not** authorize losing extra lines, replacing quantities with presets, or processing automatically. The next increment must:

1. Render and preserve every server-resolved line in Studio, including 3+3, without collapsing distinct products to one artwork or one quantity.
2. Reconcile canonical basket, variant IDs, quantities and snapshot in `/api/orders/` with a fresh server check. Do not accept an order if Studio changed its basket, if the snapshot expired/changed, or if technological acceptance is missing.
3. Retain contact, idempotency, SVG production files and manual confirmation. Add tests for replay, invalid tokens, expiration, stale snapshots, network errors and real PNG/SVG artifacts.
4. Perform explicit mobile 390px, desktop 1440px, full CI and production shadow/stage validation before any feature flag is enabled.

## Validation and release

`tests/php/quote-token-store.php` tests token storage, expiry and snapshot binding. `tests/php/quote-token-api.php` tests canonicalization, 3+3, price obtained from server-only engine and tampering. `scripts/check-quote-token-contract.mjs` parses these PHP files, checks the gateway flag and deployment allowlist, invokes PHP lint and runtime tests when PHP CLI exists. `npm run check:pr` executes it.

This is **only** a gated backend capability. Do not merge as “complete order flow”, and do not enable the private flag until end-to-end server-reconciled ordering exists.
