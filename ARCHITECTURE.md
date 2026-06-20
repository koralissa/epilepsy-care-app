# Vivea — Agent Architecture

## Philosophy
Vivea is built as modular agents, not a monolith.
Each agent has one job. Each is independently 
deployable and improvable. This is the architecture
Jacob Alcauskas described: easier to maintain,
easier to scale, easier to swap models as they improve.

## Agent Structure
[Voice Input]  ──┐

[Tap Input]    ──┼──► [Capture Agent] ──► [Data Store]

[Widget]       ──┘                              │

[Alexa/Google] ──┘                              │

      ┌─────────────────────┼─────────────────────┐

▼                     ▼                     ▼

[Pattern Agent]      [Clinical Agent]      [Navigation Agent]

     │                     │                     │

▼                     ▼                     ▼

Insights Tab         Appointment PDF        Prior Auth Support

Trigger Report       Medication History     Treatment Options

Cycle Correlation    EHR Export             Care Guidance

                          │

                                    ▼

                                 SMART on FHIR → Epic

---

## Agent Definitions

### Capture Agent
**Single job:** Receive input in any form. 
Structure it. Store it.

**Inputs:**
- Voice transcript from Web Speech API
- Tap selections from log form
- Widget tap (timestamp only)
- Future: Alexa/Google Home voice command
- Future: Apple Watch tap

**Outputs:**
- Structured log entry
- Fields: type, datetime, duration, intensity, 
  triggers, notes, caregiver observations
- Stored in localStorage (MVP) → Supabase (V2)

**Model:** Claude Sonnet
Interprets natural language into structured 
data fields. Handles ambiguity gracefully.

**Example:**
Input: "I just had a tonic-clonic seizure, 
lasted about two minutes, I was really stressed 
today and didn't sleep well last night"

Output:
```json
{
  "type": "tonic-clonic",
  "duration": "2min",
  "triggers": ["stress", "poor sleep"],
  "datetime": "2026-06-21T14:32:00",
  "confidence": "high"
}
```

**Design principle:** Capture now, enrich later.
The minimum viable capture is a timestamp and 
event type. Everything else is optional and can 
be added when the user has recovered.

---

### Pattern Agent
**Single job:** Analyze logs. Surface insights. 
Find correlations the user can't see themselves.

**Inputs:**
- Full log history for the user
- Seizure entries, aura entries, trigger notes
- Medication log, cycle data if provided
- Sleep and stress notes

**Outputs:**
- Insight cards rendered on the Insights tab
- Trigger correlation reports
- Frequency trends
- Cycle correlation if menstrual data present
- Medication effectiveness signals

**Model:** Claude Sonnet
Pattern recognition across multiple data streams.
Returns structured JSON that renders as insight cards.

**Example output:**
```json
{
  "insight": "Sleep pattern correlation",
  "observation": "3 of your last 4 seizures 
    occurred within 24 hours of logging poor sleep.",
  "confidence": "moderate",
  "recommendation": "Consider tracking sleep 
    quality daily to build a stronger pattern.",
  "data_points": 4
}
```

**Why this matters:**
Epsy collects the same data. Epsy doesn't do this.
This is the intelligence layer the market is missing.

---

### Clinical Agent
**Single job:** Turn logs into clinical communication 
artifacts. Replace what Epsy Hub discontinued in 
May 2024.

**Inputs:**
- Log history (configurable date range)
- Medication list and changes
- Upcoming appointment date and clinician
- User-specified questions to ask

**Outputs:**
- Appointment summary PDF (1 page)
- Medication timeline
- Seizure frequency trend chart
- Top triggers ranked by frequency
- Prior authorization support documentation
- Questions to ask at next appointment

**Model:** Claude Sonnet
Clinical narrative generation from structured data.
Plain language. Doctor-ready. Exportable.

**Example output excerpt:**
"In the 90 days prior to this appointment, 
[patient] logged 12 seizures (down from 18 
in the previous 90-day period). Most frequent 
type: tonic-clonic (8 of 12). Most consistent 
trigger: poor sleep, present in 9 of 12 events. 
Medication change on [date] appears correlated 
with frequency reduction."

**Why this matters:**
Epsy Hub was the only tool attempting this.
It was discontinued because it was a standalone 
portal — doctors wouldn't log in separately.
Vivea's clinical artifacts are patient-generated 
and patient-owned. The patient brings them to 
the appointment. No portal fatigue.
Long term: SMART on FHIR pushes directly into Epic.

---

### Navigation Agent
**Single job:** Answer questions about care, 
treatment, and next steps using the user's 
own log context.

**Inputs:**
- User question in natural language
- User's log context (recent entries, medications, 
  triggers)
- Epilepsy Foundation resources
- Drug interaction databases
- Prior authorization requirements by payer

