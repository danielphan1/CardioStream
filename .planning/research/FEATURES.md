# Feature Research

**Domain:** Personal health-tracking dashboard (single-patient BP/pulse, voice-first, caregiver-supported)
**Researched:** 2026-07-07
**Confidence:** MEDIUM-HIGH (BP visualization conventions and AHA categories verified against heart.org and peer-reviewed HCI research: HIGH. Voice-dashboard interaction patterns from industry VUI guides: MEDIUM. Competitor feature inventory from app stores/vendor pages: MEDIUM.)

## Domain Context (What "Competitors" Do)

The reference products are consumer BP apps: **OMRON Connect**, **SmartBP**, **Withings Health Mate**, **Qardio**, plus caregiver platforms (Connected Caregiver, CareClinic). Their common feature set defines table stakes for "a BP dashboard that feels complete":

- Timeline chart of systolic/diastolic (dual series), pulse trend
- Color-coded readings by AHA category (green/yellow/orange/dark-orange/red)
- Daily/weekly/monthly averages; AM vs PM grouped summaries (SmartBP explicitly ships "7/14/30 day summary grouped by daily AM/PM averages")
- Date-range filtering
- Reading list/table view alongside charts
- PDF/CSV export for sharing with a doctor
- Manual entry + device sync (Bluetooth/Apple Health)

