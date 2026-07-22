# AgentStudio — Design System

## Brand Essence
Tool-craftsmanship. Monochrome precision, dark-first. Every pixel intentional, nothing decorative. Think: developer tool meets editorial restraint.

## Palette

| Token | Dark | Light |
|-------|------|-------|
| `--bg` | `#0a0a0a` | `#fafafa` |
| `--surface` | `#111111` | `#ffffff` |
| `--elevated` | `#161616` | `#ffffff` |
| `--hover` | `#1a1a1a` | `#e5e5e5` |
| `--border` | `#2a2a2a` | `#dbdbdb` |
| `--border-subtle` | `#1f1f1f` | `#e5e5e5` |
| `--fg` (primary) | `#f5f5f5` | `#0a0a0a` |
| `--muted` (secondary) | `#f5f5f5` 60% | `#0a0a0a` 60% |
| `--muted-subtle` | `#f5f5f5` 38% | `#0a0a0a` 38% |
| `--accent` | `#c0c0c0` | `#333333` |
| `--success` | `#66bb6a` | `#388e3c` |
| `--error` | `#ff6b6b` | `#d32f2f` |
| `--warning` | `#ffa726` | `#f57c00` |

One accent only — a silver-gray `#c0c0c0`. Used at most twice per screen: active state + primary CTA.

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display | Geist Variable (`--font-sans`) | 600 | clamp(24px, 4vw, 44px) |
| Heading 2 | Geist Variable | 600 | 18–22px |
| Heading 3 | Geist Variable | 600 | 15–16px |
| Body | system-ui / -apple-system / PingFang SC | 400 | 14px |
| Small / Meta | system-ui | 400 | 12–13px |
| Numeric / Code | JetBrains Mono / Fira Code | 400 | 13px |
| Eyebrow / Label | system-ui, uppercase, letter-spacing 0.08em | 500 | 11px |

## Layout
- **Three-column**: Sidebar (260px) | Workspace (360–600px) | Main (1fr)
- **Header**: 48px, border-bottom on `--border`
- **Workstation sidebar**: 168px, vertical tab groups
- **Spacing**: 4px base → 4/8/12/16/20/24/32/40/48/64px
- **Content**: `min(760px, 85vw)` centered modal, 560px max height
- **Radius**: 4px (small), 6px (default), 8px (large)

## Component Patterns

### Cards
- Background: `--surface` (`#111111`)
- Border: `--border` (`#2a2a2a`), 1px
- Radius: 6–8px
- Padding: 16px
- No shadow (flat) or subtle `0 1px 2px rgba(0,0,0,0.3)`

### Tables
- Header: `--surface`, uppercase 11px labels, `--muted-subtle` color
- Row hover: `--hover` background
- Cell padding: 10px 16px
- Font size: 13px
- No alternating row colors (clean monochrome)

### Buttons
- Primary: `--accent` bg, `--fg` for text-on-accent (`#0a0a0a`), weight 500
- Secondary: transparent, `--border` stroke, `--fg` text
- Ghost: no border, `--muted` text → `--fg` on hover
- Danger: `--error` red
- Icon: 32×32px, no bg, `--muted` icon → `--fg` hover
- All: 6px radius, 8px 16px padding (icon-only: 8px)

### Navigation (Sidebar)
- Active tab: `--accent` text + left border (3px)
- Inactive: `--muted` text
- Group headers: 10px uppercase, `--muted-subtle` 40%
- No icons, text-only for workstation sidebar

### Inputs
- Background: `--hover` (`#1a1a1a`)
- Border: `--border-subtle` → `--border` on focus
- Height: 32–36px
- Radius: 6px
- Placeholder: `--muted-subtle`

### Modals
- Width: `min(760px, 85vw)` / `min(900px, 90vw)` for large
- Max height: `min(560px, 75vh)`
- Overlay: `color-mix(in srgb, #000 60%, transparent)`
- Title: 16px, weight 600

## Tonal Guardrails
- **No** colored backgrounds (no blue/indigo/purple cards)
- **No** gradients
- **No** emoji as primary UI (only in workstation tab labels)
- **No** shadows deeper than `0 8px 16px -4px`
- **One accent color per view** — the silver-gray
- Status indicators limited to green/red/orange dots or text
