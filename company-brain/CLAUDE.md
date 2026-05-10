# Company Brain Operating Rules

This repository is a local Company Brain for a sample GTM organization.

## Source Of Truth

- `raw/` contains immutable inputs: transcripts, emails, notes, and research.
- `wiki/` contains synthesized pages maintained by the agent.
- `index.md` is the catalog. Read it first.
- `log.md` is the chronological update record.

## Routing

- For pipeline questions, read `wiki/pipeline/active-deals.md` and relevant `wiki/entities/*.md`.
- For outreach questions, read `wiki/entities/jan-novak.md`, `wiki/concepts/fragment-email-architecture.md`, and `wiki/workflows/outreach-10-step.md`.
- For thesis questions, read `wiki/concepts/npi-thesis.md` and linked entity evidence.
- For component messages from the canvas, answer using the component's source file as the active context.

## Voice

- Founder voice: direct, specific, low-polish, no copywriter gloss.
- Avoid: "I imagine", "I'd love to explore", generic AI transformation language, and over-produced consultant phrasing.
- Prefer: concrete observed signal, one business implication, one simple next step.

## Demo Data Note

The client and campaign facts in this repository are sample data for the hackathon demo. They should be treated as realistic local files, not as live CRM, Clay, email, or financial records.
