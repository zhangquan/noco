/**
 * Flex style generator
 * Converts layout configuration to CSS Flex properties
 */

import type {
  NodeSchema,
  StyleProps,
  LayoutType,
  AlignHorizontal,
  AlignVertical,
  GrowType,
  XLayout,
  Frame,
} from '../types.js';
import { getNodeFrame } from '../utils/frameUtil.js';

/**
 * Map horizontal alignment to justify-content (for row layout)
 */
function mapHorizontalToJustifyContent(
  align: AlignHorizontal
): string {
  switch (align) {
    case 'left':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'right':
      return 'flex-end';
    case 'justify':
    case 'space-between':
      return 'space-between';
    default:
      return 'flex-start';
  }
}

/**
 * Map horizontal alignment to align-items (for column layout)
 */
function mapHorizontalToAlignItems(
  align: AlignHorizontal
): string {
  switch (align) {
    case 'left':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'right':
      return 'flex-end';
    default:
      return 'flex-start';
  }
}

/**
 * Map vertical alignment to align-items (for row layout)
 */
function mapVerticalToAlignItems(
  align: AlignVertical
): string {
  switch (align) {
    case 'top':
      return 'flex-start';
    case 'middle':
      return 'center';
    case 'bottom':
      return 'flex-end';
    case 'stretch':
      return 'stretch';
    default:
      return 'flex-start';
  }
}

/**
 * Map vertical alignment to justify-content (for column layout)
 */
function mapVerticalToJustifyContent(
  align: AlignVertical
): string {
  switch (align) {
    case 'top':
      return 'flex-start';
    case 'middle':
      return 'center';
    case 'bottom':
      return 'flex-end';
    default:
      return 'flex-start';
  }
}

/**
 * Generate flex style for width based on grow type
 */
function generateWidthStyle(
  growType: GrowType | undefined,
  frame: Frame | undefined
): Partial<StyleProps> {
  const style: Partial<StyleProps> = {};

  switch (growType) {
    case 'fill':
      style.flex = '1 1 auto';
      style.minWidth = 0;
      break;
    case 'fit':
      // Default flex behavior - no explicit style needed
      break;
    case 'fix':
      if (frame?.width !== undefined) {
        style.width = frame.width;
        style.flexShrink = 0;
      }
      break;
    default:
      // If no grow type specified but we have a fixed width
      if (frame?.width !== undefined) {
        style.width = frame.width;
      }
  }

  return style;
}

/**
 * Generate flex style for height based on grow type
 */
function generateHeightStyle(
  growType: GrowType | undefined,
  frame: Frame | undefined
): Partial<StyleProps> {
  const style: Partial<StyleProps> = {};

  switch (growType) {
    case 'fill':
      style.flex = '1 1 auto';
      style.minHeight = 0;
      break;
    case 'fit':
      // Default flex behavior - no explicit style needed
      break;
    case 'fix':
      if (frame?.height !== undefined) {
        style.height = frame.height;
        style.flexShrink = 0;
      }
      break;
    default:
      // If no grow type specified but we have a fixed height
      if (frame?.height !== undefined) {
        style.height = frame.height;
      }
  }

  return style;
}

/**
 * Generate flex container styles from node configuration
 */
export function generateFlexStyle(node: NodeSchema): StyleProps {
  const style: StyleProps = {
    display: 'flex',
    boxSizing: 'border-box',
  };

  const layoutType = node.layoutType;
  const xLayout = node['x-layout'];
  const frame = getNodeFrame(node);

  // Set flex direction
  if (layoutType === 'row') {
    style.flexDirection = 'row';
  } else if (layoutType === 'column') {
    style.flexDirection = 'column';
  }

  // Apply alignment
  if (xLayout) {
    if (layoutType === 'row') {
      // Row layout: horizontal -> justify-content, vertical -> align-items
      if (xLayout.alignHorizontal) {
        const justifyContent = mapHorizontalToJustifyContent(xLayout.alignHorizontal);
        if (justifyContent !== 'flex-start') {
          style.justifyContent = justifyContent;
        }
      }
      if (xLayout.alignVertical) {
        const alignItems = mapVerticalToAlignItems(xLayout.alignVertical);
        if (alignItems !== 'flex-start') {
          style.alignItems = alignItems;
        }
      }
    } else if (layoutType === 'column') {
      // Column layout: horizontal -> align-items, vertical -> justify-content
      if (xLayout.alignHorizontal) {
        const alignItems = mapHorizontalToAlignItems(xLayout.alignHorizontal);
        if (alignItems !== 'flex-start') {
          style.alignItems = alignItems;
        }
      }
      if (xLayout.alignVertical) {
        const justifyContent = mapVerticalToJustifyContent(xLayout.alignVertical);
        if (justifyContent !== 'flex-start') {
          style.justifyContent = justifyContent;
        }
      }
    }
  }

  // Apply container dimensions
  if (frame) {
    const widthGrow = xLayout?.resize?.width;
    const heightGrow = xLayout?.resize?.height;

    // If no grow type specified, use fixed dimensions
    if (!widthGrow) {
      style.width = frame.width;
    } else {
      Object.assign(style, generateWidthStyle(widthGrow, frame));
    }

    if (!heightGrow) {
      style.height = frame.height;
    } else {
      Object.assign(style, generateHeightStyle(heightGrow, frame));
    }
  }

  return style;
}

