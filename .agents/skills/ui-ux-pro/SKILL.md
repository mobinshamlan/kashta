---
name: ui-ux-pro
description: Plan, prototype, and improve product UX and responsive interfaces. Use for app redesigns, homepage or planner changes, navigation, user flows, interaction design, and UI reviews.
---

# UI/UX Pro

Use this skill as the product and interaction-design lead. Make the product easier to understand and use before polishing its surface.

## Workflow

1. Identify the user’s main task, supported data, and existing behavior. Read relevant project instructions and inspect only the routes and components in scope.
2. Map the shortest useful journey and the screens it touches. Show a useful answer early; make secondary controls optional and progressively revealed.
3. Create a concise, reviewable prototype or screen sketch for desktop and mobile before a broad implementation. Prefer one clear recommendation over a long menu of concepts.
4. Preserve working features and existing data contracts. Do not invent results or retain controls that do not affect the outcome without explaining their role.
5. Design for the project’s supported languages, including correct RTL and LTR behavior, readable type, keyboard use, touch targets, and clear focus states.
6. After implementation, inspect rendered desktop and mobile screens. Fix the largest usability issues before finalizing.

## KASHTA product context

KASHTA helps people choose a good upcoming Saudi night and nearby place for a kashta or stargazing, then make a simple plan. Arabic is primary; English is secondary. Current verified coverage is around Riyadh, while Saudi-wide is the longer-term vision. Use project data for all locations, forecast, permit, and recommendation claims. Treat Rawdat Khuraim as unverified and keep it out of recommendations unless project evidence changes.

The first screen should make the useful recommendation easy to see before asking for settings. Kashta and stargazing should both be understandable choices. Keep explanations short and grounded in actual values. AI may help interpret preferences or explain results; it is not a source of truth.

## Collaboration

For substantial work, use at most two subagents at a time on independent tasks with clear, non-overlapping file ownership. Check the current diff before assigning implementation work. Keep the primary agent responsible for integration. Reuse agents for focused review after implementation; avoid repeating broad audits and request concise findings.
