/**
 * Row/column split core algorithm
 * Splits elements into rows or columns based on their position
 * 
 * Key principles:
 * - Elements are sorted by their edge coordinates (bottom for rows, right for columns)
 * - Uses "greedy accumulation" strategy with look-ahead
 * - Dynamic tolerance based on element size (allows slight overlap)
 * - Provides alignment scoring for quality assessment
 */

import type { NodeSchema, Frame } from '../types.js';
import {
  normalizeFrame,
  getNodeFrame,
  getBoundingFrame,
} from '../utils/frameUtil.js';
import { sortBy } from '../utils/utils.js';

/**
 * Constants for base tolerance values
 */
const COLUMN_MARGIN_DIS = -1; // Base tolerance for column splitting
const ROW_MARGIN_DIS = -1;    // Base tolerance for row splitting

/**
 * Margin information for a split point
 */
export interface MarginInfo {
  /** Start position of the gap */
  start: number;
  /** End position of the gap */
  end: number;
  /** Distance (gap size, can be negative for overlap) */
  distance: number;
}

/**
 * Split group with metadata
 */
export interface SplitGroup {
  /** Elements in this group */
  els: NodeSchema[];
  /** Minimum margin distance for this group */
  minMargin?: number;
}

/**
 * Extended split result with detailed information
 */
export interface SplitResult {
  /** Whether the split was successful (more than one group) */
  success: boolean;
  /** Groups of nodes after split */
  groups: NodeSchema[][];
  /** Gap values between groups */
  gaps: number[];
  /** Split type identifier */
  type: 'rows' | 'column';
  /** Alias for groups (compatibility) */
  els: NodeSchema[][];
  /** Margin details for each split point */
  margins: MarginInfo[];
  /** The minimum margin among all split points */
  minMarginDis: MarginInfo | null;
  /** Alignment deviation score (lower is better alignment) */
  minAlignDis: number;
  /** Groups with metadata */
  splitGroups: SplitGroup[];
}

/**
 * Legacy simple result for backward compatibility
 */
export interface SimpleSplitResult {
  success: boolean;
  groups: NodeSchema[][];
  gaps: number[];
}

/**
 * Calculate bounding frame for a set of nodes
 */
function getNodesBoundingFrame(nodes: NodeSchema[]): Frame | undefined {
  const frames = nodes
    .map(n => getNodeFrame(n))
    .filter((f): f is Frame => f !== undefined);
  return getBoundingFrame(frames);
}

/**
 * Calculate dynamic tolerance for row splitting
 * Formula: -min(elementHeight, remainingBBoxHeight) / 5
 * Then take the smaller (more negative) of this and ROW_MARGIN_DIS
 */
function calculateRowTolerance(
  currentHeight: number,
  remainingBBoxHeight: number
): number {
  const baseTolerance = -Math.min(currentHeight, remainingBBoxHeight) / 5;
  return Math.min(baseTolerance, ROW_MARGIN_DIS);
}

/**
 * Calculate dynamic tolerance for column splitting
 * Formula: -min(elementWidth, remainingBBoxWidth) / 4
 * Then take the smaller (more negative) of this and COLUMN_MARGIN_DIS
 */
function calculateColumnTolerance(
  currentWidth: number,
  remainingBBoxWidth: number
): number {
  const baseTolerance = -Math.min(currentWidth, remainingBBoxWidth) / 4;
  return Math.min(baseTolerance, COLUMN_MARGIN_DIS);
}

/**
 * Try to split elements into rows (horizontal groups stacked vertically)
 * 
 * Algorithm:
 * 1. Sort elements by bottom coordinate (ascending)
 * 2. Use greedy accumulation: add elements to current row
 * 3. Check if gap to ALL remaining elements is sufficient to split
 * 4. If yes, finalize current row and start new one
 * 
 * @param nodes - Array of nodes to split
 * @returns Split result with rows and metadata
 */