/**
 * Generate styles for a child element within a flex container
 */
export function generateChildStyle(
  child: NodeSchema,
  parentLayoutType: LayoutType,
  index: number,
  siblings: NodeSchema[]
): StyleProps {
  const style: StyleProps = {};
  const xLayout = child['x-layout'];
  const frame = getNodeFrame(child);

  // Handle fixed positioning
  if (xLayout?.fixed) {
    style.position = 'fixed';
    if (frame) {
      style.left = frame.left;
      style.top = frame.top;
      style.width = frame.width;
      style.height = frame.height;
    }
    return style;
  }

  // Apply resize/grow properties
  if (xLayout?.resize) {
    const { width: widthGrow, height: heightGrow } = xLayout.resize;

    if (parentLayoutType === 'row') {
      // In row layout, width affects main axis
      if (widthGrow === 'fill') {
        style.flex = '1 1 auto';
        style.minWidth = 0;
      } else if (widthGrow === 'fix' && frame?.width) {
        style.width = frame.width;
        style.flexShrink = 0;
      }
      
      // Height affects cross axis
      if (heightGrow === 'fill') {
        style.alignSelf = 'stretch';
      } else if (heightGrow === 'fix' && frame?.height) {
        style.height = frame.height;
      }
    } else if (parentLayoutType === 'column') {
      // In column layout, height affects main axis
      if (heightGrow === 'fill') {
        style.flex = '1 1 auto';
        style.minHeight = 0;
      } else if (heightGrow === 'fix' && frame?.height) {
        style.height = frame.height;
        style.flexShrink = 0;
      }
      
      // Width affects cross axis
      if (widthGrow === 'fill') {
        style.alignSelf = 'stretch';
      } else if (widthGrow === 'fix' && frame?.width) {
        style.width = frame.width;
      }
    }
  } else {
    // No resize config - use fixed dimensions from frame
    if (frame) {
      style.width = frame.width;
      style.height = frame.height;
    }
  }

  return style;
}

/**
 * Generate margin style to maintain spacing
 * Used when gap is not uniform
 */
export function generateMarginStyle(
  node: NodeSchema,
  index: number,
  layoutType: LayoutType,
  gaps: number[]
): StyleProps {
  const style: StyleProps = {};

  if (index > 0 && index - 1 < gaps.length) {
    const gap = gaps[index - 1];
    if (gap > 0) {
      if (layoutType === 'row') {
        style.marginLeft = gap;
      } else if (layoutType === 'column') {
        style.marginTop = gap;
      }
    }
  }

  return style;
}

/**
 * Normalize a style object by removing default/unnecessary values
 */
export function normalizeStyle(style: StyleProps): StyleProps {
  const normalized: StyleProps = {};

  for (const [key, value] of Object.entries(style)) {
    // Skip undefined/null values
    if (value === undefined || value === null) continue;

    // Skip default values
    if (key === 'flexDirection' && value === 'row') continue;
    if (key === 'justifyContent' && value === 'flex-start') continue;
    if (key === 'alignItems' && value === 'stretch') continue;
    if (key === 'flexGrow' && value === 0) continue;
    if (key === 'flexShrink' && value === 1) continue;

    // Skip zero padding/margin
    if (
      (key.startsWith('padding') || key.startsWith('margin')) &&
      value === 0
    ) continue;

    normalized[key] = value;
  }

  return normalized;
}

/**
 * Convert style object to CSS string
 */
export function styleToCSS(style: StyleProps): string {
  const cssProperties: string[] = [];

  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null) continue;

    // Convert camelCase to kebab-case
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    
    // Format value
    let cssValue: string;
    if (typeof value === 'number') {
      // Add 'px' unit for numeric values (except for unitless properties)
      const unitlessProperties = ['flexGrow', 'flexShrink', 'zIndex', 'opacity'];
      cssValue = unitlessProperties.includes(key) ? String(value) : `${value}px`;
    } else {
      cssValue = String(value);
    }

    cssProperties.push(`${cssKey}: ${cssValue}`);
  }

  return cssProperties.join('; ');
}

/**
 * Merge multiple style objects
 */
export function mergeStyles(...styles: (StyleProps | undefined)[]): StyleProps {
  const result: StyleProps = {};

  for (const style of styles) {
    if (style) {
      Object.assign(result, style);
    }
  }

  return result;
}
