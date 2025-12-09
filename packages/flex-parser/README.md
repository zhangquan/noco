# @workspace/flex-parser

> Convert absolute positioning (frame coordinate system) design schema to CSS Flex layout structure

A powerful layout converter that transforms design schemas using absolute positioning to CSS Flex layout structures. This is a core capability for visual design tools to frontend code conversion.

## 🚀 Quick Start

```typescript
import { layoutParser, docLayoutParser, createSchema } from '@workspace/flex-parser';

// Create a schema with absolute positioning
const schema = createSchema('Container', {
  frame: { left: 0, top: 0, width: 400, height: 300 },
  children: [
    createSchema('Box', { frame: { left: 20, top: 20, width: 100, height: 50 } }),
    createSchema('Box', { frame: { left: 140, top: 20, width: 100, height: 50 } }),
    createSchema('Box', { frame: { left: 260, top: 20, width: 100, height: 50 } }),
  ],
});

// Convert to flex layout
const flexSchema = layoutParser(schema);

// Result will have:
// - layoutType: 'row'
// - style.display: 'flex'
// - style.flexDirection: 'row'
// - Calculated gaps, padding, etc.
```

## 📁 Project Structure

```
src/
├── index.ts                    # Entry file, exports main API
├── types.ts                    # TypeScript type definitions
├── layout/
│   ├── calculateLayout.ts      # Core: layout calculation engine
│   ├── checkLayout.ts          # Smart layout detection algorithms
│   ├── split.ts                # Row/column split algorithms
│   └── style.ts                # Flex style generator
└── utils/
    ├── frameUtil.ts            # Coordinate and Frame utilities
    ├── jsx2Schema.ts           # JSX to Schema converter
    ├── NSTreeUtil.ts           # Tree traversal utilities
    └── utils.ts                # General utility functions
```

## 🔄 Core Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Input Schema   │ -> │  Layout Engine   │ -> │  Output Schema  │
│  (Absolute Pos) │    │  layoutParser    │    │  (Flex Layout)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
      │                        │                       │
      ▼                        ▼                       ▼
   frame coords         Row/Column Split          style props
   {left,top,          layoutType: row/column    display: flex
    width,height}      Recursive processing      flexDirection, etc.
