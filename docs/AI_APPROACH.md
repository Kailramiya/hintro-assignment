# AI Integration Approach

This document explains how the Meeting Intelligence Service integrates with Google Gemini, the prompt design rationale, citation strategy, and hallucination prevention measures.

---

## Model Choice

**Model:** `gemini-1.5-flash`

- Fast (< 3s typical latency for ~500 token transcripts)
- Supports `responseMimeType: 'application/json'` for native structured output
- 1M token context window handles very long meeting transcripts
- Free tier available via Google AI Studio

---

## Prompt Design

### Core Principle: Grounding Before Generation

The prompt is structured so that the model **extracts** rather than **infers**. Every field in the output must map back to an explicit statement in the transcript.

### Prompt Structure

```
MEETING DETAILS
  → title, date, registered participants, actual speakers

CRITICAL GROUNDING RULES (enforced before generation)
  → 6 explicit constraints the model must not violate

TRANSCRIPT (formatted as [HH:MM:SS] Speaker: Text)

OUTPUT SCHEMA (JSON, no markdown, no code fences)
```

### Key Design Decisions

**1. Speaker list in context**
Both the registered participants list AND the set of actual speakers (derived from transcript) are injected into the prompt. This prevents the model from confusing people who attended but didn't speak.

**2. Timestamp format is pre-specified**
Timestamps are included as `HH:MM:SS` in the transcript. The prompt instructs the model to copy timestamps **exactly** as they appear — eliminating format conversion errors.

**3. Exact quote requirement**
Every action item and decision requires `citationText` — a verbatim quote from the transcript. This creates a verifiable link between output and source.

**4. `responseMimeType: 'application/json'`**
The Gemini generation config includes `responseMimeType: 'application/json'`, which signals to the model to return clean JSON without markdown wrapping.

**5. Low temperature (0.1)**
Creativity is counterproductive for extraction tasks. `temperature: 0.1` makes outputs highly deterministic and grounded.

---

## Citation Strategy

Each AI-generated insight carries three citation fields:

| Field | Description | Example |
|---|---|---|
| `citationText` | Verbatim quote from transcript | `"I will handle the DB schema by Friday."` |
| `citationTimestamp` | Exact timestamp from transcript | `"00:01:30"` |
| `citationSpeaker` | Speaker name as written in transcript | `"Bob Smith"` |

This three-field citation gives:
- **What** was said (`citationText`)
- **When** it was said (`citationTimestamp`)
- **Who** said it (`citationSpeaker`)

---

## Hallucination Prevention

### Prompt-level Constraints

The prompt explicitly states:

> "ONLY reference people who appear as speakers in the transcript. Never use names from the participants list if they never spoke."

> "Do NOT invent, assume, or infer anything not explicitly stated."

> "If no action items exist in the transcript, return an empty array."

### Post-Processing Validation (`validateCitations` function)

After the model responds, `gemini.service.ts` runs a validation pass:

1. **Speaker validation**: Each `citationSpeaker` and action item `assignee` is checked against the set of actual speakers. Items with hallucinated speakers are **dropped** and a warning is logged.

2. **Timestamp validation**: Each `citationTimestamp` is checked against the set of timestamps that actually appear in the transcript. Mismatches are logged as warnings (not dropped, since minor formatting differences are possible).

3. **Logging**: All validation results are logged with `traceId` for auditability.

```typescript
// Pseudocode of post-processing
const speakers = new Set(transcript.map(e => e.speaker.toLowerCase()));

result.actionItems = result.actionItems.filter(item =>
  speakers.has(item.assignee.toLowerCase())  // drop hallucinated assignees
);
```

---

## Output Validation

The raw Gemini response goes through:

1. **JSON.parse** — if it fails, attempt to strip code fences (Gemini occasionally wraps despite `responseMimeType`)
2. **Type cast** to `AIAnalysisResult` interface
3. **`validateCitations`** — speaker + timestamp cross-check against transcript
4. **Database transaction** — analysis + action items written atomically; if DB write fails, the AI response is discarded

---

## Known Limitations

1. **Implicit action items**: If a speaker says "someone should follow up on this" without assigning a specific person, the model may either skip it or assign it to the nearest mentioned name. The grounding rules mitigate this but cannot eliminate ambiguity.

2. **Relative dates**: If the transcript says "by end of week" without a specific date, the model may return `null` for `dueDate` (correct) or attempt to infer an absolute date (which would be flagged in validation logs).

3. **Long transcripts**: Transcripts over ~50,000 tokens may cause degraded response quality or latency increases. The 1M context window provides ample headroom for typical meetings.

4. **Non-English transcripts**: The model handles multi-language transcripts but citation text must match the original language. Not tested for mixed-language transcripts.

5. **Re-analysis**: The current implementation blocks re-analysis once a meeting has been analyzed (`409 Already Analyzed`). This prevents duplicate action items. A `?force=true` query parameter could be added to allow re-analysis with cleanup.

---

## Example: Prompt → Output

**Input transcript snippet:**
```
[00:01:30] Bob Smith: I will handle the database schema. I can have it done by Friday.
```

**Expected output:**
```json
{
  "title": "Complete database schema",
  "description": "Design and implement the database schema for the project",
  "assignee": "Bob Smith",
  "dueDate": null,
  "citationText": "I will handle the database schema. I can have it done by Friday.",
  "citationTimestamp": "00:01:30",
  "citationSpeaker": "Bob Smith"
}
```

Note: `dueDate` is `null` because "Friday" without a specific date is ambiguous. A production system might resolve this against the `meetingDate`.
