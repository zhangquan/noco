/**
 * Core layout calculation engine
 * Converts absolute positioning to Flex layout structure
 */

import type {
  NodeSchema,
  Frame,
  LayoutType,
  LayoutContext,
  ChildClassification,
  XLayout,
} from '../types.js';
import {
  normalizeFrame,
  getNodeFrame,
  getBoundingFrame,
  calculatePadding,
  sortFramesByPosition,
  getRelativeFrame,
} from '../utils/frameUtil.js';
import {
  mapTree,
  isHiddenNode,
  isSlotNode,
  hasLoop,
} from '../utils/NSTreeUtil.js';
import { deepClone, isNonEmptyArray } from '../utils/utils.js';
import {
  classifyChildren,
  determineLayoutType,
  detectAlignment,
  calculateOptimalGap,
} from './checkLayout.js';
import { splitToRow, splitToColumn } from './split.js';
import { generateFlexStyle, generateChildStyle } from './style.js';

/**
 * Process a single node and its children
 */
function processNode(
  node: NodeSchema,
  context: LayoutContext
): NodeSchema {
  const result = deepClone(node);
  const parentFrame = getNodeFrame(result);

  // No children to process
  if (!result.children || result.children.length === 0) {
    return result;
  }

  // Normalize all child frames
  result.children = result.children.map(child => {
    if (child.frame) {
      child.frame = normalizeFrame(child.frame);
    }
    return child;
  });

  // Classify children
  const classification = parentFrame
    ? classifyChildren(parentFrame, result.children)
    : {
        normal: result.children,
        absolute: [],
        hidden: [],
        slot: [],
      };

  const { normal, absolute, hidden, slot } = classification;

  // Handle normal flow children
  if (normal.length > 0) {
    const layoutResult = determineLayoutType(parentFrame, normal);
    result.layoutType = layoutResult.layoutType;

    if (layoutResult.layoutType !== 'mix') {
      // Process groups recursively
      const processedGroups = layoutResult.groups.map(group => {
        if (group.length === 1) {
          // Single element in group - process recursively
          return processNode(group[0], {
            ...context,
            depth: context.depth + 1,
            parentFrame,
          });
        } else {
          // Multiple elements - create a wrapper or process each
          return group.map(child =>
            processNode(child, {
              ...context,
              depth: context.depth + 1,
              parentFrame,
            })
          );
        }
      });

      // Flatten processed groups back into children
      result.children = processedGroups.flat();

      // Detect alignment
      if (parentFrame) {
        const normalFrames = normal.map(n => getNodeFrame(n)).filter((f): f is Frame => !!f);
        if (normalFrames.length > 0) {
          const alignment = detectAlignment(parentFrame, normal);
          
          result['x-layout'] = {
            ...result['x-layout'],
            alignHorizontal: alignment.alignHorizontal,
            alignVertical: alignment.alignVertical,
          };
        }
      }

      // Calculate gap
      const gap = calculateOptimalGap(layoutResult.gaps);
      if (gap > 0) {
        result.props = result.props || {};
        result.props.style = result.props.style || {};
        result.props.style.gap = gap;
      }
    } else {
      // Mix layout - keep absolute positioning for overlapping elements
      result.children = normal.map(child =>
        processNode(child, {
          ...context,
          depth: context.depth + 1,
          parentFrame,
        })
      );
    }

    // Calculate padding based on content bounds
    if (parentFrame && normal.length > 0) {
      const childFrames = normal
        .map(n => getNodeFrame(n))
        .filter((f): f is Frame => !!f);
      
      if (childFrames.length > 0) {
        const contentFrame = getBoundingFrame(childFrames);
        if (contentFrame) {
          const padding = calculatePadding(parentFrame, contentFrame);
          
          // Only set padding if significant
          if (padding.top > 0 || padding.right > 0 || padding.bottom > 0 || padding.left > 0) {
            result.props = result.props || {};
            result.props.style = result.props.style || {};
            
            // Normalize small values to 0
            const threshold = 2;
            if (padding.top > threshold) result.props.style.paddingTop = padding.top;
            if (padding.right > threshold) result.props.style.paddingRight = padding.right;
            if (padding.bottom > threshold) result.props.style.paddingBottom = padding.bottom;
            if (padding.left > threshold) result.props.style.paddingLeft = padding.left;
          }
        }
      }
    }
  }

  // Process and add absolute positioned elements
  if (absolute.length > 0) {
    const processedAbsolute = absolute.map(child => {
      const processed = processNode(child, {
        ...context,
        depth: context.depth + 1,
        parentFrame,
      });
      
      // Ensure absolute positioning style
      processed.props = processed.props || {};
      processed.props.style = processed.props.style || {};
      processed.props.style.position = 'absolute';
      
      // Set position coordinates relative to parent
      if (parentFrame) {
        const childFrame = getNodeFrame(child);
        if (childFrame) {
          const relFrame = getRelativeFrame(childFrame, parentFrame);
          processed.props.style.left = relFrame.left;
          processed.props.style.top = relFrame.top;
        }
      }
      
      return processed;
    });

    result.children = [...(result.children || []), ...processedAbsolute];
    
    // Parent needs relative positioning for absolute children
    if (result.layoutType !== 'mix') {
      result.props = result.props || {};
      result.props.style = result.props.style || {};
      result.props.style.position = 'relative';
    }
  }

  // Process and add slot elements
  if (slot.length > 0) {
    const processedSlots = slot.map(child =>
      processNode(child, {
        ...context,
        depth: context.depth + 1,
        parentFrame,
      })
    );
    result.children = [...(result.children || []), ...processedSlots];
  }

  // Hidden elements are typically kept but marked
  if (hidden.length > 0) {
    result.children = [...(result.children || []), ...hidden];
  }

  // Generate flex styles
  if (result.layoutType && result.layoutType !== 'mix') {
    const flexStyle = generateFlexStyle(result);
    result.props = result.props || {};
    result.props.style = {
      ...result.props.style,
      ...flexStyle,
    };
  }

  return result;
}

