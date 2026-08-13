# Alternative homepage prototype

This prototype is intentionally isolated from the production landing page. It lives under `prototypes/homepage-alternative/` and does not replace `index.html`, `css/`, `js/`, or any Studio runtime files.

## Local preview

From the repository root:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173/prototypes/homepage-alternative/
```

## Current scope

The prototype implements the alternative homepage information architecture from the UX/UI wireframe: a clearer hero promise, explicit product choice between ribbon, sticker and set, material education, a four-step order explanation, trust content, FAQ and a final Studio CTA. It is responsive and includes a mobile sticky CTA.

The product and material links intentionally pass a handoff contract to Studio:

```text
/studio/?product=ribbon
/studio/?product=sticker
/studio/?product=set
/studio/?product=ribbon&material=satin
/studio/?product=ribbon&material=silicone
```

The current Studio runtime remains unchanged and does not yet consume these query parameters. The next safe implementation step is to add a small entry-context adapter inside Studio that reads `product` and `material`, selects the initial product, and displays a context banner. Existing crop, raster-to-logo, tracing, safe-area and order logic should remain untouched.

## Verification

The repository `npm run check:pr` suite passes after the prototype was added. The mobile viewport in the full project suite remains the primary regression reference for Studio. WebKit-specific visual capture was not required for this isolated static prototype.