**Outputs:**
- Conversational response
- Actionable next steps
- Questions to raise with neurologist
- Prior auth guidance for specific medications

**Model:** Claude Sonnet with RAG
Retrieval-augmented generation over curated 
epilepsy resources. Grounded in evidence.
Never replaces clinical advice — always directs 
to care team for decisions.

**Example:**
User: "My doctor mentioned Epidiolex — 
what should I ask at my next appointment?"

Output: Evidence-based summary of Epidiolex 
indications, common questions about prior auth 
requirements, and suggested questions for the 
neurologist — contextualized to the user's 
logged seizure type and frequency.

---


## When We Use AI

Not every feature is an AI problem.

**The principle: finite problems get deterministic 
solutions. Infinite problems get AI.**

A finite problem has a known output space — 
a fixed set of possible answers. Chip selectors, 
conditional forms, settings, navigation. 
These are faster, cheaper, more reliable, 
and work offline. AI adds no value here.

An infinite problem has an unbounded output space — 
pattern recognition across unknown data combinations, 
natural language interpretation, narrative synthesis, 
open-ended clinical questions. This is where AI 
earns its place.

| Feature | Output Space | Solution |
|---------|-------------|----------|
| Collect seizure type | Finite | Chip selector |
| Collect triggers | Finite | Chip selector |
| User onboarding | Finite | Conditional form |
| Configure profile | Finite | Settings form |
| Find log patterns | Infinite | Pattern Agent |
| Interpret voice input | Infinite | Capture Agent |
| Generate clinical summary | Infinite | Clinical Agent |
| Answer care questions | Infinite | Navigation Agent |

The question before adding AI to any feature:
*Is the output space finite or infinite?*

If finite — build it deterministically.
If infinite — that is where an agent earns its place.



---


## Data Flow (MVP)
User taps + button or speaks

↓
Capture Agent receives input

(form selection or voice transcript)

↓
Claude API structures the entry

(natural language → JSON fields)

↓
Entry saved to localStorage

↓
Home screen updates — entry appears in recent logs

↓
User navigates to Insights tab

↓
Pattern Agent called with full log history

↓
Claude API analyzes entries, returns insight JSON

↓
Insight cards rendered on Insights tab

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | HTML, CSS, JavaScript | Deploy-ready PWA, no framework overhead |
| AI | Anthropic Claude API (claude-sonnet-4-6) | Best-in-class reasoning, structured output |
| Voice | Web Speech API | Built into Chrome and Safari, no external API |
| Storage | localStorage (MVP) | Zero infrastructure, offline capable |
| Storage V2 | Supabase | Open source, HIPAA-eligible, real-time |
| Deployment | GitHub Pages → vivea.app | Instant deployment, custom domain |
| EHR (Roadmap) | SMART on FHIR | Standard for Epic, Cerner integration |
| Native (Roadmap) | React Native | iOS and Android from shared codebase |

---

## Roadmap

**V1 — MVP (This weekend)**
- PWA deployed at vivea.app
- Capture Agent: tap and voice logging
- Pattern Agent: AI insights on Insights tab
- Core log types: seizure, aura, side effect, 
  medication, note

**V2 — Mobile Native**
- React Native iOS and Android apps
- Apple Watch and Wear OS logging
- Supabase backend with HIPAA-eligible storage
- Caregiver account linking
- Alexa and Google Home skills

**V3 — Clinical Integration**
- SMART on FHIR → Epic and OncoEMR integration
- Clinical Agent appointment summary PDF
- Prior authorization documentation generation
- EmpowER&D Epilepsy Foundation data contribution
  (patient-consented research registry)

**V4 — Platform**
- White-label clinical agent for health systems
- Automatic seizure detection via wearable sensors
- Multi-condition expansion beyond epilepsy
- Enterprise EHR partnership model

---

## Why Agents Over a Monolith

| Concern | Monolith | Agent Architecture |
|---------|----------|-------------------|
| Model improvements | Requires full redeploy | Swap one agent |
| Enterprise white-label | Extract and rewrite | Deploy Clinical Agent standalone |
| New input surface (Alexa) | Rebuild input layer | Add source to Capture Agent |
| Condition expansion | Rebrand everything | Swap Navigation Agent domain |
| Testing | Test everything together | Test each agent independently |
| Maintenance | Touch everything to fix one thing | Fix the agent that's broken |

The Capture Agent doesn't know it's an epilepsy app.
The Pattern Agent doesn't care what condition it's analyzing.
Only the Navigation Agent needs domain knowledge —
and domain knowledge is a prompt, not a codebase.

This is the architecture that scales from a weekend 
MVP to a clinical platform.

---

*Built by Melissa Craddock — vivea.app*
*0 to deployed in 5 days using Claude Code*