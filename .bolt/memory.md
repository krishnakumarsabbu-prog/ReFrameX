# Project memory

## Product intent & audience

- ReframeX is a mainframe migration assessment accelerator; output is analysis, not migration.
- Primary users: migration assessors and reviewers needing traceable, evidence-classified findings.

## Brand personality & voice

- Evidence-driven, cautious, transparent; avoids overclaiming (no "full semantic analysis").
- Technical but calm; communicates uncertainty explicitly.

## Visual design & UX direction

- True transparent frosted-glass theme; warm palette (bronze, sand, amber, soft teal, muted brown), no neon.
- Background layer: fixed full-viewport CSS gradient + 4–6 large blurred blobs, asymmetric; visible through cards.
- 4 built-in wallpapers (Warm Studio, Sand Dune, Slate Dusk, Teal Mist) + browser-only custom image; persisted locally, never uploaded.
- Glass tokens: surface white 10–18% opacity (inner tiles 22–28%), `backdrop-filter` blur 36–48px saturate(150%) brightness(1.05); 1px gradient border top-left→bottom-right; inset top highlight; radii 28/20/40–48px; max two blur layers.
- Floating chrome: wide top pill bar, icon-only left rail (active = solid white circle, dark icon), translucent bottom tab pill (active = white pill). Workspace in large rounded translucent container.
- KPI cards: dark semibold numbers, muted labels, tinted delta chips; one highlighted teal→emerald gradient focal KPI per dashboard. Coral-orange accent retained for charts/primary data.
- Dense technical views (source viewer, tables, graph, reports, drawers): near-opaque ≥90%; only outer container/headers use glass.
- Text: near-black `#1B1612` body, 65% secondary; verify 4.5:1 on worst-case background; use local tint, not more opacity.
- `prefers-reduced-transparency` / `prefers-reduced-motion` respected; Reduce transparency toggle → solid surfaces + disable blobs. No blur animation; hover = lift + brighter border only.
- All pages inherit theme via tokens; no per-page color hacks.

## Decisions, constraints & rationale

- Token-first update strategy: change design tokens, then shared components, so every page inherits.
- Theme state persisted browser-only via `useTheme` hook; no backend, no uploads (alignment with no-outbound-calls rule).
- Authoritative project rules, stack, and non-negotiables live in `.bolt/prompt`; do not restate here.
- Existing component inventory in use: `AppLayout`, `BentoCard`, `MetricCard`, `GlassRail`, `TopPillBar`, `BottomTabBar`, `Dashboard`, `PlaceholderPage`.
- Production build (Vite) is the required verification gate; bundle-size warning is acceptable, errors are not.
- Visual-only changes must not touch routes, data, logic, component behavior, or layout structure.

## Open questions & assumptions

- Assumed: single highlighted KPI per dashboard is selected manually in `Dashboard.tsx`; no auto-detection logic.
- Assumed: custom wallpaper stored as data URL in browser storage; size limits not yet validated.
- Open: whether additional dashboards beyond the current one need their own focal KPI selection.
- Open: scroll-performance with blur on lower-end hardware not measured; only "acceptable" asserted.