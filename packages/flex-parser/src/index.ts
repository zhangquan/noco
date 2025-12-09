/**
 * Flex Parser - Convert absolute positioning to Flex layout
 * 
 * This library converts design schemas using absolute positioning (frame coordinates)
 * to CSS Flex layout structures.
 * 
 * @module flex-parser
 */

// Export types
export type {
  Frame,
  LayoutType,
  GrowType,
  AlignHorizontal,
  AlignVertical,
  ResizeConfig,
  XLayout,
  StyleProps,
  NodeProps,
  NodeSchema,
  ChildClassification,
  LayoutContext,
  JSXElement,
} from './types.js';

// Export main API functions
export {
  layoutParser,
  docLayoutParser,
  processChildren,
  analyzeLayout,
} from './layout/calculateLayout.js';

// Export split functions
export {
  splitToRow,
  splitToColumn,
  smartSplitToColumn,
  analyzeSplit,
  calculateAverageGap,
  areGapsEqual,
  getSplitRowAlignValue,
  getSplitColumnAlignValue,
} from './layout/split.js';

// Export split types
export type {
  SplitResult,
  SimpleSplitResult,
  SplitGroup,
  MarginInfo,
} from './layout/split.js';

// Export check layout functions
export {
  classifyChildren,
  determineLayoutType,
  detectAlignment,
  needsAbsolutePositioning,
  calculateOptimalGap,
  detectGridPattern,
} from './layout/checkLayout.js';

// Export style functions
export {
  generateFlexStyle,
  generateChildStyle,
  generateMarginStyle,
  normalizeStyle,
  styleToCSS,
  mergeStyles,
} from './layout/style.js';

// Export utility functions
export {
  // utils
  isNil,
  isNumber,
  isNonEmptyArray,
  clamp,
  roundTo,
  deepClone,
  deepMerge,
  pick,
  omit,
  generateId,
  sortBy,
  groupBy,
  rangesOverlap,
  getOverlap,
  approximatelyEqual,
} from './utils/utils.js';

export {
  // frame utilities
  normalizeFrame,
  isValidFrame,
  getNodeFrame,
  framesOverlap,
  framesOverlapHorizontally,
  framesOverlapVertically,
  getHorizontalOverlap,
  getVerticalOverlap,
  getHorizontalGap,
  getVerticalGap,
  getBoundingFrame,
  getRelativeFrame,
  frameContains,
  areHorizontallyAligned,
  areVerticallyAligned,
  calculatePadding,
  sortFramesByPosition,
  canArrangeInRow,
  canArrangeInColumn,
} from './utils/frameUtil.js';

export {
  // tree utilities
  traverseTree,
  traverseTreePostOrder,
  mapTree,
  filterTree,
  findNode,
  findAllNodes,
  findNodeById,
  findNodeByComponentName,
  getLeafNodes,
  getTreeDepth,
  countNodes,
  flattenTree,
  getNodePath,
  cloneTree,
  replaceNode,
  insertChild,
  removeChild,
  isContainer,
  isSlotNode,
  isHiddenNode,
  hasLoop,
  hasCondition,
} from './utils/NSTreeUtil.js';

export {
  // JSX to Schema utilities
  jsx2Schema,
  schemaToPlainObject,
  createSchema,
  createContainer,
} from './utils/jsx2Schema.js';
