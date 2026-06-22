---
description: "Conventions for generated client or customer deliverable packages, including audited data integrity and source traceability."
applyTo: "client-ubb-transition-kits/**,customer-packages/**,account-packages/**"
---

# Client Package Conventions

These rules apply when generating client-specific or customer-specific packages in this repository.

## Structure

A complete client package should include:

- a `README.md` describing purpose, contents, status, how to run or review the package, and references;
- a context or assumptions file capturing source data, decisions, and any unresolved gaps;
- generated deliverables in the correct repository folder or package subfolder;
- validation evidence for every rendered artifact.

## Data Integrity

- Financial, billing, usage, seat, ROI, benchmark, and adoption numbers must come from audited client sources or official vendor sources.
- If a number is unavailable, mark it as `TODO (pending audited source)` or omit it.
- Do not fill gaps with guesses.
- Do not round differently from the audited source unless the document explicitly states the rounding rule.
- Every data document must include a References section.

## Seeding A New Package

1. Start from an approved template or a clearly labeled new structure.
2. Replace placeholder branding and numbers only with audited client data.
3. Keep anonymized templates anonymized.
4. Record every source and assumption in the package context file.

## Copy rules

- Write "GitHub Copilot", never bare product shorthand.
- Documentation is English unless the deliverable explicitly requires another language.
- Do not use em dashes in user-facing copy.
