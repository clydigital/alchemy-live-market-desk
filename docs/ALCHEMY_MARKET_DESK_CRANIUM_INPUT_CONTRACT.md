# Alchemy Market Desk Cranium Input Contract
## Optional Human Analyst Overlay

**Purpose:** Allow analyst curiosity, source leads, observations and hypotheses to enter the Live Market Desk without becoming a parallel source of truth.

**Dependency:** The automatic baseline Live run must work without a Cranium.

---

# 1. Operating rule

> **The analyst decides what deserves a closer look. The Live research system decides what the evidence supports.**

Every Cranium is optional, timestamped, linked to a baseline run, treated as analyst input rather than verified evidence, preserved for audit/history and allowed to trigger targeted research.

---

# 2. Input format

The analyst may upload Markdown, paste notes or provide a voice-note transcript. No rigid form is required.

Suggested freeform sections:

- What I'm noticing
- Questions I want answered
- Hypotheses / possible connections
- Sources or transcripts to consider
- Charts / screenshots / levels
- Things that feel wrong or incomplete
- Must-check today
- Lower priority / ignore

The parser must tolerate missing sections.

---

# 3. Machine classification

Each note becomes one or more of:

```yaml
cranium_item:
  id: string
  raw_text: string
  type: observation|question|hypothesis|source_lead|chart_lead|must_check|deprioritise|presentation_preference
  linked_story_ids: [string]
  evidence_status: analyst_input
  priority: low|medium|high
```

---

# 4. Analyst Overlay Refresh

When a Cranium arrives:

1. preserve the existing baseline edition;
2. map Cranium items to Stories, candidates, event horizon, source gaps and market variables;
3. search for evidence supporting substantive hypotheses;
4. deliberately search for evidence that would make them wrong;
5. assign `SUPPORTED`, `PARTLY_SUPPORTED`, `CONTRADICTED`, `UNRESOLVED`, `DUPLICATE` or `NOT_MATERIAL`;
6. perform a targeted fresh sweep for affected Stories/assets/current prices/new official information/commentary/physical or positioning evidence;
7. create new Story versions only when the evidence changes canonical state;
8. recompose affected causal storylines;
9. publish a new immutable `analyst_enriched` edition linked to the baseline.

The Cranium receives no automatic confidence bonus merely because it came from the analyst.

---

# 5. Anti-tunnel-vision questions

Mandatory challenge pass:

1. What if the analyst's idea is wrong?
2. What supports the current consensus instead?
3. Is the proposed connection causal or merely correlated?
4. Is this already known / duplicated?
5. Did market pricing confirm it?
6. What would falsify it?

---

# 6. Cranium Delta

Internal analyst feedback may show:

- PROMOTED — stronger after research;
- MODIFIED — useful but corrected;
- REJECTED / UNCONFIRMED;
- NEW QUESTIONS.

This should not clutter the customer-facing Dossier by default.

---

# 7. Voice-note workflow

1. analyst records/pastes a voice note;
2. system converts it to Cranium items;
3. targeted research begins;
4. enriched edition is produced;
5. Dossier updates.

Do not force manual structuring of every thought.

---

# 8. Daily workflow

```text
Regular Live run
→ baseline Dossier exists automatically

IF analyst has nothing to add:
    use baseline Dossier

IF analyst has ideas:
    submit Cranium
    → targeted challenge + rescan
    → analyst-enriched Dossier
```

---

# 9. Hybrid relationship

The Cranium feeds Live, not Hybrid.

The Dossier never presents analyst input as fact. Only the resulting canonical verified/labelled research is rendered. Hybrid remains a read-only consumer.
