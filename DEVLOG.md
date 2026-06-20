# Vivea — Development Log

## June 19, 2026 — Day 1

### Starting point
Had a 1-on-1 with Jacob Alcauskas, SVP Glide, 
about the Full Stack Product Builder role. 
He raised a concern: he couldn't tell if I was 
an engineer with a product lens or a product 
person with an engineering lens. He told me 
to apply anyway.

Decided to build something real before Monday 
rather than write more words about what I could do.

### Problem selected
Epilepsy care app. Personal domain knowledge 
as a caregiver and Epilepsy Foundation Research 
Ambassador. Clear market gap: Epsy (300K users, 
category leader) logs seizures but doesn't 
synthesize patterns. Epsy Hub, their clinical 
communication layer, was discontinued May 2024.

### Competitive research completed
- Epsy: strong logging, no intelligence layer, 
  US only, clinical layer gone
- EpiCentr: geolocation alerts, no synthesis
- EpiWatch: FDA-cleared detection, hardware play
- SeizAlarm: Apple Watch alerts, safety focused
- None synthesize patterns. None help with 
  prior authorization. None have voice logging.

### Key insight
EmpowER&D (Epilepsy Foundation research registry) 
proved patients will consent to EHR data sharing. 
SMART on FHIR makes EHR integration technically 
viable. Epsy's clinical layer is gone. 
The market is open.

### Product vision defined
Three layers:
1. Pattern intelligence — AI synthesis of logs
2. Clinical story — appointment summaries, 
   prior auth support
3. Care navigation — treatment options, 
   specialty pharmacy

### Technical decisions
- Claude Code as primary build tool
- PWA not native app — ships faster, 
  Jacob can click the URL Monday morning
- localStorage for MVP — zero infrastructure
- Agent architecture not monolith — 
  each agent has one job, independently improvable

### Name decisions
Explored: EpiTrack → Neres → Nerres → Vivea
Landed on Vivea — from Latin vivere, "to live"
Tagline: Thrive.
Domain registered: vivea.app

Rejected Epi prefix — stigma, home screen problem, 
locks to epilepsy condition, all competitors 
already use it.

### Design decisions
- Started dark/immersive — looked too much like Epsy
- Moved to white canvas, purple brand accents — 
  cleaner, more readable in stressful moments
- Color system: Atlassian design tokens, 
  semantic category colors
- Purple family for brand, magenta for hero action only
- Inter font, Lucide icons, 8px Atlassian spacing
- EEG brainwave as brand signature — recognizable 
  to epilepsy community, abstract to everyone else

### Built today
- GitHub repo: koralissa/epilepsy-care-app
- PWA scaffolded and deployed to GitHub Pages
- Seizure logging with chip selectors
- Bottom nav with magenta FAB
- Purple Atlassian design token system
- Category-coded log types with semantic colors
- Vivea rebrand throughout
- PRODUCT.md, ARCHITECTURE.md, DEVLOG.md started

### Dead ends
- Domain search: vivia.app taken (Vivi Care 
  trademark conflict), vivia.health taken, 
  vivea.app available and registered
- Dark immersive UI — beautiful but wrong for 
  a health app someone uses post-seizure
- Three stacked EEG waves — too much, 
  reduced to single subtle element

### What I learned today
The capture moment is everything. Someone who 
just had a seizure is disoriented, scared, 
possibly alone. Every field, every tap, every 
second of friction is a barrier to the data 
that could save their life or improve their care.

Capture now, enrich later is not a feature. 
It's the entire product philosophy.

### What I'd do differently
Start with the agent architecture diagram before 
building the UI. The systems thinking should 
drive the interface decisions, not the other 
way around.

### Tomorrow
- AI insights layer — Pattern Agent live
- Voice logging — Capture Agent via Web Speech API
- README.md complete
- Case study outline started
- Apply in Workday
- Send Jacob the note