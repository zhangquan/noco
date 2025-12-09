/**
 * Row/column split core algorithm
 * Splits elements into rows or columns based on their position
 */

import type { NodeSchema, Frame, SplitResult } from '../types.js';
import {
  normalizeFrame,
  getNodeFrame,
  sortFramesByPosition,
  getVerticalGap,
  getHorizontalGap,
} from '../utils/frameUtil.js';
import { sortBy } from '../utils/utils.js';

/**
 * Configuration for split algorithm
 */
export interface SplitConfig {
  /** Tolerance for gap detection (negative allows overlap) */
  tolerance: number;
  /** Minimum gap ratio relative to element size */
  minGapRatio: number;
}

/**
 * Default split configuration
 */
const DEFAULT_ROW_CONFIG: SplitConfig = {
  tolerance: -2, // Allow 2px overlap
  minGapRatio: 0.2, // 1/5 of element height
};

const DEFAULT_COLUMN_CONFIG: SplitConfig = {
  tolerance: -2, // Allow 2px overlap
  minGapRatio: 0.25, // 1/4 of element width
};

/**
 * Get the tolerance threshold for row splitting
 * Based on element heights in the group
 */
function getRowTolerance(nodes: NodeSchema[]): number {
  const heights = nodes
    .map(n => getNodeFrame(n)?.height ?? 0)
    .filter(h => h > 0);

  if (heights.length === 0) return DEFAULT_ROW_CONFIG.tolerance;

  const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
  return -(avgHeight * DEFAULT_ROW_CONFIG.minGapRatio);
}

/**
 * Get the tolerance threshold for column splitting
 * Based on element widths in the group
 */
function getColumnTolerance(nodes: NodeSchema[]): number {
  const widths = nodes
    .map(n => getNodeFrame(n)?.width ?? 0)
    .filter(w => w > 0);

  if (widths.length === 0) return DEFAULT_COLUMN_CONFIG.tolerance;

  const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
  return -(avgWidth * DEFAULT_COLUMN_CONFIG.minGapRatio);
}

/**
 * Try to split elements into rows (horizontal groups stacked vertically)
 * Elements are sorted by their bottom coordinate and grouped by vertical gaps
 */
export function splitToRow(nodes: NodeSchema[]): SplitResult {
  if (nodes.length <= 1) {
    return {
      success: false,
      groups: [nodes],
      gaps: [],
    };
  }

  // Sort by bottom coordinate (elements that end first come first)
  const sortedNodes = sortBy(nodes, (node) => {
    const frame = getNodeFrame(node);
    return frame ? frame.bottom! : 0;
  });

  const tolerance = getRowTolerance(nodes);
  const groups: NodeSchema[][] = [];
  const gaps: number[] = [];
  let currentGroup: NodeSchema[] = [sortedNodes[0]];
  let currentGroupBottom = getNodeFrame(sortedNodes[0])?.bottom ?? 0;

  for (let i = 1; i < sortedNodes.length; i++) {
    const currentNode = sortedNodes[i];
    const currentFrame = getNodeFrame(currentNode);

    if (!currentFrame) {
      currentGroup.push(currentNode);
      continue;
    }

    // Calculate gap between current group's bottom and this element's top
    const gap = currentFrame.top - currentGroupBottom;

    // If gap is large enough (positive or above tolerance threshold), start new group
    // tolerance is negative (e.g., -20 means allow 20px overlap)
    // gap > tolerance means: gap of 10 > -20 (OK, split), gap of -30 < -20 (too much overlap, don't split)
    if (gap > tolerance) {
      groups.push(currentGroup);
      gaps.push(gap);
      currentGroup = [currentNode];
      currentGroupBottom = currentFrame.bottom!;
    } else {
      // Element overlaps with current group, add to same group
      currentGroup.push(currentNode);
      currentGroupBottom = Math.max(currentGroupBottom, currentFrame.bottom!);
    }
  }

  // Add the last group
  groups.push(currentGroup);

  // Split is successful if we created more than one group
  const success = groups.length > 1;

  return {
    success,
    groups,
    gaps,
  };
}

