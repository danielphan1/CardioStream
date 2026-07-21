# 04 — Real-Device Voice Test Checklist

> Manual verification script for the Phase 4 voice layer. This is the exact
> procedure the blocking `checkpoint:human-verify` (04-03 Task 3) follows. It maps
> ROADMAP Phase 4 Success Criteria **SC1** (real-iOS restart loop) and **SC5**
> (10-minute continuous session) to concrete on-device actions. CI cannot run any
> of this — the recognizer lifecycle is unit-covered against `FakeRecognition`,
> but real-mic / real-Safari behaviour is the phase's #1 documented risk
> (STATE.md blocker) and must be observed on hardware.

## How to run

1. Start the app against the backend: `cd frontend && npm run dev` (ensure the
   backend `/agent` endpoint is reachable — voice reuses the exact text pipeline).
2. Open the site on a **real iPhone in Safari** (primary), and separately on
   **desktop Chrome/Edge** (the `continuous=true` path).
3. Grant the microphone permission when first prompted.
4. Work top-to-bottom. For each step record **PASS / FAIL** and, on failure, the
   **exact step + observed behaviour + device/OS/browser** so a `--gaps` plan can
   target it.

## Record the environment (fill in before starting)

| Field | Value |
|-------|-------|
| iPhone model | ____________________ |
| iOS version | ____________________ |
| Safari version | ____________________ |
| Desktop OS | ____________________ |
| Desktop browser + version (Chrome/Edge) | ____________________ |
| Android device (optional) + Chrome version | ____________________ |
| `WAKE_WORD` under test | `dashboard` (default, D-04) |
| Test date / tester | ____________________ |

---

## 1. Permission flow (first-run)

- [ ] **1.1** On the FIRST mic tap, the browser prompts for microphone permission
      exactly once. **Expected:** a single calm, non-technical prompt; no crash,
      no repeated prompts.
- [ ] **1.2** Granting permission opens the session — the bar shows
      `LISTENING — say "dashboard…"` with the green ring. **Expected:** session is
      live immediately after granting; no second tap required.
- [ ] **1.3** The text input + Send button remain visible and usable throughout
      (the voice layer never hides the fallback, VOICE-08).

## 2. Restart-loop spike — 60s silence (RESEARCH Open Q1 / SC1 / D-12)

- [ ] **2.1** Tap the mic, say **"dashboard show pulse"**. **Expected:** the chart
      switches to the pulse view and a confirmation replaces the transcript.
- [ ] **2.2** Now stay **completely SILENT for 60 seconds**. **Expected:** the
      indicator stays `LISTENING` the entire time; the recognizer auto-restarts
      invisibly through the iOS silence auto-stop — no visible flicker, no
      "paused", no caregiver action.
- [ ] **2.3** After the 60s silence, say **"dashboard last 30 days"** WITHOUT
      re-tapping the mic. **Expected:** the date range applies and the chart
      updates — proving the hands-free restart loop survived the silence (SC1).

## 3. 10-minute continuous session (SC5)

- [ ] **3.1** With one initial mic tap, run a **full 10-minute session** issuing a
      command roughly every 1–2 minutes with **intermittent long silences**
      (30–90s) between them. Suggested commands: `dashboard show blood pressure`,
      `dashboard mornings only`, `dashboard last 90 days`, `dashboard show all data`.
- [ ] **3.2** **Expected:** across the whole 10 minutes the indicator stays
      `LISTENING` between commands; every command applies; **no caregiver re-tap
      is ever needed** and the session never silently dies (SC5).
- [ ] **3.3** Note any moment the session dropped to `Voice paused` or stopped
      responding, with the elapsed time and what preceded it.

## 4. Trigger-gating — room chatter (D-02)

- [ ] **4.1** With a session open, hold a normal conversation / play background
      speech that does **NOT** contain the word "dashboard" for ~30s.
      **Expected:** the dashboard NEVER changes; no transcript of room speech is
      shown (only the armed hint remains).
- [ ] **4.2** Record a subjective **false-trigger impression** for `"dashboard"`:
      did casual speech ever accidentally trigger a command? (D-04 UAT tuning
      knob — this decides whether the wake word needs changing.)
      Impression: ____________________

## 5. Hard-failure fallback (D-14 / VOICE-08)

- [ ] **5.1** Deny (or revoke in Settings, then reload and deny) the microphone
      permission and tap the mic. **Expected:** the bar shows
      `Voice paused — tap to resume` with the mic-off glyph — never a raw
      permission error string (VOICE-07).
- [ ] **5.2** With voice paused, type a command in the text box and press Send /
      Enter. **Expected:** the text path still works and applies the command —
      Chris is never trapped in a dead voice state.

## 6. Cross-browser matrix

Repeat the **core flow** — tap mic → `dashboard show blood pressure` → confirm the
chart switches → `dashboard mornings only` → confirm — on each target:

| Browser / device | Path | Core flow passes? | Notes |
|------------------|------|-------------------|-------|
| Safari / iOS (real iPhone) | onend restart loop | [ ] PASS / [ ] FAIL | primary target |
| Chrome (desktop) | `continuous=true` | [ ] PASS / [ ] FAIL | |
| Edge (desktop) | `continuous=true` | [ ] PASS / [ ] FAIL | |
| Chrome / Android (optional) | restart loop | [ ] PASS / [ ] FAIL | **expected caveat:** OS mic-restart **beep** on each restart (documented, RESEARCH Pitfall 3) — note if intrusive |

---

## Pass criteria (checkpoint gate)

The checkpoint is **approved** only when ALL of the following hold:

- [ ] **§2 restart-loop spike** passes on the real iPhone (new command applies
      after 60s silence without re-tapping) — **SC1**.
- [ ] **§3 10-minute continuous session** passes on the real iPhone with no
      caregiver intervention — **SC5**.
- [ ] **§4 trigger-gating** holds — room speech without "dashboard" never mutates
      the dashboard (D-02).
- [ ] **§5 paused fallback** shows the fixed copy and the text input still works
      (D-14 / VOICE-08).
- [ ] **§6 core flow** passes on desktop Chrome/Edge.

If any of the above FAILS, record the exact failing step + observed behaviour +
device/OS/browser and report it so a `--gaps` plan can target the fix. Resume the
checkpoint by typing **"approved"** (all pass) or a description of the failing step.
