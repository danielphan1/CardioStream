---
phase: quick-260914-lff
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [frontend/public/favicon.svg]
autonomous: true
requirements: ["N/A - quick task, no ROADMAP phase"]

must_haves:
  truths:
    - "Boat shapes (mast, main sail, jib sail, hull) render as white fill with a navy outline instead of solid purple/blue"
    - "Water line reads as a pronounced wave (bigger undulation than before), not a flat/subtle ripple"
    - "Icon still reads clearly as a sailboat-on-water at 16x16"
  artifacts:
    - path: "frontend/public/favicon.svg"
      provides: "Outlined white-boat-on-navy-wave favicon"
      contains: "stroke-linejoin=\"round\""
  key_links:
    - from: "frontend/index.html"
      to: "frontend/public/favicon.svg"
      via: "existing <link rel=\"icon\"> reference (unchanged)"
      pattern: "href=\"/favicon.svg\""
---

<objective>
Restyle the existing sailboat favicon: change the 4 boat shapes (mast, main sail, jib sail, hull) from solid purple/blue fills to white fill + navy stroke outline, and redraw the water line as a more pronounced wavy path.

Purpose: Pure visual refinement of the favicon shipped in the prior quick task -- same silhouette, new fill/stroke treatment per user request.
Output: frontend/public/favicon.svg edited in place (shapes only). No other files change.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/public/favicon.svg
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle boat fills to white+navy outline and widen the wave</name>
  <files>frontend/public/favicon.svg</files>
  <action>
Edit frontend/public/favicon.svg in place. Keep the existing viewBox "0 0 32 32", keep the existing shape geometry (rect/polygon/path points/d coordinates unchanged), and do not touch frontend/index.html.

For each of the 4 boat shapes -- mast (the rect element), main sail (polygon points 16.5,5 23,19 16.5,19), jib sail (polygon points 15.5,8 11,19 15.5,19), hull (the path starting M4,19 L28,19 L24,24.5) -- change fill from the current #863bff/#47bfff to fill="#ffffff", and add stroke="#1a2b6d" stroke-width="1.2" stroke-linejoin="round". Exception: on the mast rect specifically, use stroke-width="1" instead of 1.2, since the rect is only 1 unit wide and a thicker stroke would swallow the white fill entirely.

Replace the water-line path (currently d="M0,27 Q4,25 8,27 T16,27 T24,27 T32,27" with stroke #47bfff stroke-width 2) with a wavier version using a bigger amplitude: d="M0,28 Q4,24 8,28 T16,28 T24,28 T32,28". Keep stroke="#1a2b6d" stroke-width="2" fill="none" stroke-linecap="round" on this path (no fill, single stroked path, navy tone). This doubles the excursion (28 to 24 vs the old 27 to 25) so the S-curve undulation is visually obvious at 16px while every coordinate still stays inside the 0-32 viewBox.

Leave everything else in the SVG unchanged: root svg attributes, element order, element count, and all non-color/non-stroke attributes.
  </action>
  <verify>
    <automated>cd frontend/public && python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('favicon.svg')" && test "$(grep -c '#863bff\|#47bfff' favicon.svg)" = "0" && test "$(grep -o 'fill=\"#ffffff\"' favicon.svg | wc -l | tr -d ' ')" = "4" && grep -q 'stroke-linejoin="round"' favicon.svg && echo OK</automated>
  </verify>
  <done>frontend/public/favicon.svg is valid XML; the mast, main sail, jib sail, and hull all use fill="#ffffff" with a navy (#1a2b6d) stroke and stroke-linejoin="round"; the water-line path uses the new wider-amplitude d attribute (28/24 excursion) with no fill; no #863bff or #47bfff remain anywhere in the file; frontend/index.html is untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

None. Static SVG asset served from frontend/public with no user input, no script content, no external references.

## STRIDE Threat Register

N/A -- no new trust boundary, no dynamic behavior, no dependency install. This is a static, hand-authored SVG markup edit only.
</threat_model>

<verification>
Run: `cd frontend/public && python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('favicon.svg')"` -- must exit 0 (valid XML).
Run: `grep -c '#863bff\|#47bfff' frontend/public/favicon.svg` -- must be 0 (old palette fully replaced).
Visual check (manual, optional): `open frontend/public/favicon.svg` and confirm the boat reads as a white hull/sails with a clear navy outline over a distinctly wavy navy water line, still recognizable at a shrunk-down/tab-icon size.
</verification>

<success_criteria>
- frontend/public/favicon.svg: mast, main sail, jib sail, hull all white-filled with navy stroke outlines (stroke-linejoin round).
- Water line redrawn with visibly larger wave amplitude than the original, still a single stroked (no-fill) navy path.
- viewBox unchanged (0 0 32 32); frontend/index.html unchanged.
- SVG is valid XML and the boat is still legible as a sailboat-on-water at 16x16.
</success_criteria>

<output>
Create `.planning/quick/260914-lff-restyle-favicon-sailboat-white-fills-wit/260914-lff-SUMMARY.md` when done
</output>
