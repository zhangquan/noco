/**
 * Smart layout checking and helper algorithms
 * Determines the best layout strategy for a set of elements
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

/**
 * Classify children into different categories
 */
export function classifyChildren(
  parentFrame: Frame,
  children: NodeSchema[]
): ChildClassification {
  const normal: NodeSchema[] = [];
  const absolute: NodeSchema[] = [];
  const hidden: NodeSchema[] = [];
  const slot: NodeSchema[] = [];

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

    // Check for overlapping elements
    const childFrame = getNodeFrame(child);
    if (childFrame) {
      let hasOverlap = false;
      for (const other of children) {
        if (other === child || isHiddenNode(other)) continue;
        const otherFrame = getNodeFrame(other);
        if (otherFrame && framesOverlap(childFrame, otherFrame, -5)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) {
        // Check if it's really overlapping (not just adjacent)
        let significantOverlap = false;
        for (const other of children) {
          if (other === child || isHiddenNode(other)) continue;
          const otherFrame = getNodeFrame(other);
          if (otherFrame && framesOverlap(childFrame, otherFrame, -10)) {
            significantOverlap = true;
            break;
          }
        }
        if (significantOverlap) {
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
      const isWide = loopFrame.width > loopFrame.height;
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

  // Try splitting into rows and columns
  const rowSplit = splitToRow(children);
  const columnSplit = splitToColumn(children);

  const { direction, result } = analyzeSplit(rowSplit, columnSplit);

  if (direction === 'row') {
    return {
      layoutType: 'row',
      groups: columnSplit.groups,
      gaps: columnSplit.gaps,
    };
  }

  if (direction === 'column') {
    return {
      layoutType: 'column',
      groups: rowSplit.groups,
      gaps: rowSplit.gaps,
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

  const frames = children
    .map(c => getNodeFrame(c))
    .filter((f): f is Frame => f !== undefined);

  if (frames.length === 0) {
    return { alignHorizontal: 'left', alignVertical: 'top' };
  }

  const boundingFrame = getBoundingFrame(frames)!;
  const parent = normalizeFrame(parentFrame);

  // Calculate margins
  const leftMargin = boundingFrame.left - parent.left;
  const rightMargin = parent.right! - boundingFrame.right!;
  const topMargin = boundingFrame.top - parent.top;
  const bottomMargin = parent.bottom! - boundingFrame.bottom!;

  // Determine horizontal alignment
  let alignHorizontal: 'left' | 'center' | 'right' | 'justify' | 'space-between' = 'left';
  const horizontalTolerance = Math.max(5, parent.width * 0.05);

  if (Math.abs(leftMargin - rightMargin) <= horizontalTolerance) {
    alignHorizontal = 'center';
  } else if (leftMargin > rightMargin + horizontalTolerance) {
    alignHorizontal = 'right';
  } else if (rightMargin > leftMargin + horizontalTolerance) {
    alignHorizontal = 'left';
  }

  // Check for space-between (multiple children with equal gaps)
  if (children.length > 2) {
    const columnSplit = splitToColumn(children);
    if (columnSplit.success && columnSplit.gaps.length > 0) {
      const avgGap = columnSplit.gaps.reduce((a, b) => a + b, 0) / columnSplit.gaps.length;
      const allGapsEqual = columnSplit.gaps.every(g => Math.abs(g - avgGap) < 10);
      if (allGapsEqual && leftMargin < horizontalTolerance && rightMargin < horizontalTolerance) {
        alignHorizontal = 'space-between';
      }
    }
  }

  // Determine vertical alignment
  let alignVertical: 'top' | 'middle' | 'bottom' | 'stretch' = 'top';
  const verticalTolerance = Math.max(5, parent.height * 0.05);

  // Check for stretch (all children have same height as parent)
  const allStretch = frames.every(f => 
    Math.abs(f.height - parent.height) <= verticalTolerance
  );
  if (allStretch) {
    alignVertical = 'stretch';
  } else if (Math.abs(topMargin - bottomMargin) <= verticalTolerance) {
    alignVertical = 'middle';
  } else if (topMargin > bottomMargin + verticalTolerance) {
    alignVertical = 'bottom';
  } else if (bottomMargin > topMargin + verticalTolerance) {
    alignVertical = 'top';
  }

  return { alignHorizontal, alignVertical };
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
