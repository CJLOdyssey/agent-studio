---
name: Virtual Software Dev Team
description: AI Agent collaborative workstation for software requirements
colors:
  primary: "#818cf8"
  primary-hover: "#6366f1"
  secondary: "#22d3ee"
  tertiary: "#f472b6"
  accent-amber: "#fbbf24"
  accent-emerald: "#34d399"
  accent-purple: "#c084fc"
  bg-primary: "#09090b"
  bg-secondary: "#111113"
  bg-surface: "#18181b"
  bg-elevated: "#1e1e22"
  bg-hover: "#27272a"
  border-default: "#27272a"
  border-subtle: "#1e1e22"
  text-primary: "#fafafa"
  text-secondary: "#a1a1aa"
  text-muted: "#71717a"
  icon-planning: "#818cf8"
  icon-design: "#f472b6"
  icon-dev-frontend: "#22d3ee"
  icon-dev-backend: "#34d399"
  icon-dev-fullstack: "#c084fc"
  icon-quality: "#fbbf24"
  icon-ops: "#fb923c"
  icon-error: "#f87171"
  light-bg-primary: "#ffffff"
  light-bg-secondary: "#f8f9fa"
  light-bg-surface: "#f1f3f5"
  light-bg-elevated: "#ffffff"
  light-bg-hover: "#e9ecef"
  light-border: "#dee2e6"
  light-text-primary: "#212529"
  light-text-secondary: "#495057"
  light-text-muted: "#868e96"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
  mono:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  input: "20px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"
---

# Design System: Virtual Software Dev Team

## 1. Overview

**Creative North Star: "The Team Dashboard"**

A dark-first collaborative workstation for AI agent orchestration. The interface communicates "a team is at work for you" rather than "you are chatting with a bot." Every visual choice reinforces the sense of structured, multi-role collaboration: the sidebar panels group agents by team, the chat shows role-colored messages, the workspace panel separates outputs by type.

The system uses a refined dark palette with low chroma neutrals and one vivid accent (Deep Violet) for interactive surfaces. It explicitly rejects the generic AI chatbot aesthetic (pure chat, no structure, single conversation stream) in favor of a tool-like layout with multiple information zones. The light theme variant is available but secondary; the dark theme is the default and the more polished experience.

**Key Characteristics:**
- Dark-first, structured, tool-like layout
- Low-chroma neutrals with precise color accents per role (Indigo = PM, Cyan = Frontend, Emerald = Backend, Pink = Design, Amber = Quality)
- Restrained motion: state transitions only, no decorative animation
- Editorial-density typography (13px base, tight spacing) suited for code and structured content
- Flat-by-default surfaces with tonal elevation instead of heavy shadows

## 2. Colors

Two themes: a polished dark default and a clean light variant. Accent colors serve functional roles, not decoration.

### Primary

- **Deep Violet** (`#818cf8`): Primary interactive color. Used for primary buttons, active states, focused input rings, send button. Appears on approximately 5-10% of screen real estate. Its rarity is intentional.

### Secondary

- **Sky Cyan** (`#22d3ee`): Secondary interactive color. Used for workspace tab active indicators, code header highlights, secondary accent icons. Also functions as the "frontend development" role identifier in agent lists.

### Tertiary

- **Rose Pink** (`#f472b6`): Design/creative role identifier in agent lists. Also used for string literals in syntax highlighting.

### Neutral

- **Ink Black** (`#09090b`): Primary background. The canvas.
- **Dark Gunmetal** (`#111113`): Secondary background. Sidebar panels and headers.
- **Charcoal Surface** (`#18181b`): Surface background. Cards, input areas, scroll containers.
- **Lifted Surface** (`#1e1e22`): Elevated surface. Active items, selected conversation items.
- **Hover Gray** (`#27272a`): Hover state and border. Both border and hover background share this tone.
- **White Smoke** (`#fafafa`): Primary text color.
- **Muted Silver** (`#a1a1aa`): Secondary text, metadata, less prominent copy.
- **Dim Gray** (`#71717a`): Muted text, placeholders, disabled states, non-essential labels.

### Semantic Roles

- **Emerald** (`#34d399`): Success states, backend dev role, online agent status. Used for the P0 "approved" badge.
- **Amber** (`#fbbf24`): Warning states, quality/testing role, working/processing indicator.
- **Red** (`#f87171`): Error states, danger actions, failed test indicators.
- **Orange** (`#fb923c`): Ops/devops role identifier.

### Light Theme

The light theme inverses neutrals while keeping accent colors identical. Text primary becomes `#212529`, backgrounds shift to whites and off-whites. Accent colors remain unchanged for brand consistency.

## 3. Typography

