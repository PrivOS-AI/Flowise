# Design Guidelines

**Project:** Claude Workspace
**Last Updated:** 2026-01-17

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Component Patterns](#component-patterns)
6. [Git Graph Component](#git-graph-component)
7. [Accessibility](#accessibility)

---

## Design Principles

### Core Principles

1. **Clarity First**: Prioritize readability and clear information hierarchy
2. **Compact Efficiency**: Optimize for narrow sidebar spaces (300-400px)
3. **Consistent Patterns**: Reuse established design patterns across components
4. **Performance**: Smooth interactions, no layout shifts
5. **Accessibility**: WCAG 2.1 AA minimum for all components

### Design Philosophy

- **Mobile-First**: Design for smallest viewport first, scale up
- **Dark-First**: Primary theme is dark, ensure high contrast
- **Information Density**: Show maximum useful info in minimal space
- **Progressive Disclosure**: Hide secondary info, reveal on hover/interaction

---

## Color System

### Theme Variables

Using Tailwind CSS 4 with custom color tokens:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --secondary: oklch(0.97 0 0);
  --muted: oklch(0.97 0 0);
  --accent: oklch(0.97 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.93 0 0);
  --primary: oklch(0.85 0 0);
  --card: oklch(0.195 0 0);
  --accent: oklch(0.25 0 0);
  --border: oklch(0.3 0 0);
}
```

### Semantic Colors

**Git Graph Colors:**
- Main branch: `#f59e0b` (amber)
- Feature branches: `#3b82f6` (blue), `#22c55e` (green), `#a855f7` (purple)
- Orphan commits: `#6b7280` (gray)

**Commit Type Colors:**
- feat: `text-green-400` (#4ade80)
- fix: `text-red-400` (#f87171)
- docs: `text-blue-400` (#60a5fa)
- refactor: `text-purple-400` (#c084fc)
- chore: `text-gray-400` (#9ca3af)
- style: `text-pink-400` (#f472b6)
- test: `text-yellow-400` (#facc15)
- perf: `text-orange-400` (#fb923c)
- ci: `text-cyan-400` (#22d3ee)
- build: `text-indigo-400` (#818cf8)

**Branch Badge Colors:**
- main/master: `bg-blue-500/20 text-blue-400`
- feature branches: `bg-green-500/20 text-green-400`
- tags: `bg-yellow-500/20 text-yellow-400`

### Contrast Requirements

- Normal text: 4.5:1 minimum (WCAG AA)
- Large text (18px+): 3:1 minimum
- UI components: 3:1 minimum
- All color combinations tested against dark/light backgrounds

---

## Typography

### Font Stack

```css
--font-sans: 'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'Geist Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace;
```

### Type Scale

- **Heading 1**: `text-2xl` (24px), `font-bold`
- **Heading 2**: `text-xl` (20px), `font-semibold`
- **Heading 3**: `text-lg` (18px), `font-semibold`
- **Body**: `text-sm` (14px), `font-normal`
- **Small**: `text-xs` (12px), `font-normal`
- **Tiny**: `text-[10px]` (10px), `font-medium`
- **Micro**: `text-[9px]` (9px), `font-medium`

### Line Heights

- Headings: `leading-tight` (1.25)
- Body text: `leading-relaxed` (1.625)
- Compact lists: `leading-normal` (1.5)

---

## Spacing

### Scale

Using Tailwind's spacing scale with custom additions:

- `0.5`: 2px
- `1`: 4px
- `1.5`: 6px
- `2`: 8px
- `3`: 12px
- `4`: 16px
- `6`: 24px
- `8`: 32px

### Component Spacing

**Git Graph:**
- Row height: `32px`
- Card padding: `px-2 py-1.5` (8px horizontal, 6px vertical)
- Element gap: `gap-1.5` (6px)
- Graph lane width: `14px`
- Graph offset: `6px`

**General:**
- Section padding: `p-4` (16px)
- Section gap: `gap-2` (8px)
- Card padding: `p-3` (12px)

---

## Component Patterns

### Card Pattern

```tsx
<div className="bg-card border border-border rounded-md p-3">
  {/* Card content */}
</div>
```

**Variations:**
- Hover: `hover:bg-accent/30 transition-colors`
- Interactive: `cursor-pointer`
- Focus: `focus:ring-2 focus:ring-ring`

### Badge Pattern

```tsx
<span className="px-1.5 py-0.5 text-[9px] font-medium rounded-sm bg-blue-500/20 text-blue-400">
  {label}
</span>
```

**Variations:**
- Main/master: `bg-blue-500/20 text-blue-400`
- Feature: `bg-green-500/20 text-green-400`
- Tag: `bg-yellow-500/20 text-yellow-400`

### Truncation Pattern

```tsx
<div className="flex items-center gap-1.5 min-w-0">
  <span className="truncate">{longText}</span>
  <span className="shrink-0">{fixedElement}</span>
</div>
```

**Key:**
- Parent: `min-w-0` to allow shrinking
- Truncating child: `truncate`
- Fixed elements: `shrink-0`

---

## Git Graph Component

### Ungit-Style Layout Pattern

**Layout Structure:** Commit card (left) + Graph (right) + Inline badges

**File Structure:**
- `git-graph.tsx`: Container component, manages state and layout
- `git-commit-item.tsx`: Commit card with message and metadata
- `graph-renderer.tsx`: SVG visualization with dots, lines, and badges
- `lane-calculator.ts`: Lane assignment algorithm
- `path-generator.ts`: SVG path generation

### Commit Card Component

**Purpose:** Display commit information in compact card format

**Structure:**
```tsx
<div className="commit-card px-2 py-1.5 rounded hover:bg-accent/30">
  <div className="commit-message-line">
    <span className="commit-type">feat</span>
    <span className="commit-scope">(git)</span>
    <span className="commit-subject truncate">message text...</span>
  </div>
  <div className="commit-metadata text-[10px] text-muted-foreground/70">
    <span>author</span> • <span>2h ago</span> • <span>hash</span>
  </div>
</div>
```

**Styling:**
- Message line: `text-sm`, conventional commit syntax highlighting
- Metadata line: `text-[10px]`, muted color, flex with gaps
- Hover: `hover:bg-accent/30`, smooth transition
- Cursor: `cursor-pointer`

**Truncation:**
- Subject uses `truncate` for ellipsis
- Metadata shows on second line (sidebar > 380px) or hover tooltip

### Graph Renderer Component

**Purpose:** Render git topology with dots, lines, and inline badges

**Structure:**
```tsx
<svg width={width} height={height}>
  {/* Paths first (below dots) */}
  {paths.map(path => (
    <path d={path.d} stroke={path.color} />
  ))}

  {/* Commit dots */}
  {lanes.map(lane => (
    <circle cx={x} cy={y} r={4} fill={lane.color} />
  ))}

  {/* Inline badges with foreignObject */}
  {lanes.map(lane => lane.refs.length > 0 && (
    <foreignObject x={badgeX} y={badgeY} width="100" height="20">
      <div className="flex gap-1">
        {lane.refs.map(ref => (
          <span className="branch-badge">{ref}</span>
        ))}
      </div>
    </foreignObject>
  ))}
</svg>
```

**Constants:**
```typescript
LANE_WIDTH = 14;      // Horizontal spacing between lanes
ROW_HEIGHT = 32;      // Vertical spacing between commits
DOT_RADIUS = 4;       // Commit dot size
CURVE_CONTROL = 0.4;  // Bézier curve control point
```

**Badge Positioning:**
- X: `(lane * LANE_WIDTH) + DOT_RADIUS + 6` (6px gap from dot)
- Y: `(index * ROW_HEIGHT) + (ROW_HEIGHT / 2) - 10` (vertically centered)
- Max badges: 2 inline, "+N more" indicator for overflow

### Layout Integration

**Container Layout:**
```tsx
<div className="flex items-stretch" style={{ height: '32px' }}>
  {/* Commit card - flexible width */}
  <div className="flex-1 min-w-0">
    <GitCommitItem />
  </div>

  {/* Graph - fixed width */}
  <div className="shrink-0" style={{ width: graphWidth }}>
    <GraphRenderer />
  </div>
</div>
```

**Graph Width Calculation:**
```typescript
const graphWidth = (maxLane + 1) * LANE_WIDTH + padding;
// Typical: 60-80px for repos with 3-4 active lanes
```

### Responsive Behavior

**Narrow Sidebar (300px):**
- Commit card: ~220px
- Graph: ~80px
- Metadata: hover tooltip

**Standard Sidebar (400px):**
- Commit card: ~320px
- Graph: ~80px
- Metadata: second line inline

**Wide Sidebar (500px+):**
- Commit card: ~420px+
- Graph: ~80px
- Metadata: second line with author inline

### Interaction States

**Hover:**
- Commit card: `bg-accent/30` background
- Graph dot: highlight with pulsing ring
- Entire row: lift effect with subtle shadow (optional)

**Click:**
- Opens commit details modal
- Shows full diff, files changed, commit info
- Maintains context with highlighted commit in graph

**Focus:**
- Keyboard navigation support
- Focus ring on commit card: `focus:ring-2 focus:ring-ring`
- Tab order: top to bottom

---

## Accessibility

### Color Contrast

All color combinations meet WCAG 2.1 AA:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

**Tested Combinations:**
- Commit type colors vs dark background: ✓
- Branch badge colors vs background: ✓
- Metadata text vs background: ✓

### Keyboard Navigation

- Tab: Navigate through commits
- Enter/Space: Open commit details
- Escape: Close modal
- Arrow keys: Navigate commit list (optional)

### Screen Reader Support

**Commit Card:**
```tsx
<div
  role="button"
  aria-label={`Commit by ${author}: ${message}`}
  tabIndex={0}
>
  {/* Card content */}
</div>
```

**Graph Dots:**
```tsx
<circle
  aria-label={`Commit ${shortHash} on ${branch}`}
  role="presentation"
/>
```

### Focus Management

- Visible focus indicators on all interactive elements
- Focus trap in modal dialogs
- Focus restoration on modal close

---

## Best Practices

### Do's

✓ Use semantic HTML elements
✓ Maintain consistent spacing with design tokens
✓ Test all components in dark and light themes
✓ Ensure text truncation with `truncate` and `min-w-0`
✓ Use `shrink-0` for fixed-width elements
✓ Add hover states for interactive elements
✓ Provide aria-labels for non-text content
✓ Test keyboard navigation

### Don'ts

✗ Don't use arbitrary values (prefer design tokens)
✗ Don't forget hover states on clickable elements
✗ Don't nest truncate without proper parent width
✗ Don't use color as only indicator (add text/icons)
✗ Don't skip accessibility testing
✗ Don't create layout shifts on interaction
✗ Don't use fixed pixel widths (prefer flex/responsive)

---

## Component Examples

### Example 1: Git Commit Card

```tsx
import { cn } from '@/lib/utils';

interface CommitCardProps {
  commit: GitCommit;
  onClick?: () => void;
}

export function CommitCard({ commit, onClick }: CommitCardProps) {
  const { type, scope, subject } = parseCommitMessage(commit.message);

  return (
    <div
      className={cn(
        "px-2 py-1.5 rounded cursor-pointer",
        "hover:bg-accent/30 transition-colors"
      )}
      onClick={onClick}
    >
      <div className="flex items-baseline gap-1.5 min-w-0">
        {type && (
          <>
            <span className={cn("font-semibold text-sm", getTypeColor(type))}>
              {type}
            </span>
            {scope && (
              <span className="text-sm text-muted-foreground/70">{scope}</span>
            )}
            <span className="text-muted-foreground">:</span>
          </>
        )}
        <span className="truncate text-sm">{subject}</span>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 mt-0.5">
        <span>{commit.author}</span>
        <span>•</span>
        <span>{commit.date}</span>
        <span>•</span>
        <span>{commit.shortHash}</span>
      </div>
    </div>
  );
}
```

### Example 2: Branch Badge

```tsx
interface BranchBadgeProps {
  name: string;
  type: 'main' | 'feature' | 'tag';
}

export function BranchBadge({ name, type }: BranchBadgeProps) {
  const colorClasses = {
    main: 'bg-blue-500/20 text-blue-400',
    feature: 'bg-green-500/20 text-green-400',
    tag: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <span className={cn(
      "px-1.5 py-0.5 text-[9px] font-medium rounded-sm",
      colorClasses[type]
    )}>
      {name}
    </span>
  );
}
```

---

## Version History

- **2026-01-17**: Initial creation with ungit-style git graph pattern
- Future updates will be documented here

---

**End of Guidelines**