```

## 📖 API Documentation

### Main Functions

#### `layoutParser(tree: NodeSchema): NodeSchema`

Parse a node tree and convert absolute positioning to Flex layout.

```typescript
const result = layoutParser(schema);
```

#### `docLayoutParser(doc: NodeSchema): NodeSchema`

Parse a complete document structure (Document -> Page/Modal).

```typescript
const doc = createSchema('Document', {
  children: [
    createSchema('Page', { frame: {...}, children: [...] }),
  ],
});
const result = docLayoutParser(doc);
```

#### `splitToRow(nodes: NodeSchema[]): SplitResult`

Try to split elements into rows (horizontal groups stacked vertically).

#### `splitToColumn(nodes: NodeSchema[]): SplitResult`

Try to split elements into columns (vertical groups arranged horizontally).

#### `jsx2Schema(jsxElement: JSXElement): NodeSchema`

Convert JSX element structure to Schema format.

### Utility Functions

#### Frame Utilities

```typescript
import {
  normalizeFrame,
  getNodeFrame,
  framesOverlap,
  getBoundingFrame,
  calculatePadding,
  sortFramesByPosition,
} from '@workspace/flex-parser';
```

#### Tree Utilities

```typescript
import {
  traverseTree,
  mapTree,
  findNode,
  findAllNodes,
  cloneTree,
} from '@workspace/flex-parser';
```

## 📐 Data Structures

### NodeSchema

| Field | Type | Description |
|-------|------|-------------|
| `componentName` | string | Component name identifier |
| `frame` | object | Absolute positioning `{left, top, width, height, right?, bottom?}` |
| `children` | NodeSchema[] | Child nodes |
| `props` | object | Component props including style |
| `layoutType` | string | Layout type (output): `row` / `column` / `mix` |
| `x-layout` | object | Extended layout configuration |

### x-layout Configuration

| Field | Type | Description |
|-------|------|-------------|
| `alignHorizontal` | string | `left` / `center` / `right` / `justify` / `space-between` |
| `alignVertical` | string | `top` / `middle` / `bottom` / `stretch` |
| `resize.width` | string | Width grow type: `fill` / `fit` / `fix` |
| `resize.height` | string | Height grow type: `fill` / `fit` / `fix` |
| `fixed` | boolean | Whether to use fixed positioning |

## 🎯 Core Concepts

### GrowType (Sizing Behavior)

| Type | Description | CSS Output |
|------|-------------|------------|
| `fill` | Fill available space | `flex: 1 1 auto` |
| `fit` | Fit content size | Default behavior |
| `fix` | Fixed size | `width/height: Npx` |

### LayoutType

| Type | Description | CSS |
|------|-------------|-----|
| `row` | Horizontal arrangement | `flex-direction: row` |
| `column` | Vertical arrangement | `flex-direction: column` |
| `mix` | Mixed layout | Some children use `position: absolute` |

### Alignment Mapping

**Horizontal Alignment (alignHorizontal):**

| Value | Row Layout | Column Layout |
|-------|------------|---------------|
| `left` | `justify-content: flex-start` | `align-items: flex-start` |
| `center` | `justify-content: center` | `align-items: center` |
| `right` | `justify-content: flex-end` | `align-items: flex-end` |
| `justify` | `justify-content: space-between` | - |

**Vertical Alignment (alignVertical):**

| Value | Row Layout | Column Layout |
|-------|------------|---------------|
| `top` | `align-items: flex-start` | `justify-content: flex-start` |
| `middle` | `align-items: center` | `justify-content: center` |
| `bottom` | `align-items: flex-end` | `justify-content: flex-end` |
| `stretch` | `align-items: stretch` | - |

## 🧠 Algorithm Overview

### Layout Calculation Flow

```
1. Traverse node tree
        ↓
2. Normalize frames (calculate right/bottom values)
        ↓
3. Classify children
   ├── normal: Normal flow elements
   ├── absolute: Absolute positioned (overlapping or fixed)
   ├── hidden: Hidden elements
   └── slot: Slot elements
        ↓
4. Determine layout direction
   ├── Try splitToRow
   ├── Try splitToColumn
   └── Choose optimal direction
        ↓
5. Recursively create layout structure
        ↓
6. Generate styles (flex, padding, margin, dimensions)
```

### Split Algorithm

**Row Split** (elements sorted by bottom coordinate):
- Detect vertical gaps between adjacent elements
- Split when gap exceeds threshold

**Column Split** (elements sorted by right coordinate):
- Detect horizontal gaps between adjacent elements
- Split when gap exceeds threshold

**Tolerance Mechanism**:
- Allows some element overlap (negative threshold)
- Column tolerance: ~1/4 element width
- Row tolerance: ~1/5 element height

### Layout Selection Priority

1. **Loop Layout**: Direction based on child element dimensions
2. **Slot Layout**: Default to row layout
3. **Single Child**: Default layout
4. **Multiple Children**:
   - Can split into multiple rows → column layout
   - Can split into multiple columns → row layout
   - Neither works → mix layout

## 💡 Design Highlights

1. **Smart Split Algorithm**: Automatically determines row/column layout based on element spacing
2. **Tolerance Mechanism**: Handles minor element overlaps gracefully
3. **Recursive Architecture**: Properly handles nested layout structures
4. **GrowType System**: Supports flexible responsive layouts
5. **Complete Alignment Mapping**: Full mapping from design tool alignment to Flex properties

## 📦 Installation

```bash
# In the monorepo
pnpm add @workspace/flex-parser
```

## 🔧 Development

```bash
# Build
pnpm run build

# Type check
pnpm run typecheck

# Run tests
pnpm run test
```

## License

MIT
