# loomlabs design system

> Editorial Korean tech aesthetic. Restrained palette, generous whitespace,
> strong type hierarchy, near-zero shadow. Inspired by montage.wanted.co.kr.

## Principles

1. **Borders carry weight, not shadows.** Hairline borders (`hsl(var(--border))`)
   define structure. Shadows are subtle and reserved for true elevation.
2. **One accent, used sparingly.** Vermilion is the only saturated color in
   the system. Save it for primary CTAs, focus states, and editorial highlights.
3. **Type hierarchy over chrome.** Display sizes (5xl+) with tight tracking
   replace decorative elements. Pretendard at 700 weight does the heavy lifting.
4. **Density via spacing, not borders.** Group related fields with whitespace
   and dividers. Avoid framing every element in a card.
5. **Motion is editorial.** 200ms `out-expo` for everything interactive.
   No bounces, no springs.

## Tokens

### Color (HSL custom properties)

Defined in `apps/web/src/index.css`. Light mode is default, `.dark` class flips
the scale.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | warm off-white #FAFAF7 | deep #0A0A0F | page bg |
| `--foreground` | deep ink #14141A | cream #F5F5F0 | body text |
| `--card` | white | #14141A | raised surfaces |
| `--surface-subtle` | #F5F5F0 | #14141A | quiet sections |
| `--surface-elevated` | white | #1A1A21 | tooltips, popovers |
| `--primary` | ink | cream | high-emphasis CTAs |
| `--secondary` | warm grey | dark grey | low-emphasis fills |
| `--muted` | #F5F5F0 | #1F1F26 | dividers, chip bg |
| `--muted-foreground` | #6B6B73 | #98989F | meta text |
| `--accent` | vermilion #FF4D2E | brighter #FF6B4D | brand voice |
| `--border` | #E8E8E2 | #2A2A33 | hairlines |
| `--ring` | matches accent | matches accent | focus |
| `--destructive` | red | red | errors |
| `--success` | emerald | emerald | success states |
| `--warning` | amber | amber | caution |

### Type

Primary: **Pretendard Variable** (loaded from jsDelivr CDN, dynamic Korean subset).
Mono: **JetBrains Mono** (Google Fonts).

```
font-display  Pretendard Variable + system fallback
font-sans     same as display, full system stack
font-mono     JetBrains Mono + system mono
```

Weights used: 400, 500, 600, 700.

#### Type ramp

Editorial scale - tighter tracking and looser line-height as size grows.

| Class | Size | Tracking | Line-height | Use |
|---|---|---|---|---|
| `text-xs` | 12 | +0.01em | 16 | meta, labels |
| `text-sm` | 14 | normal | 20 | UI text |
| `text-base` | 16 | normal | 26 | body |
| `text-lg` | 18 | normal | 28 | lede paragraphs |
| `text-xl` | 20 | normal | 30 | h4 |
| `text-2xl` | 24 | -0.01em | 32 | h3 |
| `text-3xl` | 30 | -0.015em | 36 | h2 |
| `text-4xl` | 36 | -0.02em | 40 | h1 |
| `text-5xl` | 48 | -0.025em | 1.1 | hero h1 |
| `text-6xl` | 60 | -0.03em | 1.05 | display |
| `text-7xl` | 72 | -0.035em | 1 | display hero |

Editorial signature: heading sizes <= 5xl use 700 weight; 6xl+ use 700 with
`text-balance` for cleaner line breaks.

#### Numerals

Use the `tabular` class on any number that may animate or align in columns.
Example: `<span className="font-mono tabular">{value}</span>`.

### Spacing & layout

- Base unit: 4px. Use Tailwind's spacing scale (`gap-3`, `p-6`, etc).
- Standard horizontal padding: `px-6` mobile, `px-8` tablet, `px-12` desktop.
- Use `.container-wide` for editorial layouts (max 1280px, generous side padding).
- Use the standard `container` class for forms and dense content (smaller padding).

### Radius