**Body Font:** System UI stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif`
**Mono Font:** `'JetBrains Mono', 'Fira Code', 'Consolas', monospace`

**Character:** Clean, dense, engineering-driven. One system font stack with weight contrast. No decorative typography. Chinese character support is built in natively. Mono is reserved for code blocks, file paths, status bar items, and timestamp display.

### Hierarchy

- **Headline** (700, 18px, 1.2): Page titles and modal headers.
- **Title** (600, 15px, 1.3): Section headers within panels, agent names, conversation titles.
- **Body** (400, 13px, 1.5): All reading text, message content, form labels, table cells.
- **Label** (600, 12px, 1.2): Form field labels, table headers. Uppercase + tracking for section headers only.
- **Small** (400, 11px, 1.3): Timestamps, metadata, helper text, status labels.
- **Mono** (400, 12px, 1.6): Code blocks, file paths, keybind hints.

## 4. Elevation

Flat-by-default with tonal layering instead of shadows. Depth is conveyed through background lightness steps (Ink Black → Dark Gunmetal → Charcoal Surface → Lifted Surface → Hover Gray) rather than drop shadows. Shadows are used sparingly for floating elements only (dropdowns, modals, fixed panels).

### Shadow Vocabulary

- **Floating** (`0 8px 16px -4px rgba(0, 0, 0, 0.5)`): Modals, popovers, full-screen workspace panels.
- **Dropdown** (`0 4px 8px -2px rgba(0, 0, 0, 0.4)`): Dropdown menus, user menu.
- **Subtle** (`0 1px 2px rgba(0, 0, 0, 0.3)`): Input wrappers at rest.

### The Flat-By-Default Rule

Surfaces at rest have no shadow. Shadows appear only on floating elements. Depth is communicated by tonal stepping, not by elevation shadows.

## 5. Components

### Buttons

- **Shape:** Slightly rounded (8px radius).
- **Primary Button:** Deep Violet (`#818cf8`) background, white text, padding 8px 20px. Hover shifts to darker violet (`#6366f1`). Active state presses down with smaller shadow. Disabled state uses hover-gray background with 0.4 opacity.
- **Send Button (Chat):** Deep Violet background, 12px border-radius, 40px min-height. Hover lifts 1px with enhanced violet glow. Active returns to rest position.
- **Ghost/Secondary:** Transparent background, hover-gray on hover. No border by default; border variant uses border-default (`#27272a`). Used for non-primary actions.
- **Danger:** Transparent background, red (`#f87171`) border and text. Hover adds red tint at 0.1 opacity.

### Inputs / Fields

- **Style:** Dark Gunmetal background (`#111113`), border at `#27272a`, 8px radius.
- **Focus:** Indigo glow (`rgba(129, 140, 248, 0.4)`) as a 3px box-shadow ring, no border color change.
- **Chat Input:** Pill-shaped (20px radius), Charcoal Surface background (`#18181b`), no rest border. Elevated with `0 4px 24px rgba(0, 0, 0, 0.35)` box-shadow. Focus ring is the same indigo glow.
- **Placeholder:** Dim Gray (`#71717a`) at 4.5:1 contrast minimum.
- **Error / Disabled:** Red border for errors, 0.5 opacity for disabled.

### Cards / Containers

- **Corner Style:** 10px for agent cards, 8px for result sections and process panels.
- **Background:** Charcoal Surface (`#18181b`). No border by default; some cards use a thin 1px solid border at `#27272a`.
- **Shadow Strategy:** None at rest. Only floating elements get shadows.
- **Internal Padding:** 16px (sp-4) horizontal, 12-16px vertical.

### Navigation

- **Sidebar:** Dark Gunmetal background, 260px fixed width. Section headers are uppercase Dim Gray (11px). Items use hover-gray highlight on hover; active items use Lifted Surface background.
- **Workspace Tabs:** No border at rest; active tab has Sky Cyan 2px bottom border and Inked Black background.
- **Mobile:** Sidebar slides in from left with backdrop overlay. Hamburger button appears at 768px breakpoint.

### Chat Messages

- **Agent Messages:** Charcoal Surface background, 12px radius with 4px radius bottom-left. Color-coded role bar (3px left border) matching the accent color of the agent type.
- **User Messages:** Lifted Surface background, 12px radius with 4px radius bottom-right. Right-aligned.
- **Message Density:** 16px bottom margin between messages, 8px internal padding.

### Status Indicators

- **Agent Status Dot:** 6px circle. Emerald for idle, Amber pulsing for working. Pulsing animation disables on `prefers-reduced-motion`.
- **Status Badge:** 10px font, inline pill. Agent status (Online/Working) uses color-coded dot + text.

### Code Display

- **Inline Code:** Charcoal Surface background, 2px 6px padding, 4px radius, mono font at 13px.
- **Code Block:** 8px radius outer container, syntax highlighting with role-colored tokens (pink strings, emerald comments, cyan keywords, indigo functions).

## 6. Do's and Don'ts

### Do:
- **Do** use tonal layering (background lightness steps) to convey hierarchy instead of shadows.
- **Do** use Deep Violet for exactly one primary action per view.
- **Do** keep the chat input pill-shaped (20px radius) with the indigo focus glow.
- **Do** use the 4px spacing scale consistently: all margins and paddings should be multiples of 4px.
- **Do** leverage the system font stack for CJK support; do not load external fonts for body text.
- **Do** provide hover states for all interactive elements, even in a "tool-like" interface.
- **Do** make copy and code accessible: mono font with sufficient size (12px minimum) and contrast.

### Don't:
- **Don't** use drop shadows on static surfaces. Shadows are for floating elements only.
- **Don't** use gradient text, glassmorphism, decorative blur, or stripe/repeating-linear-gradient backgrounds.
- **Don't** use the AI chatbot pure-chat aesthetic. This is a workstation with structured panels, not a single conversation stream.
- **Don't** place more than one Deep Violet button per viewport area. The accent's rarity is its power.
- **Don't** use border-radius larger than 12px for cards or containers. Pill shapes are reserved for the chat input and badges only.
- **Don't** hard-code colors. Use the custom property tokens from `:root` and `.light-theme`.
- **Don't** use bounce or elastic easing. Transitions use `0.15s` standard or `0.2s ease-out` for transforms.
- **Don't** animate on `prefers-reduced-motion: reduce`. All transitions and animations must have a reduced-motion alternative.
- **Don't** use em dashes in copy. Use commas, colons, or semicolons instead.
