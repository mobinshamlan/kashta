<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## KASHTA product and design preferences

These preferences apply to future product, UI, UX, and visual-design work unless the user gives different instructions.

### Product

- KASHTA helps people choose a suitable upcoming Saudi night and place for a kashta or stargazing, then make a simple plan.
- Keep KASHTA as the working name and preserve the current logo unless the user explicitly asks to change them.
- The product is Saudi-wide: verified camping sites cover nine regions, and each trip starts from a chosen city (default Riyadh). Drive times are estimates from that city.
- Use existing project data for locations, forecasts, permits, distances, and recommendations. Never invent them. Keep unverified Rawdat Khuraim out of recommendations.
- AI is an optional helper for understanding preferences and explaining results. It is not a source of truth for forecasts, locations, permits, or trust.

### Experience and visual direction

- Arabic is primary; English is secondary. Support correct RTL and LTR layouts and readable type on desktop and mobile.
- Aim for a modern, polished, distinctive Saudi desert-night identity. Use visual storytelling to make choices easier, with concise copy and clear hierarchy.
- Keep screens simple. Show the few facts needed for the current decision; place secondary detail behind an intentional details action or on a relevant detail page.
- The homepage should quickly show the selected activity, one useful upcoming-night recommendation, a simple visual week comparison, and a clear link to plan. Keep planning steps, preference questions, FAQs, and calculation explanations off the homepage. The planner belongs on `/plan`; FAQs and methodology belong on the information page.
- Make the two activities feel distinct in both imagery and content: Stargazing should clearly foreground stars and the night sky; Kashta should foreground the tent or campsite and fire. Color alone is not enough. Keep both within one coherent KASHTA identity.
- Keep planning straightforward, with one clear choice per step, sensible defaults, visible progress, and optional preferences. Make the AI helper discoverable inside the planner without making it a required step or a large chat interface.
- Keep Places easy to scan. Lead with the place name, a clear suitability signal, and one short reason. Avoid repeated metrics and unexplained scores in the main list; put secondary facts on the place page or behind a details action. Keep permit information accessible when it affects the decision.
- Use accurate, useful visuals: maps must reflect real project location data; photos must represent the named place. Mark illustrations as illustrative when there could be confusion. Avoid decorative graphics that compete with the recommendation.
- Faqqa is a reference for clarity only. Do not copy its layout, identity, colors, or assets. Use Saudi cultural references sparingly and accurately.
- Respect the official Thmanyah font license, especially its web-embedding and file-distribution limits. Do not modify, rename, or expose font files for standalone download. If this app cannot embed the font compliantly, use a suitable fallback.

### How to handle improvement requests

- When the user asks to “improve” the app, inspect the current implementation and rendered experience, identify the highest-impact issues, and implement a coherent improvement. Do not respond with suggestions alone when implementation is requested.
- Make routine, reversible design decisions independently. Ask only when essential information is missing or a choice would materially change the product direction.
- Preserve existing user changes. Check the working tree before editing; never reset, stash, overwrite, or discard unrelated work.
- For UI, UX, visual-design, and polish work, read and use the project skills in `.agents/skills/ui-ux-pro/SKILL.md` and `.agents/skills/taste-pro/SKILL.md`. These are mirrored from `.claude/skills/` so Codex can discover them. Follow their KASHTA-specific guidance. Use subagents only when the user requests them or when they clearly help with independent work; keep the main agent responsible for integration and avoid overlapping edits.
- Review the result in a fresh local preview on desktop and mobile, in Arabic and English when affected. Fix the largest visual, usability, RTL, and accessibility issues before reporting.
- Keep the final report concise: explain what changed, what was checked, and any material limitation. Do not commit, push, deploy, or merge unless the user explicitly asks.