**None of them are voice-operable.** Voice in health apps today is either Alexa/Google skills for *logging* readings ("tell My Blood Pressure Journal my reading is 125 over 80") or clinician EHR assistants (Vanderbilt VEVA). A voice-*queried* patient dashboard is genuinely uncommon — this is the project's differentiator and it's real, not incremental.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these and the product feels worse than the Tableau prototype or a free app.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| BP timeline, dual-line systolic + diastolic | Universal convention in every BP app; the visual gap between lines communicates pulse pressure | LOW | Contrasting colors per line; distinct at a glance. Recharts LineChart with two series. |
| Pulse trend line with 60 bpm reference line | Chris's data is ~88% bradycardic; without the threshold the chart is uninterpretable | LOW | Dashed/dotted reference line, distinct color, no point markers on the reference line (established convention). Recharts `ReferenceLine`. |
| AHA category color coding (green/yellow/orange/dark-orange/red) | heart.org "rainbow chart" is the de facto standard; every consumer BP app uses it; users and clinicians recognize it instantly | LOW | Normal <120/80 green; Elevated 120–129/<80 yellow; Stage 1 130–139/80–89 orange; Stage 2 ≥140/90 dark orange; Crisis >180/120 red. 2025 AHA/ACC guideline kept these categories. **Add Hypotension (blue/grey) — not in the AHA chart but essential here (systolic readings down to 60).** |
| BP categories distribution chart | Users want "how often am I in each zone" — time-in-category is the single most-cited patient question in BP visualization research | LOW | Horizontal bar with AHA colors, as planned. Order bars clinically (Hypotension → Crisis), not by count. |
| AM vs PM comparison | AHA/AMA home-monitoring protocol is built around morning + evening readings; morning-evening difference is clinically meaningful | LOW | Grouped bars of average systolic/diastolic/pulse by AM/PM. |
| Date-range filter (incl. presets: last 7/30/90 days, all) | Every app has it; also the natural unit of voice commands ("last 30 days") | LOW | Presets matter more than a date picker for voice; picker is caregiver fallback. |
| Summary statistics strip | Apps lead with averages; AHA guidance bases decisions on averaged readings, not single ones | LOW | Show for current filter: avg/min/max systolic, diastolic, pulse; reading count; % in each category. Recompute when filters change. |
| Readings table (raw data view) | Trust anchor — users and doctors want to see the actual numbers behind the charts | LOW | Sortable-by-date list with category color chips. Also the only sane way to verify an upload worked. |
| File upload for OMRON exports | The data-entry mechanism for this product (caregiver flow); OMRON Connect itself exports CSV/Excel, so imports must be forgiving | MEDIUM | Duplicate detection (idempotent re-upload of overlapping exports), clear success/error report ("added 12 readings, skipped 3 duplicates"). Upload without feedback = caregiver distrust. |
| Visible feedback for every voice command | VUI research is unanimous: without immediate confirmation, users don't know if they were heard | MEDIUM | Three states: listening indicator (live transcript), processing, and text confirmation of what changed ("Showing blood pressure, last 30 days, mornings"). This is table stakes *given* voice is primary. |
| Text-input fallback for commands | Voice fails (noise, Safari auto-stop, Firefox); the same agent must be reachable by typing | LOW | Same `/agent` endpoint; large input box. |
| Shared-password gate | Real health data on a public URL; minimum viable privacy | LOW | Session cookie after password; no accounts. |
| Large targets / high contrast / large text | The primary user cannot do precise pointing; WCAG 2.2 minimum is 24px, Apple/Google recommend 44–48px — project's 48px floor is correct | LOW-MEDIUM | Also: no hover-only info (tooltips must have tap/voice equivalents), keyboard navigable, focus visible. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Natural-language voice query of the dashboard | No consumer BP app does this. "Show me my blood pressure for the last 30 days, mornings only" → chart + filters applied. The core value and the portfolio centerpiece | HIGH | Claude intent → validated JSON command. Keep the command vocabulary small (chart, date range, AM/PM, category) — constrained schemas are the VUI best practice for reliability. |
| Continuous listening session (one caregiver tap, then hands-free) | Standard voice UIs require a tap per utterance; Chris can't tap. This is the accessibility feature that makes voice-first real | HIGH | Chrome `continuous=true`; Safari auto-stops on silence and needs auto-restart logic. Needs an unmissable "listening / not listening" indicator — silent failure here strands the primary user. |
| Voice-driven filter composition ("just the stage 2 readings", "compare mornings and evenings") | Turns the dashboard from four static charts into an explorable dataset — beyond what the Tableau prototype could do | MEDIUM | Falls out of the JSON command schema if filters (date, AM/PM, category) are first-class on every chart. |
| Agent answers summary questions in text ("what's my average this month?") | Users ask questions, not just navigation commands; answering from summary stats makes the agent feel intelligent, not menu-like | MEDIUM | Route "query" intents to the summary-stats endpoint; return short text. Keep answers descriptive, never advisory (see anti-features). |
| Hypotension + bradycardia handling as first-class categories | Consumer apps are hypertension-centric; Chris's data is dominated by *low* BP and *low* pulse. A chart tuned to his actual physiology beats every off-the-shelf app | LOW | Hypotension category color (blue), bradycardia reference line, y-axis domains that gracefully span systolic 60–211. |
| Category color bands behind timeline charts | HCI research on home-BP visualization (JAMIA studies) found colored guideline bands were the best-received design element — "like-with-like" reading of points against zones | MEDIUM | Recharts `ReferenceArea` bands on the BP timeline (systolic zones). Optional per-line toggling to avoid clutter since systolic/diastolic thresholds differ. Strong differentiator vs. plain Tableau lines. |
| Upload result summary for caregivers | Caregiver platforms emphasize confidence loops — the wife should immediately see "132 readings total, latest June 13" after upload | LOW | Part of the upload flow; cheap and high-trust. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Medical advice / interpretation ("your BP is dangerously high, call a doctor") | Feels helpful; LLM will happily generate it | Liability, and dangerous with this dataset (readings that would alarm a general-population model are Chris's baseline; autonomic dysreflexia in quadriplegia inverts normal alerting logic) | Descriptive stats and category labels only. System-prompt the agent to never diagnose or advise; confirmations state *what the dashboard shows*, nothing more. |
| Real-time alerts / emergency notifications | Caregiver RPM platforms have them | Data arrives in batch uploads weeks after readings — "alerts" on stale data are noise or false alarm; genuine crisis response can't run through a dashboard | Category counts and the crisis-red color make outliers visible on review. Revisit only if live device sync ever exists. |
| Multi-user accounts, roles, per-user auth | "Proper" apps have login systems | One patient, a couple of caregivers, zero benefit; weeks of auth work that delays the actual value | Shared password (already decided). |
| Bluetooth / Apple Health / OMRON cloud sync | It's how commercial apps ingest data | OMRON's APIs are partner-gated; Web Bluetooth is flaky; huge effort replacing a working workflow (caregiver already exports Excel) | File upload of OMRON exports. |
| Voice dictation data entry ("log 120 over 80") | Obvious voice feature; Alexa skills do it | Speech-to-number errors on medical data are silent corruptions (fifteen/fifty); needs confirm/undo flows the MVP doesn't have | Post-MVP with explicit read-back confirmation. Caregiver file upload for now (already scoped out). |
| Spoken replies (SpeechSynthesis) | Completes the voice loop | Interacts badly with continuous recognition (assistant hears itself), adds Safari quirks; text confirmation is legible at distance per the design constraints | Large-text confirmations now; spoken replies post-MVP with mic-muting during playback (already scoped out). |
| Free-form "AI insights" / trend narratives | Trendy; portfolio-flashy | Unverifiable generated claims about health data; overlaps medical-advice risk | Deterministic computed stats (averages, deltas, counts) rendered as text. |
| Configurable dashboards (drag to rearrange, custom charts) | Power-user dashboard convention | Drag interactions are explicitly prohibited by the accessibility constraints; single user needs four known charts | Fixed chart set, voice-switchable. |
| Analytics/tracking, third-party embeds | Default web practice | Health data leakage; explicitly banned in PROJECT.md | None. Server logs only. |
| PDF report export | Every BP app has it (doctor sharing) | Not an anti-feature per se, but not MVP: Chris's doctor need is served by the CSV/data itself; PDF layout work is pure deferral candidate | v1.x: print stylesheet first (near-free), real PDF later if asked. |

## Feature Dependencies

```
Voice command execution (agent → JSON → UI)
    └──requires──> Filter/chart state model (date range, AM/PM, category, active chart)
                       └──requires──> Readings API with filter params
                                          └──requires──> ETL + seeded DB (132 readings)

Continuous listening session ──requires──> Voice command execution
Text-input fallback ──shares──> same agent endpoint as voice (build together)

Agent summary answers ──requires──> Summary-stats endpoint
Summary statistics strip ──requires──> Summary-stats endpoint (same endpoint, two consumers)

Category color coding ──requires──> BP_Category derived field (ETL) — single source of truth
Category bands on timeline ──enhances──> BP timeline (additive, can ship later)

Upload result summary ──requires──> File upload ──requires──> idempotent ETL (duplicate detection)

Voice reply (post-MVP) ──conflicts──> continuous listening (feedback loop; needs mic muting)
```

### Dependency Notes

- **Voice requires the state model, not vice versa:** the four charts + filters must work via clicks/keyboard first; the agent is then a second driver of the *same* state. Building voice against an ad-hoc UI means rebuilding both.
- **Every filter must be voice-expressible:** if a filter exists in the UI but not in the JSON command schema, the primary user can't use it — schema and UI filters must stay in lockstep (single source of truth for the command vocabulary).
- **Derived categories live in ETL** (already decided): charts and agent answers both read `bp_category`/`pulse_category` from the DB, so category logic is tested once.

## MVP Definition

### Launch With (v1)

- [ ] Four charts (BP timeline dual-line, pulse trend + 60 bpm line, BP categories horizontal bar with AHA colors + hypotension, AM vs PM grouped bars) — replicates and retires the Tableau prototype
- [ ] Filters: date-range presets + AM/PM + BP category, applied via UI controls *and* voice
- [ ] Summary statistics strip (avg/min/max, counts, % per category) reactive to filters — cheap, high-value, and the substrate for agent answers
- [ ] Voice agent: mic → transcript → Claude → validated JSON → chart/filter change, with live transcript + text confirmation
- [ ] Continuous listening with unmissable listening-state indicator (Chrome + Safari behaviors)
- [ ] Text-input command fallback
- [ ] Readings table view — trust anchor and upload verification
- [ ] OMRON file upload with duplicate-safe ingest and result summary
- [ ] Shared-password gate
- [ ] Accessibility baseline: ≥48px targets, ≥18px text, high contrast, keyboard nav, no hover-only/drag/precision interactions

### Add After Validation (v1.x)

- [ ] Agent summary Q&A ("what's my average this week?") — trigger: navigation commands working reliably
- [ ] Category color bands behind BP timeline — trigger: Chris/caregiver feedback that zones aid reading
- [ ] Print stylesheet / doctor-visit view — trigger: an actual appointment where data is shared
- [ ] Voice command help ("what can I say?") overlay — trigger: observed failed-command patterns

### Future Consideration (v2+)

- [ ] Spoken replies (SpeechSynthesis with mic muting) — defer: conflicts with continuous listening; text suffices per requirements
- [ ] Voice data entry with read-back confirmation — defer: silent numeric transcription errors need a confirm/undo pattern
- [ ] Labs / incidents / procedures views + correlation charts — defer: tables exist but empty; no data yet
- [ ] Scheduled summary emails — defer: explicit post-MVP in PROJECT.md

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Four charts w/ AHA colors + thresholds | HIGH | LOW-MEDIUM | P1 |
| Filter state model (date/AM-PM/category) | HIGH | LOW | P1 |
| Voice agent → JSON commands | HIGH | HIGH | P1 |
| Continuous listening session | HIGH | HIGH | P1 |
| Voice feedback (transcript + confirmation) | HIGH | MEDIUM | P1 |
| Summary stats strip | HIGH | LOW | P1 |
| Text-input fallback | HIGH | LOW | P1 |
| OMRON upload (idempotent + result summary) | HIGH | MEDIUM | P1 |
| Readings table | MEDIUM | LOW | P1 |
| Password gate | HIGH | LOW | P1 |
| Agent summary Q&A | MEDIUM | MEDIUM | P2 |
| Timeline category bands | MEDIUM | MEDIUM | P2 |
| Voice help overlay | MEDIUM | LOW | P2 |
| Print/PDF report | LOW | MEDIUM | P3 |
| Spoken replies | MEDIUM | HIGH | P3 |
| Voice data entry | MEDIUM | HIGH | P3 |

## Competitor Feature Analysis

| Feature | OMRON Connect | SmartBP | Our Approach |
|---------|---------------|---------|--------------|
| Trends/charts | Daily/weekly/monthly averages, color-coded dashboard | Graphs + stats incl. mean and variability | Four fixed charts tuned to Chris's data (bradycardia line, hypotension category) |
| AM/PM analysis | Time-of-day views | 7/14/30-day summaries grouped by AM/PM averages | Dedicated AM vs PM chart + AM/PM filter on all charts |
| Category coding | AHA color coding | AHA/ESH/JSH selectable guidelines | AHA colors + hypotension extension (blue) |
| Data entry | Bluetooth device sync | Manual + Apple Health sync | Caregiver file upload of OMRON exports (idempotent) |
| Sharing | PDF/CSV export | PDF reports, cloud sync | Deferred (print stylesheet v1.x) |
| Voice | None | None | Full voice-first navigation and filtering — the differentiator |
| Accounts | Vendor account required | Freemium account | Shared password, zero accounts |

## Sources

- [AHA: Understanding Blood Pressure Readings](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings) — category definitions (HIGH confidence)
- [AHA rainbow chart PDF](https://www.heart.org/-/media/files/health-topics/high-blood-pressure/hbp-rainbow-chart-english.pdf) — canonical color coding (HIGH)
- [2017 ACC/AHA Hypertension Guideline](https://www.ahajournals.org/doi/10.1161/hyp.0000000000000065) and [2025 guideline commentary](https://pmc.ncbi.nlm.nih.gov/articles/PMC12356496/) — categories, home-monitoring averaging protocol (HIGH)
- [JAMIA: Home BP data visualization using human factors principles](https://pmc.ncbi.nlm.nih.gov/articles/PMC8340525/) and [companion study on patient/physician information needs](https://pmc.ncbi.nlm.nih.gov/articles/PMC7432548/) — goal-range bands best received; dual-line conventions (HIGH)
- [OMRON Connect app](https://omronhealthcare.com/omron-connect-app) / [OMRON Connect EMEA](https://www.omron-healthcare.com/omronconnect) — competitor features (MEDIUM)
- [SmartBP app + FAQ](https://www.smartbp.app/faq) — AM/PM summaries, stats, reports (MEDIUM)
- [Vanderbilt VEVA EHR voice assistant](https://pmc.ncbi.nlm.nih.gov/articles/PMC10937093/) — health voice-query patterns (MEDIUM)
- VUI best-practice guides ([Designlab](https://designlab.com/blog/voice-user-interface-design-best-practices), [Eleken](https://www.eleken.co/blog-posts/voice-ui-design)) — feedback/confirmation, constrained vocabularies (MEDIUM)
- [WCAG 2.2](https://www.w3.org/TR/WCAG21/), [Siteimprove: motor impairments and touch targets](https://www.siteimprove.com/blog/motor-impairments-and-mobile-ui-the-touch-target-problem/), [BarrierBreak: speech recognition users](https://www.barrierbreak.com/web-accessibility-for-speech-recognition-users-a-pragmatic-approach/) — target sizes, speech-input accessibility (HIGH for WCAG, MEDIUM otherwise)
- Caregiver platforms ([Connected Caregiver](https://myconnectedcaregiver.com/), [Paid.care vitals tracking](https://paid.care/guides/best-apps-for-caregivers-to-track-hours-and-vitals)) — caregiver confidence-loop patterns (MEDIUM)

---
*Feature research for: voice-first single-patient BP/pulse dashboard*
*Researched: 2026-07-07*
