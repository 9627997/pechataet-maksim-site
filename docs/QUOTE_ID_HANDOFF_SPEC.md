# Calc → Studio → Order: server-issued quoteId (implementation contract)

Status: implementation phase 1 in a **draft** branch, not published or connected to a public route. GitHub Issue #201.

## Security invariant

- Only the private PHP pricing engine decides the customer price. Clients cannot submit price coefficients, costs or unit prices as authoritative fields.
- `quoteId` is an opaque 192-bit random bearer token and refers to an immutable server record outside web-root. It does not encode pricing details and expires in 30 minutes.
- Record binds canonical entire `orderItems[]` (up to 3 ribbon and 3 sticker lines), the public preliminary amount and the current private pricing snapshot SHA-256. It contains no customer contact data.
- Resolving a token with a missing, expired or changed snapshot must fail; a stale or edited basket must be re-quoted server-side.
- Use POST JSON to resolve; never use `localStorage` price or URL amount as an authority. A URL fragment can transport only the opaque token.
- No production order is automatically accepted: before final application `/api/orders/` must match its validated basket to the server record, and preserve the current manual confirmation policy.

## Scope of this draft

`api/calc/PmQuoteTokenStore.php` implements encrypted-randomness-grade token generation, private file storage, TTL and snapshot invalidation. It is deliberately not in the public deployment allowlist and is not loaded by the live gateway. CLI test `tests/php/quote-token-store.php` exercises the token store. The next PR increment must wire issuance and resolution into the protected `/api/calc/` API, update its public response contract and tests, then implement Studio's multi-line handoff mapping. No quotes or orders are accepted differently until this is complete.

## Existing Studio constraint

Studio currently produces at most one ribbon and one sticker production artwork, and its preset quantities do not match arbitrary Calc 5m/50pcs steps. A complete 3+3 basket must be preserved separately, never silently replaced with Studio presets or marked price-verified before server reconciliation.