export function splitToRow(nodes: NodeSchema[]): SplitResult {
  const emptyResult: SplitResult = {
    success: false,
    groups: [nodes],
    gaps: [],
    type: 'rows',
    els: [nodes],
    margins: [],
    minMarginDis: null,
    minAlignDis: Infinity,
    splitGroups: [{ els: nodes }],
  };

  if (nodes.length <= 1) {
    return emptyResult;
  }

  // Sort by bottom coordinate (ascending)
  const sortedNodes = sortBy(nodes, (node) => {
    const frame = getNodeFrame(node);
    return frame ? frame.bottom! : 0;
  });

  const groups: NodeSchema[][] = [];
  const gaps: number[] = [];
  const margins: MarginInfo[] = [];
  const splitGroups: SplitGroup[] = [];
  
  let currentGroup: NodeSchema[] = [];
  let currentGroupBottom = -Infinity;

  for (let i = 0; i < sortedNodes.length; i++) {
    const currentNode = sortedNodes[i];
    const currentFrame = getNodeFrame(currentNode);

    if (!currentFrame) {
      currentGroup.push(currentNode);
      continue;
    }

    // Add current element to the pending group
    currentGroup.push(currentNode);
    currentGroupBottom = Math.max(currentGroupBottom, currentFrame.bottom!);

    // Check if we can split after this element
    // Look ahead to all remaining elements
    if (i < sortedNodes.length - 1) {
      const remainingNodes = sortedNodes.slice(i + 1);
      const remainingBBox = getNodesBoundingFrame(remainingNodes);

      if (remainingBBox) {
        // Calculate gap between current group bottom and remaining elements' top
        const gap = remainingBBox.top - currentGroupBottom;

        // Calculate dynamic tolerance
        const currentHeight = currentFrame.height;
        const tolerance = calculateRowTolerance(currentHeight, remainingBBox.height);

        // If gap is sufficient (gap >= tolerance, remembering tolerance is negative)
        if (gap >= tolerance) {
          // Finalize current group
          groups.push([...currentGroup]);
          splitGroups.push({ els: [...currentGroup], minMargin: gap });
          gaps.push(gap);
          margins.push({
            start: currentGroupBottom,
            end: remainingBBox.top,
            distance: gap,
          });

          // Start new group
          currentGroup = [];
          currentGroupBottom = -Infinity;
        }
      }
    }
  }

  // Add the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
    splitGroups.push({ els: currentGroup });
  }

  // Calculate minimum margin distance
  let minMarginDis: MarginInfo | null = null;
  if (margins.length > 0) {
    minMarginDis = margins.reduce((min, m) => 
      m.distance < min.distance ? m : min
    , margins[0]);
  }

  // Calculate alignment score
  const minAlignDis = groups.length > 1 
    ? getSplitRowAlignValue(groups) 
    : Infinity;

  const success = groups.length > 1;

  return {
    success,
    groups,
    gaps,
    type: 'rows',
    els: groups,
    margins,
    minMarginDis,
    minAlignDis,
    splitGroups,
  };
}

/**
 * Try to split elements into columns (vertical groups arranged horizontally)
 * 
 * Algorithm:
 * 1. Sort elements by right coordinate (ascending)
 * 2. Use greedy accumulation: add elements to current column
 * 3. Check if gap to ALL remaining elements is sufficient to split
 * 4. If yes, finalize current column and start new one
 * 
 * @param nodes - Array of nodes to split
 * @returns Split result with columns and metadata
 */
export function splitToColumn(nodes: NodeSchema[]): SplitResult {
  const emptyResult: SplitResult = {
    success: false,
    groups: [nodes],
    gaps: [],
    type: 'column',
    els: [nodes],
    margins: [],
    minMarginDis: null,
    minAlignDis: Infinity,
    splitGroups: [{ els: nodes }],
  };

  if (nodes.length <= 1) {
    return emptyResult;
  }

  // Sort by right coordinate (ascending)
  const sortedNodes = sortBy(nodes, (node) => {
    const frame = getNodeFrame(node);
    return frame ? frame.right! : 0;
  });

  const groups: NodeSchema[][] = [];
  const gaps: number[] = [];
  const margins: MarginInfo[] = [];
  const splitGroups: SplitGroup[] = [];
  
  let currentGroup: NodeSchema[] = [];
  let currentGroupRight = -Infinity;

  for (let i = 0; i < sortedNodes.length; i++) {
    const currentNode = sortedNodes[i];
    const currentFrame = getNodeFrame(currentNode);

    if (!currentFrame) {
      currentGroup.push(currentNode);
      continue;
    }

    // Add current element to the pending group
    currentGroup.push(currentNode);
    currentGroupRight = Math.max(currentGroupRight, currentFrame.right!);

    // Check if we can split after this element
    // Look ahead to all remaining elements
    if (i < sortedNodes.length - 1) {
      const remainingNodes = sortedNodes.slice(i + 1);
      const remainingBBox = getNodesBoundingFrame(remainingNodes);

      if (remainingBBox) {
        // Calculate gap between current group right and remaining elements' left
        const gap = remainingBBox.left - currentGroupRight;

        // Calculate dynamic tolerance
        const currentWidth = currentFrame.width;
        const tolerance = calculateColumnTolerance(currentWidth, remainingBBox.width);

        // If gap is sufficient (gap >= tolerance, remembering tolerance is negative)
        if (gap >= tolerance) {
          // Finalize current group
          groups.push([...currentGroup]);
          splitGroups.push({ els: [...currentGroup], minMargin: gap });
          gaps.push(gap);
          margins.push({
            start: currentGroupRight,
            end: remainingBBox.left,
            distance: gap,
          });

          // Start new group
          currentGroup = [];
          currentGroupRight = -Infinity;
        }
      }
    }
  }

  // Add the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
    splitGroups.push({ els: currentGroup });
  }

  // Calculate minimum margin distance
  let minMarginDis: MarginInfo | null = null;
  if (margins.length > 0) {
    minMarginDis = margins.reduce((min, m) => 
      m.distance < min.distance ? m : min
    , margins[0]);
  }

  // Calculate alignment score
  const minAlignDis = groups.length > 1 
    ? getSplitColumnAlignValue(groups) 
    : Infinity;

  const success = groups.length > 1;

  return {
    success,
    groups,
    gaps,
    type: 'column',
    els: groups,
    margins,
    minMarginDis,
    minAlignDis,
    splitGroups,
  };
}

