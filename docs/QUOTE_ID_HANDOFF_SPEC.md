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


## Phase 3 (draft) — browser handoff and receiver reconciliation

Scope: feature-flagged implementation, NOT enabled in production.

- Calc: after a successful legacy estimate, the Studio action tries `POST /api/calc/` `operation:issue` with the entire current basket. Only the opaque token (not the total) enters the Studio URL **fragment**. If the private feature flag is disabled, the original manual route remains available. If an unexpected server error occurs, the user is explicitly warned before opening the legacy editor.
- Studio: `quote-handoff.js` removes the token fragment from the URL and calls `operation:resolve`. The page shows all 1–6 source line items and never silently substitutes the old Studio quantities or collapses a 3+3 cart into one ribbon and sticker line. The linked basket is kept only in session memory and submitted unchanged alongside Studio's existing preview files.
- The artwork engine still produces **one SVG reference per product type**, NOT separate press-ready graphics per line. The UI and business notification explicitly disclose this. Individual print assets / physical feasibility for all lines **require manual verification**. The server stores the actual complete canonical basket and the preliminary server price separately from Studio's reference preview.
- Order receiver: when a quoteId is supplied, the private Pricing 2 service verifies token TTL, private snapshot + model fingerprint, and re-quotes the full customer basket. The submitted `orderItems` must match the immutable record exactly; malformed, stale, changed or reused-by-other-request tokens fail closed. The token is bound to one `requestId` (same-ID retry allowed), while the existing receiver order idempotency is preserved.
- Quotes never enable automatic production. Even verified preliminary totals are recorded under `linkedBasket.verifiedPreliminaryAmount`, while the order's `pricing.amount` stays null and `requiresIndividualCalculation` stays true. They do not replace manual commercial and design approval. Legacy orders without a token remain unchanged.
- The public deployment includes only the two safe QuoteToken classes and the safe OrderQuoteVerifier class, not the private catalog, pricing engine or token records.

Security gaps and release blockers: full 3+3 per-line editable artwork is **not implemented**; token renewal after 30 min may require re-quoting in Calc; private token-file garbage collection, quote invalidation on PHP model update, cross-browser end-to-end tests, webhook/ZIP reconciliation and exact production V4 compatibility must be tested before enabling the feature flag. Do not merge or advertise phase 3 as a complete automated 3+3 print-production editor.

## Bounded private token maintenance (20 Nov 2026)

`PmQuoteTokenStore::pruneExpired()` removes only expired hashed quote records and their matching hashed claim files from the protected private storage. It scans at most 256 token records per pass (configurable 1–1024), never removes active tokens and grants malformed records a 2×TTL grace period. Successful token issuance samples maintenance approximately once per 16 issues, with no public endpoint or scheduled secret. A failed cleanup does not break issuance. CLI tests cover active/expired claims and malformed records. This is a best-effort capacity measure, not a substitute for production monitoring: verify actual directory growth and permission boundaries in staging before activating the private flag.

Direct resolution of an expired token uses the same cleanup helper and removes its associated claim if one exists. This prevents orphan claim files when an expired token is presented before the periodic maintenance scan. The PHP regression test covers both cleanup paths.

## Per-line artwork receiver staging (draft, not live; 20 November 2026)

Draft commits b2f2a7f and 6d0b7e2 extend `/api/orders/` *without altering* existing legacy artwork keys. An optional `artifactsByItemId` object is accepted only alongside a server-verified `quoteId`. Each key must exactly match one canonical basket `itemId`; no unknown IDs or more than six entries. Each supplied item contains exactly `previewSvg`, `printSvg`, `previewPng`, all mandatory and checked using the existing SVG/PNG validators. The print SVG root must declare physical dimensions in mm. Sticker width and height must match its canonical geometry; ribbon height must equal width of ribbon. No client-supplied ID is used as a filename: the server emits `line-01-preview.svg`, `line-01-print.svg`, `line-01-preview.png`, etc., into the private order archive and ZIP.

**Important limitations:** this is a guarded receiver capability only. The Studio UI still emits the existing one-ribbon/one-sticker sample files; it does NOT yet create independent per-item editor states or populate `artifactsByItemId`. Empty/missing per-item artwork does not imply print readiness, and the preliminary price still requires manual confirmation. Current print-format validation checks physical root dimensions, not visual content identity, bleed, print-margin safety, firmware/RIP compatibility, font conversion or image resolution. Those require production QA. Existing quantity presets must never replace canonical Calc quantities. No publication, pricing switch, production flag or merge is authorized by these commits.

**Next:** implement independent item-level editor/workspace, full artifact mapping and UX, then actual PHP runtime negative tests and end-to-end ZIP/notification testing before considering the feature flag. Run full GitHub CI and stage regression before activation.

### Client-side item attachment transport (draft)

`studio/assets/js/quote-handoff.js` now exposes `registerItemArtwork(itemId, {previewSvg, printSvg, previewPng})` and `clearItemArtwork(itemId)`. It accepts only `itemId` from the resolved canonical quote basket; payload augmentation adds `artifactsByItemId` only for items explicitly registered, preserving the original one-ribbon/one-sticker reference files. The registration interface is deliberately **not automatically fed from generic Studio previews**: duplicating a single preview across distinct SKUs would be a critical production error.

**Current partial UI:** the linked quote list offers a manual per-item capture button. The existing Studio canvas must first be configured to the selected canonical ribbon/sticker dimensions, colors and repeat; `app.js` serializes the current SVG/PNG and explicitly registers it for that itemId. A user can change the canvas and capture another line; snapshots cannot yet be reopened as an independent per-item editing workspace. **Not finished:** item-specific persistent editing sessions, production-grade multi-item design QA and reliable per-line restoration. Registration validates only the client file types/shape; PHP checks SVG, PNG and physical sizes, and the final production review must still verify visual contents, artwork uniqueness, text fits and actual print compatibility. No order may be marked production-ready solely because the optional artwork map is present.