/**
 * Try to split elements into columns (vertical groups arranged horizontally)
 * Elements are sorted by their right coordinate and grouped by horizontal gaps
 */
export function splitToColumn(nodes: NodeSchema[]): SplitResult {
  if (nodes.length <= 1) {
    return {
      success: false,
      groups: [nodes],
      gaps: [],
    };
  }

  // Sort by right coordinate (elements that end first come first)
  const sortedNodes = sortBy(nodes, (node) => {
    const frame = getNodeFrame(node);
    return frame ? frame.right! : 0;
  });

  const tolerance = getColumnTolerance(nodes);
  const groups: NodeSchema[][] = [];
  const gaps: number[] = [];
  let currentGroup: NodeSchema[] = [sortedNodes[0]];
  let currentGroupRight = getNodeFrame(sortedNodes[0])?.right ?? 0;

  for (let i = 1; i < sortedNodes.length; i++) {
    const currentNode = sortedNodes[i];
    const currentFrame = getNodeFrame(currentNode);

    if (!currentFrame) {
      currentGroup.push(currentNode);
      continue;
    }

    // Calculate gap between current group's right and this element's left
    const gap = currentFrame.left - currentGroupRight;

    // If gap is large enough (positive or above tolerance threshold), start new group
    // tolerance is negative (e.g., -20 means allow 20px overlap)
    // gap > tolerance means: gap of 10 > -20 (OK, split), gap of -30 < -20 (too much overlap, don't split)
    if (gap > tolerance) {
      groups.push(currentGroup);
      gaps.push(gap);
      currentGroup = [currentNode];
      currentGroupRight = currentFrame.right!;
    } else {
      // Element overlaps with current group, add to same group
      currentGroup.push(currentNode);
      currentGroupRight = Math.max(currentGroupRight, currentFrame.right!);
    }
  }

  // Add the last group
  groups.push(currentGroup);

  // Split is successful if we created more than one group
  const success = groups.length > 1;

  return {
    success,
    groups,
    gaps,
  };
}

/**
 * Analyze split results and determine the best split direction
 */
export function analyzeSplit(
  rowSplit: SplitResult,
  columnSplit: SplitResult
): {
  direction: 'row' | 'column' | 'mix';
  result: SplitResult;
} {
  const rowSuccess = rowSplit.success;
  const columnSuccess = columnSplit.success;

  if (rowSuccess && columnSuccess) {
    // Both work, prefer the one with more groups (more granular split)
    if (rowSplit.groups.length > columnSplit.groups.length) {
      return { direction: 'column', result: rowSplit };
    } else if (columnSplit.groups.length > rowSplit.groups.length) {
      return { direction: 'row', result: columnSplit };
    }
    // Same number of groups, prefer row (column layout) as it's more common
    return { direction: 'column', result: rowSplit };
  }

  if (rowSuccess) {
    return { direction: 'column', result: rowSplit };
  }

  if (columnSuccess) {
    return { direction: 'row', result: columnSplit };
  }

  // Neither split works, return mix layout
  return {
    direction: 'mix',
    result: { success: false, groups: [], gaps: [] },
  };
}

/**
 * Calculate average gap from a split result
 */
export function calculateAverageGap(gaps: number[]): number {
  if (gaps.length === 0) return 0;
  const positiveGaps = gaps.filter(g => g > 0);
  if (positiveGaps.length === 0) return 0;
  return positiveGaps.reduce((a, b) => a + b, 0) / positiveGaps.length;
}

/**
 * Check if all gaps are approximately equal (for space-between detection)
 */
export function areGapsEqual(gaps: number[], tolerance: number = 5): boolean {
  if (gaps.length <= 1) return true;

  const avgGap = calculateAverageGap(gaps);
  return gaps.every(gap => Math.abs(gap - avgGap) <= tolerance);
}