/**
 * Calculate alignment score for row split
 * 
 * For each pair of adjacent rows:
 * 1. Split each row into columns
 * 2. Calculate distance from each column's bottom edge to the split line (for upper row)
 * 3. Calculate distance from each column's top edge to the split line (for lower row)
 * 4. Average these distances
 * 
 * Lower score = better alignment
 */
export function getSplitRowAlignValue(rows: NodeSchema[][]): number {
  if (rows.length < 2) return Infinity;

  let minAlignDis = Infinity;

  for (let i = 0; i < rows.length - 1; i++) {
    const upperRow = rows[i];
    const lowerRow = rows[i + 1];

    // Get split line position (between upper bottom and lower top)
    const upperBBox = getNodesBoundingFrame(upperRow);
    const lowerBBox = getNodesBoundingFrame(lowerRow);

    if (!upperBBox || !lowerBBox) continue;

    const splitLine = (upperBBox.bottom! + lowerBBox.top) / 2;

    // Split each row into columns
    const upperColumns = splitToColumn(upperRow);
    const lowerColumns = splitToColumn(lowerRow);

    // Calculate distances from column edges to split line
    let totalDistance = 0;
    let count = 0;

    // Upper row: distance from each column's bottom to split line
    for (const col of upperColumns.groups) {
      const colBBox = getNodesBoundingFrame(col);
      if (colBBox) {
        totalDistance += Math.abs(colBBox.bottom! - splitLine);
        count++;
      }
    }

    // Lower row: distance from each column's top to split line
    for (const col of lowerColumns.groups) {
      const colBBox = getNodesBoundingFrame(col);
      if (colBBox) {
        totalDistance += Math.abs(colBBox.top - splitLine);
        count++;
      }
    }

    const avgDistance = count > 0 ? totalDistance / count : Infinity;
    minAlignDis = Math.min(minAlignDis, avgDistance);
  }

  return minAlignDis;
}

/**
 * Calculate alignment score for column split
 * 
 * For each pair of adjacent columns:
 * 1. Split each column into rows
 * 2. Calculate distance from each row's right edge to the split line (for left column)
 * 3. Calculate distance from each row's left edge to the split line (for right column)
 * 4. Average these distances
 * 
 * Lower score = better alignment
 */
export function getSplitColumnAlignValue(columns: NodeSchema[][]): number {
  if (columns.length < 2) return Infinity;

  let minAlignDis = Infinity;

  for (let i = 0; i < columns.length - 1; i++) {
    const leftCol = columns[i];
    const rightCol = columns[i + 1];

    // Get split line position (between left right and right left)
    const leftBBox = getNodesBoundingFrame(leftCol);
    const rightBBox = getNodesBoundingFrame(rightCol);

    if (!leftBBox || !rightBBox) continue;

    const splitLine = (leftBBox.right! + rightBBox.left) / 2;

    // Split each column into rows
    const leftRows = splitToRow(leftCol);
    const rightRows = splitToRow(rightCol);

    // Calculate distances from row edges to split line
    let totalDistance = 0;
    let count = 0;

    // Left column: distance from each row's right to split line
    for (const row of leftRows.groups) {
      const rowBBox = getNodesBoundingFrame(row);
      if (rowBBox) {
        totalDistance += Math.abs(rowBBox.right! - splitLine);
        count++;
      }
    }

    // Right column: distance from each row's left to split line
    for (const row of rightRows.groups) {
      const rowBBox = getNodesBoundingFrame(row);
      if (rowBBox) {
        totalDistance += Math.abs(rowBBox.left - splitLine);
        count++;
      }
    }

    const avgDistance = count > 0 ? totalDistance / count : Infinity;
    minAlignDis = Math.min(minAlignDis, avgDistance);
  }

  return minAlignDis;
}

