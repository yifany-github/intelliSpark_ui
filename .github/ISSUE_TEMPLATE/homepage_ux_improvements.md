---
name: 🎯 Homepage Usability & Performance Improvements
about: Improve mobile CTA visibility, onboarding, grid density, performance, and accessibility on the Characters (home) page
title: "[UX] Improve homepage (Characters) usability and performance"
labels: enhancement, ui/ux, performance
assignees: ""
---

# 🎯 Homepage (Characters) Usability & Performance Improvements

## 📋 Problem Statement
The updated homepage still has friction points that impact discoverability and conversion, especially on touch devices:
- Mobile relies on hover-only CTAs; primary actions are hidden on touch.
- No light onboarding/Hero to guide first-time users (what to do next?).
- Ultra-wide grids show 8–10 columns, increasing cognitive load.
- Filtering/sorting recomputes frequently without memoization.
- Images lack `srcSet/sizes` and LQIP placeholders, causing layout shift and heavier loads.
- Focus-visible and ARIA labels could be clearer for keyboard users.

Note: i18n consistency and router dead-links are out of scope for this issue (handled separately).

## ✅ Acceptance Criteria
- Mobile cards expose persistent primary/secondary CTAs without hover (e.g., buttons fixed at card bottom for `<sm`).
- Optional lightweight onboarding/Hero above the grid with 2 quick actions (Continue Chat, Popular Characters).
- Apply a max content width (e.g., `max-w-7xl mx-auto`) and cap columns to 6–8 on wide screens.
- Use `useMemo` for filtered/sorted results to avoid recomputation on every keystroke.
- Add responsive images via `srcSet/sizes` and a low-quality placeholder (or blurred background) to reduce CLS.
- Improve focus styles and ARIA labels on cards/search; ensure keyboard navigation flows without traps.
- Keep existing skeleton loading behavior intact.

## 🔧 Implementation Plan
- `client/src/pages/characters.tsx`: Add compact Hero/onboarding section with two quick-entry buttons.
- `client/src/components/characters/CharacterGrid.tsx`:
  - Always-show mobile CTAs, adjust layout for `sm:`+ to keep hover overlay.
  - Wrap grid in a max-width container and reduce max column count on 2xl+.
  - Memoize `filteredCharacters` and `sortedCharacters` with `useMemo`.
  - Add `img` `srcSet/sizes` and a subtle LQIP (blur/solid placeholder).
  - Strengthen `focus-visible` outlines and ensure ARIA labels come from props.
- Validate no API changes are required; ensure existing tests/builds pass.

## 🧪 Test Plan
- Mobile (<640px): CTAs visible without hover; tap flows to Preview/Start Chat.
- Desktop: Hover overlay unchanged; keyboard Tab/Enter works with visible focus.
- Performance: Typing in search does not noticeably lag on large lists.
- Visual: No layout shift on image load; skeletons still display during fetch.

## 📎 References
- Files: `client/src/pages/characters.tsx`, `client/src/components/characters/CharacterGrid.tsx`
- Related: Navigation/TopBar unchanged; i18n/route cleanup tracked separately.