/**
 * Main layout parser function
 * Parses a node tree and converts absolute positioning to Flex layout
 * 
 * @param tree - The node schema tree to convert
 * @returns The converted schema with Flex layout styles
 */
export function layoutParser(tree: NodeSchema): NodeSchema {
  if (!tree) {
    throw new Error('Input tree is required');
  }

  // Initialize frame with right/bottom values
  const normalizedTree = deepClone(tree);
  if (normalizedTree.frame) {
    normalizedTree.frame = normalizeFrame(normalizedTree.frame);
  }

  // Process the tree recursively
  const context: LayoutContext = {
    depth: 0,
    parentFrame: normalizedTree.frame,
  };

  return processNode(normalizedTree, context);
}

/**
 * Parse a document structure (Document -> Page/Modal)
 * 
 * @param doc - Document node with pages/modals as children
 * @returns Converted document schema
 */
export function docLayoutParser(doc: NodeSchema): NodeSchema {
  if (!doc) {
    throw new Error('Input document is required');
  }

  if (doc.componentName !== 'Document') {
    throw new Error('Input must be a Document node');
  }

  const result = deepClone(doc);

  if (result.children && result.children.length > 0) {
    result.children = result.children.map(page => {
      // Each page/modal is processed independently
      return layoutParser(page);
    });
  }

  return result;
}

/**
 * Process only the children of a container without modifying the container itself
 * Useful for processing partial trees
 */
export function processChildren(
  children: NodeSchema[],
  parentFrame?: Frame
): {
  layoutType: LayoutType;
  processedChildren: NodeSchema[];
  gaps: number[];
} {
  if (!children || children.length === 0) {
    return { layoutType: 'row', processedChildren: [], gaps: [] };
  }

  // Normalize frames
  const normalizedChildren = children.map(child => {
    const result = deepClone(child);
    if (result.frame) {
      result.frame = normalizeFrame(result.frame);
    }
    return result;
  });

  // Determine layout
  const layoutResult = determineLayoutType(parentFrame, normalizedChildren);
  
  // Process each child
  const context: LayoutContext = {
    depth: 0,
    parentFrame,
  };

  const processedChildren = normalizedChildren.map(child =>
    processNode(child, context)
  );

  return {
    layoutType: layoutResult.layoutType,
    processedChildren,
    gaps: layoutResult.gaps,
  };
}

/**
 * Analyze a tree without modifying it
 * Returns layout information for debugging/preview
 */
export function analyzeLayout(tree: NodeSchema): {
  totalNodes: number;
  layoutTypes: Record<LayoutType, number>;
  maxDepth: number;
} {
  let totalNodes = 0;
  let maxDepth = 0;
  const layoutTypes: Record<LayoutType, number> = {
    row: 0,
    column: 0,
    mix: 0,
  };

  function analyze(node: NodeSchema, depth: number): void {
    totalNodes++;
    maxDepth = Math.max(maxDepth, depth);

    if (node.children && node.children.length > 0) {
      const parentFrame = getNodeFrame(node);
      const result = determineLayoutType(parentFrame, node.children);
      layoutTypes[result.layoutType]++;

      for (const child of node.children) {
        analyze(child, depth + 1);
      }
    }
  }

  analyze(tree, 0);

  return { totalNodes, layoutTypes, maxDepth };
}
