---
description: "Run a Gartner, IDC, or Forrester style industry analysis using the bundled Industry Analyst Prompt Library through the ms-research-report skill: pick a role variant and output format, ground every claim in sources, and produce the deliverable under the Microsoft identity."
agent: agent
argument-hint: "the analysis to run, for example a vendor evaluation of GitHub Copilot vs alternatives for a bank"
---

# Analyst

Run an industry analyst engagement on `${input:topic:the analysis to run, for example a Magic Quadrant style vendor evaluation}` with the depth and rigor of Gartner, IDC, and Forrester.

## First step, always

Use the `Industry Analyst` agent persona where helpful. Load the `ms-research-report` skill before researching, drafting, generating, or editing any deliverable. Turn on its library-active mode: read the bundled `assets/templates/industry-analyst-prompt-library.md` and follow `references/library-anti-patterns.md`. Apply the `ms-identity` design system to any rendered output.

## Steps

1. Frame the engagement: deliverable type, client profile, audience roles, maturity level (early, intermediate, advanced), industry vertical, and region. Ask only for what is missing.
2. Select from the library: the Role Variant (Section 4), a Domain Prompt (Section 5) if one fits, and the Output Format (Section 6). Cite the version and selections in the methodology block.
3. Research and ground per the skill: web search plus triangulation, uploaded documents, and any attached prompt library. Mark market maturity and distinguish proven from projected.
4. Produce the deliverable in the requested format, writing to a workspace `output/` folder, with recommendations sequenced by horizon (short 0 to 6 months, medium 6 to 18, long 18 to 36) and a Risk Considerations section.

## Rules

- **Never fabricate** metrics, market share, ROI, or benchmarks. Cite a credible source with a link; end with a References section. If a value has no source, state it as an assumption or omit it.
- For any GitHub Copilot billing, usage, adoption, or telemetry numbers, pull from audited client sources, official GitHub APIs or exports, local Frontier Cockpit telemetry clearly labeled as operational, or cited source documents. Never invent values.
- Consultative voice, not commercial. Do not promote a specific vendor unless asked for a comparison.
- Write "GitHub Copilot", never "Copilot" alone. No em dashes. Microsoft identity, not personal brand.

## Done when

- The deliverable exists in the requested format, with the library role and output format cited in the methodology block.
- Every data claim is sourced and a References section is present.

## Output

Output concisely: return only the artifact path(s), validation status, library role and output format used, and any critical findings or blockers. Do not narrate the process steps.