/**
 * Smart column split that tries to merge adjacent columns
 * when they can form better row layouts
 * 
 * Algorithm:
 * 1. Perform initial column split
 * 2. Iterate left to right, trying to merge adjacent columns
 * 3. If merged columns can split into multiple rows without reducing row count, accept merge
 * 4. Otherwise, finalize current merge as a new column
 */
export function smartSplitToColumn(nodes: NodeSchema[]): SplitResult {
  const initialSplit = splitToColumn(nodes);

  if (!initialSplit.success || initialSplit.groups.length < 2) {
    return initialSplit;
  }

  const mergedGroups: NodeSchema[][] = [];
  const gaps: number[] = [];
  const margins: MarginInfo[] = [];
  const splitGroups: SplitGroup[] = [];

  let pendingMerge: NodeSchema[] = [...initialSplit.groups[0]];
  let lastRowCount = splitToRow(pendingMerge).groups.length;

  for (let i = 1; i < initialSplit.groups.length; i++) {
    const nextColumn = initialSplit.groups[i];
    const testMerge = [...pendingMerge, ...nextColumn];
    const testRowSplit = splitToRow(testMerge);

    if (testRowSplit.success && testRowSplit.groups.length >= lastRowCount) {
      // Merge is beneficial - accept it
      pendingMerge = testMerge;
      lastRowCount = testRowSplit.groups.length;
    } else {
      // Merge reduces row count - finalize current merge
      mergedGroups.push(pendingMerge);
      splitGroups.push({ els: pendingMerge });

      // Calculate gap to next column
      const currentBBox = getNodesBoundingFrame(pendingMerge);
      const nextBBox = getNodesBoundingFrame(nextColumn);
      if (currentBBox && nextBBox) {
        const gap = nextBBox.left - currentBBox.right!;
        gaps.push(gap);
        margins.push({
          start: currentBBox.right!,
          end: nextBBox.left,
          distance: gap,
        });
      }

      // Start new pending merge
      pendingMerge = [...nextColumn];
      lastRowCount = splitToRow(pendingMerge).groups.length;
    }
  }

  // Add the last pending merge
  if (pendingMerge.length > 0) {
    mergedGroups.push(pendingMerge);
    splitGroups.push({ els: pendingMerge });
  }

  // Calculate minimum margin distance
  let minMarginDis: MarginInfo | null = null;
  if (margins.length > 0) {
    minMarginDis = margins.reduce((min, m) => 
      m.distance < min.distance ? m : min
    , margins[0]);
  }

  // Calculate alignment score
  const minAlignDis = mergedGroups.length > 1 
    ? getSplitColumnAlignValue(mergedGroups) 
    : Infinity;

  return {
    success: mergedGroups.length > 1,
    groups: mergedGroups,
    gaps,
    type: 'column',
    els: mergedGroups,
    margins,
    minMarginDis,
    minAlignDis,
    splitGroups,
  };
}

/**
 * Analyze split results and determine the best split direction
 * Uses both margin distance and alignment score for decision
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
    // Both work, use multiple factors for decision
    
    // Factor 1: Number of groups (more granular split is often better)
    if (rowSplit.groups.length > columnSplit.groups.length + 1) {
      return { direction: 'column', result: rowSplit };
    }
    if (columnSplit.groups.length > rowSplit.groups.length + 1) {
      return { direction: 'row', result: columnSplit };
    }

    // Factor 2: Alignment score (lower is better)
    if (rowSplit.minAlignDis < columnSplit.minAlignDis - 5) {
      return { direction: 'column', result: rowSplit };
    }
    if (columnSplit.minAlignDis < rowSplit.minAlignDis - 5) {
      return { direction: 'row', result: columnSplit };
    }

    // Factor 3: Minimum margin distance (larger is cleaner separation)
    const rowMargin = rowSplit.minMarginDis?.distance ?? -Infinity;
    const colMargin = columnSplit.minMarginDis?.distance ?? -Infinity;
    if (rowMargin > colMargin + 5) {
      return { direction: 'column', result: rowSplit };
    }
    if (colMargin > rowMargin + 5) {
      return { direction: 'row', result: columnSplit };
    }

    // Default: prefer column layout (row split) as it's more common
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
    result: {
      success: false,
      groups: [],
      gaps: [],
      type: 'rows',
      els: [],
      margins: [],
      minMarginDis: null,
      minAlignDis: Infinity,
      splitGroups: [],
    },
  };
}

/**
 * Calculate average gap from gaps array
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
