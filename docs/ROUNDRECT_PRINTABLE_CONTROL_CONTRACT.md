# Roundrect Printable Control Contract

## Problem

The current Studio correctly computes the 80×20 mm outer shape and the 2.5 mm printable inset, but the visible text can occupy a smaller composition zone because auto-layout reserves logo space, a logo/text gap, a text-width safety multiplier, and generic font-size limits. The UI labels the guide as a safe area, which can be interpreted as a second hidden boundary.

## Required meaning of the zones

The outer shape is 80×20 mm with a 2 mm radius. The only non-printable boundary is the 2.5 mm inset on every side. The resulting printable rectangle is 75×15 mm. The current rectangular safe guide with zero radius is a representation of that printable rectangle, not an additional content restriction.

> Any text glyph ink and any logo ink must remain inside the 75×15 mm printable rectangle. No second invisible padding zone may be applied unless it is explicitly labelled as a user-selected composition gap.

## Auto mode

Auto mode should choose a comfortable initial composition: when a logo exists, its preserved-aspect box should use the maximum available printable height, while leaving only the explicit logo/text gap and enough printable width for the text. The text should then be fitted as large as possible in the remaining printable width and height. For text-only content, the initial text scale should be derived from the printable rectangle, with font-metric compensation so the visible glyph ink can approach the selected printable width/height without crossing bounds. The default must not use a hidden 72%/4%/94% composition rule; the gap is the only intentional internal spacing.

The auto layout may choose a conservative default for readability, but it must not present that default as the maximum printable area. A clear “Заполнить печатную область” or equivalent action should maximize the selected content within the actual printable bounds.

## Manual mode

Manual mode must provide direct controls for:

- text scale relative to the printable rectangle;
- horizontal and vertical position clamped to the printable bounds;
- logo scale and position when a logo exists;
- independent left/right placement of either element when both elements exist;
- explicit logo/text gap when both elements exist;
- a reset action that returns to the selected auto composition or to a “fill printable area” composition.

The sliders’ ranges should be expressed in meaningful product terms rather than generic `-100..100` offsets. Any clamping should be visible through the guide or a status message, not silently shrink the object.

## Ink-aware validation

The SVG `<text>` element’s actual ink bounds must be measured after font loading. The validation contract must distinguish:

1. layout box bounds;
2. glyph ink bounds;
3. printable bounds;
4. preview-only overlays.

The production SVG must be considered valid only when actual glyph ink bounds and logo bounds are inside printable bounds. Font side bearings and ascender/descender whitespace must not be mistaken for user-visible ink area.

## Regression requirements

The test suite must assert, for roundrect text-only and logo+text:

- outer shape is 80×20 mm with radius 2 mm;
- printable bounds are exactly 2.5 mm inset on each side;
- text ink bounds are inside printable bounds;
- “fill printable area” reaches the expected printable width/height tolerance;
- manual changes remain independently configurable for sticker and ribbon;
- no hidden safe guide or stale cache asset changes the production result.

## Rollback

Implementation must be staged behind a backup tag and deployed only after local, CI, and live verification. No production order submission is required for geometry-only changes.
