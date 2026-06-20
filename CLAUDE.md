# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Serve any static file server from the repo root:

```bash
python3 -m http.server 8743
# then open http://localhost:8743
```

For Playwright-based verification (used for bug reproduction):

```bash
node /tmp/your-test.js   # write one-off test scripts to /tmp
```

The service worker (`sw.js`) caches aggressively. After changes, hard-refresh in the browser or open an incognito window, or bump `CACHE` in `sw.js` (`vivea-v1` → `vivea-v2`).

## Architecture

**Single-page app. No framework. No bundler. Three files do everything.**

- `index.html` — all DOM, all screens, all modals. Static HTML; JS never recreates top-level structure.
- `app.js` — all logic: state, rendering, event wiring, onboarding flow. Loaded at bottom of `<body>`, runs synchronously.
- `style.css` — all styles. Mobile-first, 390px max-width canvas (`app-shell`).

### Screen / layer stacking (z-index)

| Layer | Element | z-index |
|---|---|---|
| Normal app | `#screen-main` | — |
| Profile / log modals | `.screen-modal` | 50 |
| Onboarding shell | `.ob-shell` (`#screen-onboarding`) | 200 |
| Welcome screen | `.welcome-shell` (`#screen-welcome`) | 220 |

New full-screen overlays belong in this stack. Always use `position: absolute; inset: 0` relative to `.app-shell` (which is `position: relative; overflow: hidden; height: 100dvh`).

### Storage keys

All data lives in `localStorage`:

| Key | Contents |
|---|---|
| `epitrack_entries` | Array of log entry objects |
| `vivea_profile` | Profile object (seizure types, meds, triggers, caregiver, etc.) |
| `vivea_onboarded` | `'true'` once 7-screen onboarding is complete |
| `vivea_welcomed` | `'1'` once the welcome screen has been dismissed |
| `vivea_banner_dismissed` | `'1'` once the "data on this device" banner is dismissed |
| `vivea_meds_YYYY-MM-DD` | Daily medication check-off log for a given date |
| `vivea_account` | Account object (set when user creates an account) |

### Modal pattern

Modals use `.screen-modal` + `.active` class toggle, not `hidden`. The CSS `transform: translateY(100%)` hides them; `.active` brings them to `translateY(0)`. To open: `el.classList.add('active'); el.removeAttribute('aria-hidden')`. To close: reverse. Don't use `hidden` on modals — it breaks the slide animation.

Exception: `#screen-onboarding` and `#screen-welcome` use the `hidden` attribute directly because they are full-screen shells, not slide-up modals.

### Onboarding flow

7 screens (`ob-s1` → `ob-s7`) inside `.ob-screens`, animated with inline `style.transform`. Key state:

- `obIdx` — current position in `flow` array (module-level `let`)
- `obMedCount` — number of medication cards added (module-level `let`)
- `flow` — computed by `obGetFlow()`, skips screen 5 for caregivers

**Always call `obInitScreens()` to enter the onboarding.** It resets `obIdx`, `obMedCount`, clears med cards, and positions all screens. Never manipulate these directly.

Event listeners for onboarding are wired once in the `wireOnboarding` IIFE at load time. For reveal/hide on radio selection (screens 3 and 6), listen to `click` on the `<label>` elements — not `change` on the `<input>` — because iOS Safari does not reliably fire `change` on `sr-only` radio inputs inside `overflow: hidden` containers.

### Boot sequence

```
app.js loads → renderHome() → check localStorage →
  hasWelcomed? → hide welcome, apply profile, render home
  first visit? → hide onboarding, show welcome screen
```

`applyProfile()` mutates the live DOM: it renames trigger chips, hides the hormonal cycle chip, shows the device section, and swaps caregiver-mode text. It runs once at boot (if profile exists) and after onboarding completes.

### Entry schema

```js
{
  id: String(Date.now()),
  time: ISO8601string,
  category: 'Seizure' | 'Aura' | 'Side effect' | 'Medication' | 'Note',
  type: string,          // seizure subtype or equals category
  intensity: string,     // Seizure only
  duration: string,      // Seizure only
  triggers: string[],    // Seizure + Aura
  symptoms: string[],    // Aura + Side effect
  medication: string,    // Side effect + Medication
  dose: string,          // Medication only
  reason: string,        // Medication only
  deviceUsed: string,    // Seizure only
  ledToSeizure: string,  // Aura only
  notes: string,
}
```

### Profile schema

```js
{
  userType: 'newly_diagnosed' | 'living' | 'caregiver' | 'professional',
  seizureTypes: string[],
  takingMeds: 'yes' | 'not_yet' | 'skip',
  medications: [{ name, strength, unit, timesPerDay, reminders, reminderTimes[] }],
  triggers: string[],
  dontKnowTriggers: boolean,
  trackCycle: 'yes' | 'no' | null,
  hasDevice: 'yes' | 'no' | null,
  deviceType: string | null,
  caregiver: { name, phone, email, notifyPref } | undefined,
}
```

## Product principles (affect code decisions)

**Never block logging.** The log button must always work, even before account creation, even before profile setup. See PRINCIPLES.md. This means: no auth walls on the log flow, no required profile fields on submit.

**Finite problems = deterministic code. Infinite problems = AI.** Chip selectors, forms, navigation → pure JS. Pattern recognition, clinical narrative, voice interpretation → Claude API (not yet wired in MVP; Insights tab currently renders static computed stats).

**Account creation is post-value.** The welcome screen leads with logging, not signup. Account prompts appear after the first log is saved (`showAccountBannerIfNeeded()`), not before. `vivea_account` in localStorage is the MVP auth store; comments in code mark where Supabase auth V2 replaces it.

## What's not yet built

- Claude API calls (Pattern Agent, Capture Agent voice structuring) — marked in ARCHITECTURE.md
- Supabase backend — marked in code as "Replace with Supabase auth V2"
- Voice logging (Web Speech API wired to UI but not to structured output)
- Progressive profiling bottom sheet questions (designed in spec, not yet implemented)
