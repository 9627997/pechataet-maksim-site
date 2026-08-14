# Production Studio Audit — 2026-08-14

## Scope

Independent audit of the live Studio at `https://печатаетмаксим.рф/studio/` across the full user journey: Create, Configure, Get, and test submission preparation. The audit compares ribbon-only, sticker-only, combined order, empty state, long text, restored project, desktop, and mobile contexts.

## Audit matrix

| Area | Scenarios | Evidence to capture |
| --- | --- | --- |
| Entry and isolation | clean `?product=choose`, ribbon-only, sticker-only, restored project | visible controls, labels, primary product, ghost settings |
| Create | text-only, logo-only, text+logo, long text, empty state | validation, button state, preview, error copy |
| Configure | circle, 80×20 roundrect, logo/text presence, auto/manual, print guides | shape, 2.5 mm bounds, radius, linear layout, effective text size, visibility |
| Responsive UX | desktop and narrow/mobile viewport | overflow, focus, fixed/mobile panel, control reachability, preview parity |
| Get | quantities, add secondary product, independent configuration | order item cards, quantities, payload summary, CTA readiness |
| Reliability | reload, cache, restore, back/forward, clean session | persistence, no runtime errors, no stale controls |
| Submission | prepare a test order only; stop before final submit for confirmation | fields required, payload preview, external side effects |

## Safety boundary

No order will be finally submitted without an explicit confirmation immediately before the irreversible submission action. Passive inspection, filling non-sensitive test data, and reaching the final confirmation state can be completed before that confirmation.

## Finding severity

- **P0:** blocks ordering, loses content, or creates an incorrect production payload.
- **P1:** serious confusion, unavailable core action, or high-risk visual/logic defect.
- **P2:** meaningful friction or inconsistent feedback with a workaround.
- **P3:** polish, copy, alignment, or minor accessibility issue.

## Current production reference

The last verified deployment is main deploy run `31791705273`, with the final cache-busting correction merged via PR #59. The latest rollback tag is `backup-before-roundrect-layout-cache-fix-20260814-101703`.

## Working method

Each scenario will be executed in a clean or explicitly restored session, with observations recorded separately from proposed fixes. The final report will distinguish confirmed defects, UX risks, and improvements.

## User collaboration

The user will independently walk through the same product. After both sides have written their conclusions, the observations will be merged into a prioritized remediation plan rather than changing production during the audit.

## References

No external sources are required for this product-specific audit; findings are based on direct production observation and repository regression contracts.

## References links

None.

## Observation log — Entry screen

The clean `?product=choose` route presents two prominent product cards, **Ленту** and **Стикер**, with concise descriptions and separate creation CTAs. The visual hierarchy is clear and the two products are distinguishable. The page also exposes the step navigation (`01 Создать`, `02 Настроить`, `03 Получить`) before a product is selected, which may be useful as orientation but could also imply that later steps are immediately available. The rendered entry screen itself showed no visible ribbon/sticker settings in the product-choice area. The browser’s prior persisted state was cleared before this observation; the entry page then showed the expected product-choice screen.

Potential audit note: after a clean reset, the main product chooser is visually prominent, but the underlying Create-step controls remain in the document and can appear in extracted/accessibility content. I will verify whether they are actually hidden and unreachable to keyboard users in the next pass.

## Observation log — Ribbon Create

After selecting only **Ленту**, the Create step correctly changed its copy and primary CTA to ribbon-specific wording. Sticker-specific controls were not visible in the rendered panel. With text `Тестовая лента`, the field counter updated to `14 / 60`, the status changed to “Название добавлено”, the CTA became active, and the preview rendered the text across repeated ribbon cells. The preview also displayed the repeated text in the product card, which is consistent with ribbon repetition but should be checked for whether the card communicates “repeat” clearly enough to a first-time user.

The empty state uses a disabled-looking CTA with an explanatory message. The text-only path is understandable and does not require a logo. The rendered preview is visually legible at the tested desktop viewport.

## Observation log — Ribbon Configure

The Configure step clearly identifies the active product as **Лента** and exposes ribbon-specific controls: width (15/20 mm), ribbon color, repeat interval, text styling, auto/manual layout, print color, guides, and centering. No sticker shape/size/material controls were visible in this ribbon-only session, confirming strong product isolation in the rendered UI.

Switching from 15 mm to 20 mm updated the preview label, preview geometry, and repeat interval from 80 mm to 100 mm. The repeat copy remained legible. The interface explains the auto interval with a calculated free-gap value, which is useful but somewhat technical for a first-time buyer; this is a candidate P2 copy/mental-model observation rather than a confirmed defect.

## Observation log — Ribbon Get

Switching to manual layout exposed a vertical text-offset control and preserved the ribbon preview. The Get step then showed ribbon-specific quantity selection and a clearly framed option to add stickers “в том же стиле”, with an explanation that settings can be changed separately. The order summary contained one independent item (`Лента 20 мм`, 100 m), and the preview price displayed `1 270 ₽` before submission. This is a strong unified-order pattern: the secondary product is offered at the moment of purchase rather than mixed into the initial design step.

Audit point to revisit: the quantity selectors are visible even when the current product is not selected for ordering, and the main CTA says “Перейти к отправке” while the price is already shown. I will verify whether the disabled/zero-quantity state and submission form communicate requirements sufficiently.

## Observation log — Combined order and independent sticker settings

From the ribbon Get step, adding stickers created a second order item and updated the displayed price from `1 270 ₽` to `1 970 ₽`. The order summary showed separate cards for `Лента 20 мм` and `Стикер Ø40 мм`, each with its own “Настроить” action.

