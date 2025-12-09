/**
 * Frame coordinate system - absolute positioning
 */
export interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
  right?: number;
  bottom?: number;
}

/**
 * Layout type for flex direction
 */
export type LayoutType = 'row' | 'column' | 'mix';

/**
 * Grow type for flex sizing behavior
 * - fill: Fill available space (flex: 1 1 auto)
 * - fit: Fit content size (default behavior)
 * - fix: Fixed size (width/height: Npx)
 */
export type GrowType = 'fill' | 'fit' | 'fix';

/**
 * Horizontal alignment options
 */
export type AlignHorizontal = 'left' | 'center' | 'right' | 'justify' | 'space-between';

/**
 * Vertical alignment options
 */
export type AlignVertical = 'top' | 'middle' | 'bottom' | 'stretch';

/**
 * Resize configuration
 */
export interface ResizeConfig {
  width?: GrowType;
  height?: GrowType;
}

/**
 * Extended layout configuration (x-layout)
 */
export interface XLayout {
  alignHorizontal?: AlignHorizontal;
  alignVertical?: AlignVertical;
  resize?: ResizeConfig;
  fixed?: boolean;
}

/**
 * CSS style properties (subset commonly used)
 */
export interface StyleProps {
  display?: string;
  flexDirection?: 'row' | 'column';
  justifyContent?: string;
  alignItems?: string;
  flex?: string;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  padding?: string | number;
  paddingTop?: string | number;
  paddingRight?: string | number;
  paddingBottom?: string | number;
  paddingLeft?: string | number;
  margin?: string | number;
  marginTop?: string | number;
  marginRight?: string | number;
  marginBottom?: string | number;
  marginLeft?: string | number;
  gap?: string | number;
  position?: 'relative' | 'absolute' | 'fixed';
  left?: string | number;
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  overflow?: string;
  boxSizing?: string;
  [key: string]: unknown;
}

/**
 * Node props containing style and other attributes
 */
export interface NodeProps {
  style?: StyleProps;
  className?: string;
  [key: string]: unknown;
}

/**
 * Node Schema - the primary data structure
 */
export interface NodeSchema {
  /** Component name identifier */
  componentName: string;
  /** Absolute positioning frame */
  frame?: Frame;
  /** Child nodes */
  children?: NodeSchema[];
  /** Component props including style */
  props?: NodeProps;
  /** Layout type (output) */
  layoutType?: LayoutType;
  /** Extended layout configuration */
  'x-layout'?: XLayout;
  /** Node ID */
  id?: string;
  /** Slot name for slot nodes */
  slot?: string;
  /** Loop configuration for repeated elements */
  loop?: unknown;
  /** Condition for conditional rendering */
  condition?: unknown;
  /** Whether the node is hidden */
  hidden?: boolean;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Split result containing groups of nodes
 */
export interface SplitResult {
  /** Whether the split was successful */
  success: boolean;
  /** Groups of nodes after split */
  groups: NodeSchema[][];
  /** Gap between groups */
  gaps: number[];
}

/**
 * Child classification result
 */
export interface ChildClassification {
  /** Normal flow elements */
  normal: NodeSchema[];
  /** Absolute positioned elements (overlapping or fixed) */
  absolute: NodeSchema[];
  /** Hidden elements */
  hidden: NodeSchema[];
  /** Slot elements */
  slot: NodeSchema[];
}

/**
 * Layout calculation context
 */
export interface LayoutContext {
  /** Parent frame for reference */
  parentFrame?: Frame;
  /** Depth level in the tree */
  depth: number;
  /** Layout direction inherited from parent */
  inheritedDirection?: LayoutType;
}

/**
 * JSX Element representation
 */
export interface JSXElement {
  type: string | ((...args: unknown[]) => unknown);
  props?: Record<string, unknown>;
  children?: JSXElement | JSXElement[] | string | number | null;
}
