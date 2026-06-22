---
description: "Conventions for future React, Vue, Vite, and TypeScript frontend work in Frontier Cockpit."
applyTo: "apps/**,web/**,frontend/**,**/*.{ts,tsx,js,jsx}"
---

# Frontend App Conventions

These rules apply when adding or changing frontend application code in this workspace.

## Stack

- Prefer TypeScript for new frontend code.
- Use React or Vue with Vite unless a stronger local pattern exists.
- Use hash routing when a built app must open from `file://`.
- For hosted Azure Static Web Apps targets, use history routing with an SPA fallback and `base: '/'`.

## Design System

- Use the Microsoft-aligned palette `#F25022`, `#7FBA00`, `#00A4EF`, `#FFB900`, and Azure blue `#0078D4` where product identity calls for it.
- Use SVG for icons, favicons, logos, diagrams, and professional visual assets.
- Keep dashboards and operational tools dense, scannable, and calm.
- Prefer hand-authored SVG charts for deliverables and deck-like web artifacts unless the app already has a charting library.

## Data And Privacy

- Do not invent metrics or demo data without labeling it as synthetic.
- Distinguish local operational telemetry from official GitHub billing, adoption, and API data.
- Keep raw prompts, responses, tool arguments, and tool results local unless an approved workflow explicitly sends sanitized data onward.

## Verification Before Done

1. Build succeeds with the local package manager.
2. Routes render with zero console or page errors where rendering verification is available.
3. UI copy follows repository naming rules: Frontier Cockpit, Frontier Developer Cockpit, Frontier FinOps Cockpit, and GitHub Copilot.
4. Dark mode, responsive layout, and language switching work when the app implements them.
