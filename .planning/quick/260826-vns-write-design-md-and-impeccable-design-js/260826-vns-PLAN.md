---
phase: quick-260826-vns
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - DESIGN.md
  - .impeccable/design.json
autonomous: true

must_haves:
  truths:
    - "DESIGN.md exists at the project root and documents the CardioStream design system (colors, typography, spacing) already implemented in frontend/src, byte-identical to the pre-drafted source"
    - ".impeccable/design.json exists and is valid, parseable JSON describing the same design system in the impeccable skill's machine-readable schema"
    - "Both files were copied verbatim — no content was regenerated, reworded, or re-derived during this task"
    - "No file under frontend/src or any other application code changed"
  artifacts:
    - path: "DESIGN.md"
      provides: "Human-readable design system documentation (name, description, colors, typography) for the CardioStream dashboard"
      contains: "CardioStream"
    - path: ".impeccable/design.json"
      provides: "Machine-readable design tokens/components schema consumed by the impeccable skill"
      contains: "schemaVersion"
  key_links:
    - from: "DESIGN.md"
      to: ".impeccable/design.json"
      via: "both describe the same already-shipped Phase 12 Visual Refresh design system, kept in sync by having been generated together in one impeccable `document` run"
      pattern: "CardioStream"
---

<objective>
Copy two already-fully-drafted files — produced earlier this session by running the `impeccable`
skill's `document` command against the existing, already-shipped frontend (Phase 12 "Visual
Refresh") — from the session scratchpad into the repository, verbatim, and commit them.

There is no design authoring left to do. The content was drafted, reviewed against the codebase,
and confirmed with the user via a short question round already, in this same session. This task is
pure file placement: copy, validate, commit.

Purpose: `DESIGN.md` and `.impeccable/design.json` give the `impeccable` skill (see CLAUDE.md's
"Conventions" section, impeccable + GSD pairing) a persistent, checked-in reference for this
project's design system, so future critique/audit passes don't have to re-derive tokens from
scratch each time.

Output: `DESIGN.md` at the project root and `.impeccable/design.json`, both committed in a single
commit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
</context>

<starting_state>
Facts already established this session — do not spend context re-deriving or re-validating these:

- Source file 1 (fully drafted, do not edit):
  `/private/tmp/claude-501/-Users-dp-Documents-GitHub-Health-Visualizer/69ba8878-00be-47b1-88c5-82ad7c1d05d1/scratchpad/DESIGN.md`
  — 280 lines, YAML-frontmatter-style document beginning `name: CardioStream`, documents colors,
  typography, and design system for the health dashboard.
- Source file 2 (fully drafted, do not edit):
  `/private/tmp/claude-501/-Users-dp-Documents-GitHub-Health-Visualizer/69ba8878-00be-47b1-88c5-82ad7c1d05d1/scratchpad/design.json`
  — 138 lines, valid JSON, top-level keys: `schemaVersion`, `generatedAt`, `title`, `extensions`,
  `components`, `narrative`. Already confirmed to parse cleanly with `JSON.parse`.
- Destination 1: `/Users/dp/Documents/GitHub/Health-Visualizer/DESIGN.md` — confirmed does NOT
  currently exist (repo root).
- Destination 2: `/Users/dp/Documents/GitHub/Health-Visualizer/.impeccable/design.json` — confirmed
  does NOT currently exist. The `.impeccable/` directory itself already exists and already holds
  `config.local.json` and `hook.cache.json` — do not touch either of those files.
- This is documentation of visual design tokens/components for work already shipped in Phase 12
  "Visual Refresh" (see `.planning/phases/12-visual-refresh/12-UI-SPEC.md` for the underlying spec).
  No application code, no frontend behavior, and no other file in the repo should change.
- Git status at planning time showed only one pre-existing untracked file (`PRODUCT.md`, unrelated
  to this task) — leave it untouched; do not stage or commit it as part of this plan.
</starting_state>

<tasks>

<task type="auto">
  <name>Task 1: Copy both design files verbatim and validate the JSON</name>
  <files>DESIGN.md, .impeccable/design.json</files>
  <action>
Copy the two source files from the scratchpad to their repo destinations byte-for-byte — do not
open, reformat, retype, or "clean up" either file's content in the process (e.g. use `cp`, not a
Read+Write round-trip that could introduce whitespace or encoding drift):

1. Copy
   `/private/tmp/claude-501/-Users-dp-Documents-GitHub-Health-Visualizer/69ba8878-00be-47b1-88c5-82ad7c1d05d1/scratchpad/DESIGN.md`
   to `/Users/dp/Documents/GitHub/Health-Visualizer/DESIGN.md`.
2. Copy
   `/private/tmp/claude-501/-Users-dp-Documents-GitHub-Health-Visualizer/69ba8878-00be-47b1-88c5-82ad7c1d05d1/scratchpad/design.json`
   to `/Users/dp/Documents/GitHub/Health-Visualizer/.impeccable/design.json` (the `.impeccable/`
   directory already exists — do not create a new one, do not touch `config.local.json` or
   `hook.cache.json` already in that directory).
