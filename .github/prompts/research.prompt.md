---
description: "Run research and produce a deliverable (report, dossier, or brief) for Frontier Cockpit, GitHub Copilot observability, or a client account, routing to the ms-research-report skill under the Microsoft identity."
agent: agent
argument-hint: "the research topic, for example a GitHub Copilot adoption benchmark for banking"
---

# Research

Research `${input:topic:the research topic or client account to investigate}` and produce a polished deliverable.

## First step, always

Load the `ms-research-report` skill before researching, drafting, generating, or editing any deliverable. Apply the `ms-identity` design system and Microsoft identity to any rendered output.

## Steps

1. Clarify the deliverable type (analyst report, account dossier, competitive brief, market landscape, or workshop or playbook content), the audience, and the language.
2. Conduct the research per the skill. Use credible sources (official vendor docs such as Microsoft Learn and GitHub Docs, and named analyst firms such as Gartner, Forrester, IDC, McKinsey).
3. Produce the output in the requested format (Markdown, HTML, PDF, DOCX, PPTX, or XLSX), writing to a workspace `output/` folder.

## Rules

- **Never fabricate** metrics, market data, or findings. Every data claim cites a credible source with a link; end with a References section. If a number has no source, state it as an assumption or omit it.
- For any GitHub Copilot billing, usage, adoption, or telemetry numbers, pull from audited client sources, official GitHub APIs or exports, local Frontier Cockpit telemetry clearly labeled as operational, or cited source documents. Never invent values.
- Write "GitHub Copilot", never "Copilot" alone. No em dashes. Microsoft identity, not personal brand.

## Done when

- The deliverable exists in the requested format with every claim sourced and a References section.
- Numbers match their audited or cited sources.

## Output

Output concisely: return only the artifact path(s), validation status, and any critical findings or blockers. Do not narrate the process steps.
