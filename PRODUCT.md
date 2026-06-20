# Vivea — Product Brief

## The Problem
65 million people worldwide have epilepsy. The dominant 
tracking app (Epsy, 300K users) logs seizures but doesn't 
synthesize patterns. Its clinical communication layer 
(Epsy Hub) was discontinued in May 2024. It serves only 
the US market.

People with epilepsy arrive at neurology appointments 
with incomplete information, no pattern analysis, and no 
clinical narrative. Neurologists make treatment decisions 
with partial data.

## The Gap
Existing apps treat logging as a form-filling task. 
They collect data but don't synthesize it. They don't 
help users understand what their data means or 
communicate it effectively to their care team.

## The Solution
Vivea is a neurological health platform built around 
three layers:

**Layer 1 — Pattern Intelligence (MVP)**
Connect seizure logs, cycle data, sleep, and triggers. 
Surface AI-generated insights automatically. Turn raw 
logs into meaningful patterns.

**Layer 2 — Clinical Story**
Build a longitudinal medication history and 
appointment summary for neurologist communication. 
Generate prior authorization support documentation. 
Replace the PDF export Epsy Hub left behind.

**Layer 3 — Care Navigation**
Prior auth support, drug-resistant epilepsy treatment 
options, specialty pharmacy coordination, caregiver 
alerts.

## Target User
Primary: Adults with epilepsy managing their own care
Secondary: Caregivers supporting someone with epilepsy
Clinical: Neurologists and epileptologists

## Competitive Gap
| Feature | Epsy | Vivea |
|---------|------|-------|
| Seizure logging | ✅ | ✅ |
| Pattern intelligence | ❌ | ✅ |
| Voice logging | ❌ | ✅ |
| Clinical summary | ❌ (discontinued 2024) | ✅ |
| EHR integration roadmap | ❌ | ✅ |
| Global availability | ❌ US only | ✅ |
| Caregiver alerts | ❌ | Roadmap |

## Agent Architecture
Vivea is built as modular agents, not a monolith:

- **Capture Agent** — receives voice/tap input, 
  structures and stores log entries
- **Pattern Agent** — analyzes logs, surfaces insights, 
  identifies trigger correlations
- **Clinical Agent** — generates appointment summaries, 
  medication history, prior auth documentation
- **Navigation Agent** — answers questions about 
  treatment options, drug interactions, care resources

## MVP Scope (Weekend Build)
- Seizure logging with capture-now-enrich-later model
- Aura, side effect, medication, note log types
- AI pattern insights tab powered by Claude API
- Voice logging via Web Speech API
- PWA — offline capable, installable to home screen
- Deployed at vivea.app

## Roadmap
- V2: Apple Watch and Wear OS native apps
- V2: Alexa and Google Home voice integration  
- V3: SMART on FHIR — EHR integration with Epic
- V3: EmpowER&D research partnership data contribution
- V4: Caregiver alert system with emergency contacts
- V4: Automatic seizure detection via wearable sensors

## Why Now
The Epilepsy Foundation's EmpowER&D registry proved 
patients will consent to EHR data sharing for research. 
SMART on FHIR makes EHR integration technically viable. 
AI makes pattern synthesis possible at the individual 
level for the first time. Epsy's clinical layer is gone. 
The market is open.

## Builder
Melissa Craddock — vivea.app
Built in 5 days using Claude Code as force multiplier.