Opening the sticker card switched Configure to sticker-specific controls: circular/rectangular form, sticker diameter choices, sticker print color, text position on two axes, and sticker-specific auto/manual layout. Ribbon width, ribbon color, and repeat controls were not shown. The sticker content status identified the text as a **product-specific override**, which confirms that the combined flow can create independent item configuration rather than merely duplicating one shared configuration.

The preview continued to show both products simultaneously, which is useful for combined-order context. The distinction between shared source content and product-specific override is technically accurate but may be more complex than necessary in customer-facing copy.

## Observation log — Roundrect sticker in combined Configure

Selecting the rectangular sticker updates the card to `Стикер 80 × 20 мм` and the helper copy explicitly states the 2 mm corner radius and shared crop/tracing behavior. The preview shows the sticker below the ribbon, with the sticker text in a horizontal, ribbon-like composition. The ribbon remains visually present but its controls are not mixed into the sticker control panel. The sticker panel exposes only sticker-relevant auto/manual and text-position controls.

The combined preview is useful for comparing both products, although the two safe guides and multiple object labels create a dense visual field. This may warrant a P2 review for preview hierarchy and “which product am I editing?” clarity on smaller screens.

## Observation log — Combined Get after roundrect

Returning to Get preserved both items: `Лента 20 мм` and `Стикер 80 × 20 мм · радиус 2 мм`, each with its own configuration action. The preview labels and item summary remained synchronized with the selected roundrect variant. In this state the price area displayed **«Требуется расчёт»** rather than the previously observed numeric estimate, despite quantities being present. This is not yet classified as a defect because the flow may intentionally require an external calculation for this exact combination, but it is a high-priority audit question: the user should understand why a numeric estimate is available in one state and unavailable after adding/configuring the second product.

## Observation log — Order form preparation

Opening the order form showed a concise combined payload summary: `Лента 20 мм · 100 м` plus `Стикер 80 × 20 мм · радиус 2 мм: 100 шт.`. It also explicitly explained that the roundrect price requires an individual calculation. The form asks for a name, one contact channel (phone or Telegram), and an optional comment. It offers both **Отправить заявку** and **Скачать копию**.

The form copy provides a clear expectation: after sending, the customer receives a request number and Максим contacts them via the chosen channel. This is the irreversible external side-effect boundary. The audit is paused before filling/submitting any real contact information; a test submission requires the user’s confirmation and either test-safe contact data or explicit approval to use a provided test channel.

## Diagnostic findings — Why the text does not fill the rectangle

The 2.5 mm printable geometry itself is not the source of the extra inner zone. For `roundrect-80x20`, the geometry correctly computes an outer 80×20 mm rectangle and a printable rectangle inset by 2.5 mm on every side, therefore the printable area is 75×15 mm. Its printable radius is intentionally zero because the 2 mm outer corner radius is smaller than the 2.5 mm print margin; this produces a rectangular safe/print guide inside the rounded outer sticker.

The current visual under-fill is caused by downstream layout and control contracts:

1. In the text-only roundrect path, the text box can use the printable bounds, but the font is still chosen from a generic preferred size and the UI slider is shared with other products and constrained to `16..64`. The runtime’s special 4px minimum is only an overflow fallback; it is not a user-facing “fill the available area” control.
2. In the logo+text path, the layout reserves `72%` of the printable width for the logo, adds a `4%` logo/text gap, and then applies another `0.94` multiplier to the remaining text width. These are composition heuristics, not the 2.5 mm print boundary. They intentionally create an inner composition zone.
3. The calculation measures a text bounding rectangle from font metrics, while the actual SVG `<text>` element renders glyph ink with font-specific side bearings, ascender/descender whitespace, and `dominant-baseline: middle`. Therefore a mathematically full textBox does not mean the visible glyph ink touches the box edges.
4. Manual sticker layout currently exposes generic horizontal/vertical offsets but does not provide a roundrect-specific “use printable area” or scale-to-printable-width contract. A user can move the current text box, but cannot directly control the actual ink footprint against the 75×15 mm boundary.
5. The current regression tests assert margins, radius, validity, and horizontal logo/text alignment, but do not assert actual text ink bounds or that manual/auto text can intentionally reach the printable area.

Conclusion: the 2.5 mm fields should remain the hard print boundary, but the current safe guide/composition heuristics must not be presented as if they were the only permissible content zone. The correction should expose a distinct printable-area control contract: text and logo may be positioned/scaled anywhere inside the exact printable bounds, while only the physical 2.5 mm margin remains non-printable.

## Confirmed primary under-fill cause

A more specific issue is present in `fitTextToArea`: its scale calculation begins with `Math.min(1, ...)`. That means the algorithm only shrinks text to fit; it never enlarges a short text above the product’s preferred font size. For a short label inside a 75×15 mm printable rectangle, the preferred roundrect size can therefore leave a large empty area even though the text could grow safely.

The visible roundrect guide is created as a separate overlay rectangle using the exact printable bounds. It does not impose another inset on the text. The outer stroke is only a visual frame. Therefore, the perceived extra zone is primarily the auto-layout/font-size policy, not an additional 2.5 mm geometry margin.

A second confirmed source is the shared UI/runtime font-size contract: the HTML slider is `min="16" max="64"`, while `normalizeProductStyle` clamps persisted values to the same range. This prevents a user from enlarging short roundrect text enough to use the available 75×15 mm space. The roundrect-specific `minFontSize: 4` only protects long text from overflow; it does not provide the missing upper range or a fill action.