3. Validate the copied JSON parses cleanly by running:
   `node -e "JSON.parse(require('fs').readFileSync('.impeccable/design.json','utf8'))"`
   from the repo root. A non-zero exit or thrown error means the copy is corrupt — re-copy and
   re-validate before proceeding; do not hand-edit the JSON to make it parse.
4. Diff both destinations against their sources to confirm byte-identical copies (e.g.
   `diff <scratchpad_path>/DESIGN.md DESIGN.md` and
   `diff <scratchpad_path>/design.json .impeccable/design.json` should both produce no output).

Do not modify frontend/src, backend code, CLAUDE.md, or any other file. Do not stage or commit the
pre-existing untracked `PRODUCT.md`.
  </action>
  <verify>
    <automated>test -f /Users/dp/Documents/GitHub/Health-Visualizer/DESIGN.md</automated>
    <automated>test -f /Users/dp/Documents/GitHub/Health-Visualizer/.impeccable/design.json</automated>
    <automated>node -e "JSON.parse(require('fs').readFileSync('/Users/dp/Documents/GitHub/Health-Visualizer/.impeccable/design.json','utf8'))"</automated>
    <automated>diff /private/tmp/claude-501/-Users-dp-Documents-GitHub-Health-Visualizer/69ba8878-00be-47b1-88c5-82ad7c1d05d1/scratchpad/DESIGN.md /Users/dp/Documents/GitHub/Health-Visualizer/DESIGN.md</automated>
    <automated>diff /private/tmp/claude-501/-Users-dp-Documents-GitHub-Health-Visualizer/69ba8878-00be-47b1-88c5-82ad7c1d05d1/scratchpad/design.json /Users/dp/Documents/GitHub/Health-Visualizer/.impeccable/design.json</automated>
    <automated>grep -q "CardioStream" /Users/dp/Documents/GitHub/Health-Visualizer/DESIGN.md</automated>
  </verify>
  <done>
`DESIGN.md` exists at the repo root and `.impeccable/design.json` exists, both byte-identical to
their scratchpad sources (confirmed via `diff`), the JSON file parses cleanly with `JSON.parse`,
and no other file in the repo (including `.impeccable/config.local.json`,
`.impeccable/hook.cache.json`, and `PRODUCT.md`) was touched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit both new files together</name>
  <files>DESIGN.md, .impeccable/design.json</files>
  <action>
Stage exactly the two new files and commit them in a single commit:
`git add DESIGN.md .impeccable/design.json`
then commit with message: `docs: add DESIGN.md and .impeccable/design.json from impeccable document command`

Confirm the commit contains exactly these two files and nothing else (in particular, confirm
`PRODUCT.md` — a pre-existing unrelated untracked file — was NOT swept into this commit).
  </action>
  <verify>
    <automated>git -C /Users/dp/Documents/GitHub/Health-Visualizer show --stat HEAD | grep -q "DESIGN.md"</automated>
    <automated>git -C /Users/dp/Documents/GitHub/Health-Visualizer show --stat HEAD | grep -q "design.json"</automated>
    <automated>test "$(git -C /Users/dp/Documents/GitHub/Health-Visualizer show --name-only --format='' HEAD | wc -l | tr -d ' ')" = "2"</automated>
  </verify>
  <done>
A single new commit exists on the current branch containing exactly `DESIGN.md` and
`.impeccable/design.json` — no other files, no application code changes, no unrelated untracked
files swept in.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| None introduced | This plan copies two static documentation/config files (a markdown design doc and a JSON design-token file) from a session scratchpad into the repo. No code path, network boundary, input parser, external dependency, or runtime behavior is touched. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-260826-vns-01 | Tampering | DESIGN.md / .impeccable/design.json (static docs) | accept | Documentation-only artifacts, no secrets, no executable content, no external input path; content was already reviewed/confirmed with the user earlier this session and copied verbatim (diffed byte-for-byte in Task 1) with no re-authoring step where drift could be introduced. |
</threat_model>

<verification>
Run from the repo root after both tasks complete:

```
test -f DESIGN.md && echo "DESIGN.md present"
test -f .impeccable/design.json && echo "design.json present"
node -e "JSON.parse(require('fs').readFileSync('.impeccable/design.json','utf8')); console.log('JSON valid')"
git show --stat HEAD
```

The `git show --stat HEAD` output must list exactly `DESIGN.md` and `.impeccable/design.json` — no
frontend/backend source files, no `PRODUCT.md`.
</verification>

<success_criteria>
- [ ] `DESIGN.md` exists at the project root, byte-identical to the scratchpad source
- [ ] `.impeccable/design.json` exists, byte-identical to the scratchpad source, and parses as valid JSON
- [ ] Both files are committed together in a single commit
- [ ] No application code (frontend/src, backend) or unrelated files changed
- [ ] Pre-existing `.impeccable/config.local.json` and `.impeccable/hook.cache.json` are untouched
</success_criteria>

<output>
Create `.planning/quick/260826-vns-write-design-md-and-impeccable-design-js/260826-vns-SUMMARY.md`
when done.
</output>
