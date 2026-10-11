# Contributing

Small, reproducible improvements are welcome. Please open an issue before adding a model, a backend, or another export format so we can agree on licensing, download size, privacy, and what “editable” means for that format.

## Local checks

Use Node.js 22.12+ and run:

```sh
npm ci --ignore-scripts
npm test
npm run build
```

The optional browser smoke test is documented in the README. Use an isolated browser profile rather than attaching to a personal browsing session.

## Useful bug reports

Include your browser and operating system, conversion mode and settings, expected editable elements, and what the exported file actually contains. Attach a small image that you own or can redistribute. For confidential figures, replace labels/content with a minimal synthetic example. Never include API keys, unpublished review material, or provider responses containing private information.

## Design principles

- Keep local conversion local. External requests require deliberate consent and a visible endpoint.
- Preserve native text and geometry where supported; do not silently replace failed objects with a screenshot.
- Validate imported or generated scenes before rendering/exporting them.
- Treat visual fidelity and semantic editability as separate outcomes. State limitations and retain third-party notices.
- Add a regression test before fixing a reproducible conversion bug, and check both desktop and mobile for interface changes.

Please do not commit `dist/`, dependencies, credentials, model weights, test downloads, or third-party datasets.
