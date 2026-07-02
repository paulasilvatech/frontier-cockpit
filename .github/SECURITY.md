# Security Policy

This repository stores GitHub Copilot customization primitives, validation scripts, and generated deliverables. Treat changes to agents, skills, prompts, instructions, workflows, and scripts as security-relevant changes.

## Supported Scope

Security review applies to:

| Area | Path |
| --- | --- |
| Agents | `/.github/agents/` |
| Skills | `/.github/skills/` |
| Prompts | `/.github/prompts/` |
| Instructions | `/.github/instructions/` |
| Validation scripts | `/.github/scripts/` |
| GitHub Actions | `/.github/workflows/` |
| Generated executable helpers | Any `scripts/` folder inside a skill |

## Reporting

Report suspected vulnerabilities privately through GitHub private vulnerability reporting on this repository (Security tab, Report a vulnerability). If private reporting is unavailable, contact the repository owner directly. Do not open a public issue for secrets, credential exposure, unsafe workflow permissions, prompt injection paths, or malicious imported content. Initial response target is five business days.

Include:

- The affected file path.
- The risk and likely impact.
- Steps to reproduce or verify.
- Whether any secret, token, or customer data may be involved.

## External Content Policy

External agents, skills, prompts, and instructions must include source metadata when imported or adapted:

- `source`
- `source_url`
- `license`
- `imported_date`
- `last_sync`

Allowed external licenses are MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, and CC0-1.0 unless the repository owner approves another license in writing.

## Validation

Run these checks before merging security-relevant changes:

```bash
bash .github/scripts/audit-primitives.sh
bash .github/scripts/audit-skills.sh
bash .github/scripts/audit-external-content.sh
bash .github/scripts/validate-deliverables.sh
```

## References

- [Repository GitHub Copilot instructions](copilot-instructions.md)
- [Skill authoring conventions](instructions/skills-authoring.instructions.md)
- [Primitive audit script](scripts/audit-primitives.sh)
- [Skill audit script](scripts/audit-skills.sh)
