/**
 * Smart layout checking and helper algorithms
 * Determines the best layout strategy for a set of elements
 * 
 * Enhanced with P0 optimizations:
 * - Multi-strategy split system
 * - Adaptive tolerance calculation
 * - Semantic alignment recognition
 */

import type { NodeSchema, Frame, ChildClassification, LayoutType } from '../types.js';
import {
  getNodeFrame,
  getBoundingFrame,
  framesOverlap,
  normalizeFrame,
} from '../utils/frameUtil.js';
import {
  isSlotNode,
  isHiddenNode,
  hasLoop,
} from '../utils/NSTreeUtil.js';
import { splitToRow, splitToColumn, analyzeSplit } from './split.js';
import {
  MultiStrategySplitExecutor,
  type ScoredSplitResult,
} from './strategies.js';
import {
  calculateAdaptiveTolerance,
  calculateOverlapDetectionTolerance,
} from './tolerance.js';
import {
  analyzeAlignment,
  normalizeHorizontalAlignment,
  normalizeVerticalAlignment,
  type AlignmentAnalysis,
  type ExtendedAlignHorizontal,
  type ExtendedAlignVertical,
} from './alignment.js';

/**
 * Classify children into different categories
 * Enhanced with adaptive tolerance for overlap detection
 */
export function classifyChildren(
  parentFrame: Frame,
  children: NodeSchema[]
): ChildClassification {
  const normal: NodeSchema[] = [];
  const absolute: NodeSchema[] = [];
  const hidden: NodeSchema[] = [];
  const slot: NodeSchema[] = [];

  // Pre-compute frames for tolerance calculation
  const childFrames = children
    .map((c) => getNodeFrame(c))
    .filter((f): f is Frame => !!f);

  // Calculate adaptive tolerance based on element sizes
  const { lightTolerance, significantTolerance } =
    calculateOverlapDetectionTolerance(childFrames);

  for (const child of children) {
    // Check for hidden elements
    if (isHiddenNode(child)) {
      hidden.push(child);
      continue;
    }

    // Check for slot elements
    if (isSlotNode(child)) {
      slot.push(child);
      continue;
    }

    // Check for fixed positioning
    const xLayout = child['x-layout'];
    if (xLayout?.fixed) {
      absolute.push(child);
      continue;
    }

    // Check for overlapping elements with adaptive tolerance
    const childFrame = getNodeFrame(child);
    if (childFrame) {
      let hasOverlap = false;
      for (const other of children) {
        if (other === child || isHiddenNode(other)) continue;
        const otherFrame = getNodeFrame(other);
        if (otherFrame && framesOverlap(childFrame, otherFrame, -lightTolerance)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) {
        // Check if it's really overlapping (not just adjacent)
        let significantOverlapFound = false;
        for (const other of children) {
          if (other === child || isHiddenNode(other)) continue;
          const otherFrame = getNodeFrame(other);
          if (otherFrame && framesOverlap(childFrame, otherFrame, -significantTolerance)) {
            significantOverlapFound = true;
            break;
          }
        }
        if (significantOverlapFound) {
          absolute.push(child);
          continue;
        }
      }
    }

    normal.push(child);
  }

  return { normal, absolute, hidden, slot };
}

/**
 * Determine layout type based on children analysis
 * Enhanced with multi-strategy split system and adaptive tolerance
 */
export function determineLayoutType(
  parentFrame: Frame | undefined,
  children: NodeSchema[]
): {
  layoutType: LayoutType;
  groups: NodeSchema[][];
  gaps: number[];
} {
  if (!children || children.length === 0) {
    return { layoutType: 'row', groups: [], gaps: [] };
  }

  if (children.length === 1) {
    return { layoutType: 'row', groups: [children], gaps: [] };
  }

  // Check for loop layout
  const loopChild = children.find(hasLoop);
  if (loopChild) {
    const loopFrame = getNodeFrame(loopChild);
    if (loopFrame) {
      // Determine direction based on element aspect ratio
      // Wide elements typically stack vertically (column), tall elements arrange horizontally (row)
      const isWide = loopFrame.width > loopFrame.height * 1.5;
      return {
        layoutType: isWide ? 'column' : 'row',
        groups: [children],
        gaps: [],
      };
    }
  }

  // Check for slot layout
  const slotChildren = children.filter(isSlotNode);
  if (slotChildren.length === children.length) {
    return { layoutType: 'row', groups: [children], gaps: [] };
  }

  // Use multi-strategy split system for better results
  const multiStrategyExecutor = new MultiStrategySplitExecutor();

  // Calculate adaptive tolerance for each direction
  const rowTolerance = calculateAdaptiveTolerance(children, 'column', parentFrame);
  const columnTolerance = calculateAdaptiveTolerance(children, 'row', parentFrame);

  // Execute multi-strategy split for both directions
  const rowSplitResult = multiStrategyExecutor.execute(children, {
    parentFrame,
    tolerance: -rowTolerance, // Negative for overlap tolerance
    direction: 'column',
  });

  const columnSplitResult = multiStrategyExecutor.execute(children, {
    parentFrame,
    tolerance: -columnTolerance,
    direction: 'row',
  });

  // Also try legacy split for comparison
  const legacyRowSplit = splitToRow(children);
  const legacyColumnSplit = splitToColumn(children);
  const { direction: legacyDirection } = analyzeSplit(legacyRowSplit, legacyColumnSplit);

  // Decide based on multi-strategy results
  const rowSuccess = rowSplitResult.success;
  const colSuccess = columnSplitResult.success;

  if (rowSuccess && colSuccess) {
    // Both directions work, compare scores
    if (rowSplitResult.score > columnSplitResult.score + 5) {
      return {
        layoutType: 'column',
        groups: rowSplitResult.groups,
        gaps: rowSplitResult.gaps,
      };
    }
    if (columnSplitResult.score > rowSplitResult.score + 5) {
      return {
        layoutType: 'row',
        groups: columnSplitResult.groups,
        gaps: columnSplitResult.gaps,
      };
    }
    // Scores are close, use legacy decision as tiebreaker
    if (legacyDirection === 'column') {
      return {
        layoutType: 'column',
        groups: rowSplitResult.groups,
        gaps: rowSplitResult.gaps,
      };
    }
    return {
      layoutType: 'row',
      groups: columnSplitResult.groups,
      gaps: columnSplitResult.gaps,
    };
  }

  if (rowSuccess) {
    return {
      layoutType: 'column',
      groups: rowSplitResult.groups,
      gaps: rowSplitResult.gaps,
    };
  }

  if (colSuccess) {
    return {
      layoutType: 'row',
      groups: columnSplitResult.groups,
      gaps: columnSplitResult.gaps,
    };
  }

  // Neither multi-strategy split worked, fall back to legacy
  if (legacyDirection === 'column' && legacyRowSplit.success) {
    return {
      layoutType: 'column',
      groups: legacyRowSplit.groups,
      gaps: legacyRowSplit.gaps,
    };
  }

  if (legacyDirection === 'row' && legacyColumnSplit.success) {
    return {
      layoutType: 'row',
      groups: legacyColumnSplit.groups,
      gaps: legacyColumnSplit.gaps,
    };
  }

  // Mix layout - can't cleanly split
  return {
    layoutType: 'mix',
    groups: [children],
    gaps: [],
  };
}

/**
 * Detect alignment of children within parent
 * Enhanced with semantic alignment recognition (space-between, space-around, space-evenly)
 */
export function detectAlignment(
  parentFrame: Frame,
  children: NodeSchema[]
): {
  alignHorizontal: 'left' | 'center' | 'right' | 'justify' | 'space-between';
  alignVertical: 'top' | 'middle' | 'bottom' | 'stretch';
} {
  if (children.length === 0) {
    return { alignHorizontal: 'left', alignVertical: 'top' };
  }

  // Use enhanced semantic alignment analysis
  const analysis = analyzeAlignment(parentFrame, children);

  // Normalize extended types to standard types for backward compatibility
  const alignHorizontal = normalizeHorizontalAlignment(analysis.horizontal.type);
  const alignVertical = normalizeVerticalAlignment(analysis.vertical.type);

  return { alignHorizontal, alignVertical };
}

/**
 * Enhanced alignment detection with extended types and confidence scores
 * Returns detailed alignment analysis including space-around and space-evenly
 */
export function detectAlignmentEnhanced(
  parentFrame: Frame,
  children: NodeSchema[]
): AlignmentAnalysis {
  return analyzeAlignment(parentFrame, children);
}

/**
 * Get extended alignment types (includes space-around, space-evenly)
 */
export function detectAlignmentExtended(
  parentFrame: Frame,
  children: NodeSchema[]
): {
  alignHorizontal: ExtendedAlignHorizontal;
  alignVertical: ExtendedAlignVertical;
  horizontalConfidence: number;
  verticalConfidence: number;
} {
  const analysis = analyzeAlignment(parentFrame, children);
  return {
    alignHorizontal: analysis.horizontal.type,
    alignVertical: analysis.vertical.type,
    horizontalConfidence: analysis.horizontal.confidence,
    verticalConfidence: analysis.vertical.confidence,
  };
}

/**
 * Check if children need absolute positioning
 */
export function needsAbsolutePositioning(children: NodeSchema[]): boolean {
  if (children.length <= 1) return false;

  const frames = children
    .map(c => getNodeFrame(c))
    .filter((f): f is Frame => f !== undefined);

  // Check for significant overlaps
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      if (framesOverlap(frames[i], frames[j], -10)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate the optimal gap value for flex gap
 */
export function calculateOptimalGap(gaps: number[]): number {
  if (gaps.length === 0) return 0;

  // Filter out negative gaps (overlaps)
  const positiveGaps = gaps.filter(g => g > 0);
  if (positiveGaps.length === 0) return 0;

  // Use the minimum positive gap as the base
  const minGap = Math.min(...positiveGaps);
  
  // Round to nearest pixel
  return Math.round(minGap);
}

/**
 * Detect if children form a grid pattern
 */
export function detectGridPattern(
  children: NodeSchema[]
): {
  isGrid: boolean;
  columns: number;
  rows: number;
} {
  if (children.length < 4) {
    return { isGrid: false, columns: 0, rows: 0 };
  }

  const frames = children
    .map(c => getNodeFrame(c))
    .filter((f): f is Frame => f !== undefined);

  if (frames.length < 4) {
    return { isGrid: false, columns: 0, rows: 0 };
  }

  // Get unique x positions (with tolerance)
  const xPositions = new Set<number>();
  const yPositions = new Set<number>();
  const tolerance = 5;

  for (const frame of frames) {
    let foundX = false;
    let foundY = false;

    for (const x of xPositions) {
      if (Math.abs(frame.left - x) <= tolerance) {
        foundX = true;
        break;
      }
    }
    if (!foundX) xPositions.add(frame.left);

    for (const y of yPositions) {
      if (Math.abs(frame.top - y) <= tolerance) {
        foundY = true;
        break;
      }
    }
    if (!foundY) yPositions.add(frame.top);
  }

  const columns = xPositions.size;
  const rows = yPositions.size;

  // It's a grid if we have multiple rows and columns
  // and the total count approximately matches rows * columns
  const isGrid = 
    columns >= 2 && 
    rows >= 2 && 
    Math.abs(frames.length - rows * columns) <= 1;

  return { isGrid, columns, rows };
}