Tighter than default Tailwind. Reflects editorial stiffness over playful curves.

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 4px | tags, micro elements |
| `rounded-md` (default) | 8px | buttons, inputs |
| `rounded-lg` | 12px | cards |
| `rounded-xl` | 16px | hero cards, dialogs |
| `rounded-2xl` | 24px | rare, only for big features |
| `rounded-full` | pill | badges, avatars |

### Shadow

Almost none. We use borders.

| Token | Use |
|---|---|
| `shadow-xs` | hairline shadow on solid bands |
| `shadow-sm` | subtle elevation on hover |
| `shadow` (default) | dropdowns, popovers |
| `shadow-md` | dialogs |
| `shadow-lg` | rare - only for command palette |

### Motion

| Duration | Class | Use |
|---|---|---|
| 150ms | `duration-micro` | hover, color swap |
| 200ms | `duration-std` | default for transitions |
| 300ms | `duration-page` | route transitions, larger reveals |
| 500ms | `duration-slow` | hero animations |

Easing: `ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) for everything.

Animations defined: `animate-fade-in`, `animate-fade-up`, `animate-slide-down`,
`animate-marquee` (40s), `animate-shimmer`.

## Components

### shadcn primitives (in `apps/web/src/components/ui/`)

| Component | File | Variants |
|---|---|---|
| Button | `button.tsx` | default, accent, outline, secondary, ghost, link, destructive · sm/md/lg/icon |
| Card | `card.tsx` | Card, Header, Title, Description, Content, Footer |
| Badge | `badge.tsx` | default, secondary, outline, accent, success, warning, destructive, ghost |
| Input | `input.tsx` | standard text/email/password input |
| Label | `label.tsx` | form label tied to input |
| Separator | `separator.tsx` | horizontal / vertical hairline |

### Custom primitives

| Component | File | Purpose |
|---|---|---|
| `Eyebrow` | `eyebrow.tsx` | small uppercase label above headings (editorial signature) |
| `MonoAddress` | `mono-address.tsx` | truncated 0x address chip |
| `StatTile` | `stat-tile.tsx` | big-number stat with label, delta, hint |
| `WorkflowCard` | `workflow-card.tsx` | marketplace listing card |
| `PromptInput` | `prompt-input.tsx` | textarea + examples + ⌘+Enter submit |
| `AgentAvatar` | `agent-avatar.tsx` | circular avatar with status dot |

### Layout

| Component | File | Purpose |
|---|---|---|
| `Header` | `layout/header.tsx` | sticky nav, logo, primary nav, wallet CTA |
| `Footer` | `layout/footer.tsx` | link groups, brand statement, version line |

## Pages already templated

- `/` - landing (hero + prompt + stats + featured + how-it-works)
- `/marketplace` - browse listings with protocol filter, search, sort
- `/workflows/new` - prompt-based builder with live preview
- `/workflows/$id` - detail page with parameters, recent runs, stats
- `/agents/$id` - agent profile with stats and published workflows

## Conventions

### File-based routing (TanStack Router)

- Routes live in `src/routes/`. File names map to URL paths.
- For dynamic segments use `$param`. Example: `workflows.$id.tsx` -> `/workflows/:id`.
- Always export `Route: AnyRoute = createFileRoute(...)` to avoid TS2742
  portability issues from query-core deep types.

### Importing components

Use the `@` alias for `src/`:

```ts
import { Button } from '@/components/ui/button';
import { mockWorkflows } from '@/lib/mock';
```

### Adding a new shadcn primitive

Right now we hand-roll components in `components/ui/` to keep dep
churn low. If you need a complex Radix primitive (Dialog, Dropdown, Tooltip),
copy its source from shadcn/ui and adapt the styling tokens above.

### Adding a new color token

1. Pick HSL values for both light and dark mode.
2. Add to `:root` and `.dark` blocks in `index.css`.
3. Wire it into `tailwind.config.ts` under `theme.extend.colors`.
4. Document it here.

### Don't

- Don't add new gradients without a strong reason. Editorial = solid colors.
- Don't introduce new font families. Pretendard + JetBrains Mono cover everything.
- Don't use Tailwind's default radius scale - we override to be tighter.
- Don't drop shadows on cards by default. Use a border. Add a shadow only on hover/active.
