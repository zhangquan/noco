/**
 * Row/column split core algorithm
 * Splits elements into rows or columns based on their position
 * 
 * Key principles:
 * - Elements are sorted by their edge coordinates (bottom for rows, right for columns)
 * - Uses "greedy accumulation" strategy with look-ahead to remaining elements
 * - Dynamic tolerance based on element size (allows slight overlap)
 * - Provides alignment scoring for quality assessment
 */

import type { NodeSchema, Frame } from '../types.js';
import { normalizeFrame, getNodeFrame } from '../utils/frameUtil.js';

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
 * Internal structure for node with pre-computed frame
 */
interface NodeWithFrame {
  node: NodeSchema;
  frame: Frame;
}

/**
 * Pre-compute frames for all nodes, filtering out nodes without valid frames
 */
function prepareNodes(nodes: NodeSchema[]): NodeWithFrame[] {
  const result: NodeWithFrame[] = [];
  for (const node of nodes) {
    const frame = getNodeFrame(node);
    if (frame) {
      result.push({ node, frame: normalizeFrame(frame) });
    } else {
      // Nodes without frames get a zero frame
      result.push({ 
        node, 
        frame: { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 } 
      });
    }
  }
  return result;
}

/**
 * Calculate bounding box for a range of prepared nodes
 * Optimized: calculates from pre-computed frames
 */
function getBoundingBox(nodes: NodeWithFrame[], start: number, end: number): Frame {
  if (start >= end) {
    return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }

  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  for (let i = start; i < end; i++) {
    const f = nodes[i].frame;
    if (f.left < minLeft) minLeft = f.left;
    if (f.top < minTop) minTop = f.top;
    if (f.right! > maxRight) maxRight = f.right!;
    if (f.bottom! > maxBottom) maxBottom = f.bottom!;
  }

  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
    right: maxRight,
    bottom: maxBottom,
  };
}

/**
 * Create empty split result
 */
function createEmptyResult(nodes: NodeSchema[], type: 'rows' | 'column'): SplitResult {
  return {
    success: false,
    groups: [nodes],
    gaps: [],
    type,
    els: [nodes],
    margins: [],
    minMarginDis: null,
    minAlignDis: Infinity,
    splitGroups: [{ els: nodes }],
  };
}

/**
 * Try to split elements into rows (horizontal groups stacked vertically)
 * 
 * Algorithm:
 * 1. Sort elements by bottom coordinate (ascending)
 * 2. Greedy accumulation: keep adding elements to current row
 * 3. At each step, check gap between current row's bottom and remaining elements' top
 * 4. If gap >= tolerance, finalize current row and start new one
 * 
 * Tolerance formula: -min(currentElementHeight, remainingBBoxHeight) / 5
 * Then take the smaller (more negative) of this and ROW_MARGIN_DIS
 */
export function splitToRow(nodes: NodeSchema[]): SplitResult {
  if (!nodes || nodes.length <= 1) {
    return createEmptyResult(nodes || [], 'rows');
  }

  // Pre-compute frames and sort by bottom
  const prepared = prepareNodes(nodes);
  prepared.sort((a, b) => a.frame.bottom! - b.frame.bottom!);

  const groups: NodeSchema[][] = [];
  const gaps: number[] = [];
  const margins: MarginInfo[] = [];
  const splitGroups: SplitGroup[] = [];

  let groupStartIdx = 0;
  let currentGroupBottom = prepared[0].frame.bottom!;

  for (let i = 0; i < prepared.length; i++) {
    const current = prepared[i];
    
    // Update current group's bottom extent
    if (current.frame.bottom! > currentGroupBottom) {
      currentGroupBottom = current.frame.bottom!;
    }

    // Check if we can split after this element
    const remainingStartIdx = i + 1;
    if (remainingStartIdx < prepared.length) {
      // Get bounding box of remaining elements
      const remainingBBox = getBoundingBox(prepared, remainingStartIdx, prepared.length);
      
      // Calculate gap between current group and remaining elements
      const gap = remainingBBox.top - currentGroupBottom;

      // Calculate dynamic tolerance
      // Use current element's height and remaining bbox height
      const currentHeight = current.frame.height;
      const remainingHeight = remainingBBox.height;
      const dynamicTolerance = -Math.min(currentHeight, remainingHeight) / 5;
      const tolerance = Math.min(dynamicTolerance, ROW_MARGIN_DIS);

      // If gap is sufficient, split here
      if (gap >= tolerance) {
        // Extract current group
        const groupNodes = prepared.slice(groupStartIdx, remainingStartIdx).map(p => p.node);
        groups.push(groupNodes);
        splitGroups.push({ els: groupNodes, minMargin: gap });
        gaps.push(gap);
        margins.push({
          start: currentGroupBottom,
          end: remainingBBox.top,
          distance: gap,
        });

        // Start new group
        groupStartIdx = remainingStartIdx;
        currentGroupBottom = prepared[remainingStartIdx].frame.bottom!;
      }
    }
  }

  // Add the last group
  const lastGroupNodes = prepared.slice(groupStartIdx).map(p => p.node);
  if (lastGroupNodes.length > 0) {
    groups.push(lastGroupNodes);
    splitGroups.push({ els: lastGroupNodes });
  }

  // Calculate minimum margin distance
  let minMarginDis: MarginInfo | null = null;
  if (margins.length > 0) {
    minMarginDis = margins[0];
    for (let i = 1; i < margins.length; i++) {
      if (margins[i].distance < minMarginDis.distance) {
        minMarginDis = margins[i];
      }
    }
  }

  // Calculate alignment score (deferred to avoid circular dependency)
  const minAlignDis = groups.length > 1 ? calculateRowAlignScore(groups) : Infinity;

  return {
    success: groups.length > 1,
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
 * 2. Greedy accumulation: keep adding elements to current column
 * 3. At each step, check gap between current column's right and remaining elements' left
 * 4. If gap >= tolerance, finalize current column and start new one
 * 
 * Tolerance formula: -min(currentElementWidth, remainingBBoxWidth) / 4
 * Then take the smaller (more negative) of this and COLUMN_MARGIN_DIS
 */
export function splitToColumn(nodes: NodeSchema[]): SplitResult {
  if (!nodes || nodes.length <= 1) {
    return createEmptyResult(nodes || [], 'column');
  }

  // Pre-compute frames and sort by right
  const prepared = prepareNodes(nodes);
  prepared.sort((a, b) => a.frame.right! - b.frame.right!);

  const groups: NodeSchema[][] = [];
  const gaps: number[] = [];
  const margins: MarginInfo[] = [];
  const splitGroups: SplitGroup[] = [];

  let groupStartIdx = 0;
  let currentGroupRight = prepared[0].frame.right!;

  for (let i = 0; i < prepared.length; i++) {
    const current = prepared[i];
    
    // Update current group's right extent
    if (current.frame.right! > currentGroupRight) {
      currentGroupRight = current.frame.right!;
    }

    // Check if we can split after this element
    const remainingStartIdx = i + 1;
    if (remainingStartIdx < prepared.length) {
      // Get bounding box of remaining elements
      const remainingBBox = getBoundingBox(prepared, remainingStartIdx, prepared.length);
      
      // Calculate gap between current group and remaining elements
      const gap = remainingBBox.left - currentGroupRight;

      // Calculate dynamic tolerance
      // Use current element's width and remaining bbox width
      const currentWidth = current.frame.width;
      const remainingWidth = remainingBBox.width;
      const dynamicTolerance = -Math.min(currentWidth, remainingWidth) / 4;
      const tolerance = Math.min(dynamicTolerance, COLUMN_MARGIN_DIS);

      // If gap is sufficient, split here
      if (gap >= tolerance) {
        // Extract current group
        const groupNodes = prepared.slice(groupStartIdx, remainingStartIdx).map(p => p.node);
        groups.push(groupNodes);
        splitGroups.push({ els: groupNodes, minMargin: gap });
        gaps.push(gap);
        margins.push({
          start: currentGroupRight,
          end: remainingBBox.left,
          distance: gap,
        });

        // Start new group
        groupStartIdx = remainingStartIdx;
        currentGroupRight = prepared[remainingStartIdx].frame.right!;
      }
    }
  }

  // Add the last group
  const lastGroupNodes = prepared.slice(groupStartIdx).map(p => p.node);
  if (lastGroupNodes.length > 0) {
    groups.push(lastGroupNodes);
    splitGroups.push({ els: lastGroupNodes });
  }

  // Calculate minimum margin distance
  let minMarginDis: MarginInfo | null = null;
  if (margins.length > 0) {
    minMarginDis = margins[0];
    for (let i = 1; i < margins.length; i++) {
      if (margins[i].distance < minMarginDis.distance) {
        minMarginDis = margins[i];
      }
    }
  }

  // Calculate alignment score
  const minAlignDis = groups.length > 1 ? calculateColumnAlignScore(groups) : Infinity;

  return {
    success: groups.length > 1,
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
 * Get bounding frame for a group of nodes
 */
function getGroupBoundingFrame(nodes: NodeSchema[]): Frame | null {
  if (nodes.length === 0) return null;
  
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  let hasValidFrame = false;

  for (const node of nodes) {
    const frame = getNodeFrame(node);
    if (frame) {
      hasValidFrame = true;
      if (frame.left < minLeft) minLeft = frame.left;
      if (frame.top < minTop) minTop = frame.top;
      if (frame.right! > maxRight) maxRight = frame.right!;
      if (frame.bottom! > maxBottom) maxBottom = frame.bottom!;
    }
  }

  if (!hasValidFrame) return null;

  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
    right: maxRight,
    bottom: maxBottom,
  };
}

/**
 * Calculate alignment score for row split
 * Measures how well elements align between adjacent rows
 */
function calculateRowAlignScore(rows: NodeSchema[][]): number {
  if (rows.length < 2) return Infinity;

  let minAlignDis = Infinity;

  for (let i = 0; i < rows.length - 1; i++) {
    const upperBBox = getGroupBoundingFrame(rows[i]);
    const lowerBBox = getGroupBoundingFrame(rows[i + 1]);
    if (!upperBBox || !lowerBBox) continue;

    // Split line is midpoint between rows
    const splitLine = (upperBBox.bottom! + lowerBBox.top) / 2;

    // Split each row into columns and measure alignment
    const upperCols = splitToColumn(rows[i]);
    const lowerCols = splitToColumn(rows[i + 1]);

    let totalDist = 0;
    let count = 0;

    // Upper row columns: distance from bottom to split line
    for (const col of upperCols.groups) {
      const colBBox = getGroupBoundingFrame(col);
      if (colBBox) {
        totalDist += Math.abs(colBBox.bottom! - splitLine);
        count++;
      }
    }

    // Lower row columns: distance from top to split line
    for (const col of lowerCols.groups) {
      const colBBox = getGroupBoundingFrame(col);
      if (colBBox) {
        totalDist += Math.abs(colBBox.top - splitLine);
        count++;
      }
    }

    if (count > 0) {
      const avgDist = totalDist / count;
      if (avgDist < minAlignDis) {
        minAlignDis = avgDist;
      }
    }
  }

  return minAlignDis;
}

/**
 * Calculate alignment score for column split
 * Measures how well elements align between adjacent columns
 */
function calculateColumnAlignScore(columns: NodeSchema[][]): number {
  if (columns.length < 2) return Infinity;

  let minAlignDis = Infinity;

  for (let i = 0; i < columns.length - 1; i++) {
    const leftBBox = getGroupBoundingFrame(columns[i]);
    const rightBBox = getGroupBoundingFrame(columns[i + 1]);
    if (!leftBBox || !rightBBox) continue;

    // Split line is midpoint between columns
    const splitLine = (leftBBox.right! + rightBBox.left) / 2;

    // Split each column into rows and measure alignment
    const leftRows = splitToRow(columns[i]);
    const rightRows = splitToRow(columns[i + 1]);

    let totalDist = 0;
    let count = 0;

    // Left column rows: distance from right to split line
    for (const row of leftRows.groups) {
      const rowBBox = getGroupBoundingFrame(row);
      if (rowBBox) {
        totalDist += Math.abs(rowBBox.right! - splitLine);
        count++;
      }
    }

    // Right column rows: distance from left to split line
    for (const row of rightRows.groups) {
      const rowBBox = getGroupBoundingFrame(row);
      if (rowBBox) {
        totalDist += Math.abs(rowBBox.left - splitLine);
        count++;
      }
    }

    if (count > 0) {
      const avgDist = totalDist / count;
      if (avgDist < minAlignDis) {
        minAlignDis = avgDist;
      }
    }
  }

  return minAlignDis;
}

/**
 * Public alignment score functions
 */
export function getSplitRowAlignValue(rows: NodeSchema[][]): number {
  return calculateRowAlignScore(rows);
}

export function getSplitColumnAlignValue(columns: NodeSchema[][]): number {
  return calculateColumnAlignScore(columns);
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
      const currentBBox = getGroupBoundingFrame(pendingMerge);
      const nextBBox = getGroupBoundingFrame(nextColumn);
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
    minMarginDis = margins[0];
    for (let i = 1; i < margins.length; i++) {
      if (margins[i].distance < minMarginDis.distance) {
        minMarginDis = margins[i];
      }
    }
  }

  // Calculate alignment score
  const minAlignDis = mergedGroups.length > 1 
    ? calculateColumnAlignScore(mergedGroups) 
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
 * Uses multiple factors: group count, alignment score, margin distance
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
    
    // Factor 1: Number of groups (prefer more granular split)
    const rowGroups = rowSplit.groups.length;
    const colGroups = columnSplit.groups.length;
    
    if (rowGroups > colGroups + 1) {
      return { direction: 'column', result: rowSplit };
    }
    if (colGroups > rowGroups + 1) {
      return { direction: 'row', result: columnSplit };
    }

    // Factor 2: Alignment score (lower is better)
    const rowAlign = rowSplit.minAlignDis;
    const colAlign = columnSplit.minAlignDis;
    
    if (rowAlign < colAlign - 5) {
      return { direction: 'column', result: rowSplit };
    }
    if (colAlign < rowAlign - 5) {
      return { direction: 'row', result: columnSplit };
    }

    // Factor 3: Minimum margin distance (larger gap = cleaner split)
    const rowMargin = rowSplit.minMarginDis?.distance ?? -Infinity;
    const colMargin = columnSplit.minMarginDis?.distance ?? -Infinity;
    
    if (rowMargin > colMargin + 5) {
      return { direction: 'column', result: rowSplit };
    }
    if (colMargin > rowMargin + 5) {
      return { direction: 'row', result: columnSplit };
    }

    // Default: prefer column layout (vertical stacking is more common)
    return { direction: 'column', result: rowSplit };
  }

  if (rowSuccess) {
    return { direction: 'column', result: rowSplit };
  }

  if (columnSuccess) {
    return { direction: 'row', result: columnSplit };
  }

  // Neither split works - return mix layout
  return {
    direction: 'mix',
    result: createEmptyResult([], 'rows'),
  };
}

/**
 * Calculate average gap from gaps array
 */
export function calculateAverageGap(gaps: number[]): number {
  if (gaps.length === 0) return 0;
  
  let sum = 0;
  let count = 0;
  
  for (const g of gaps) {
    if (g > 0) {
      sum += g;
      count++;
    }
  }
  
  return count > 0 ? sum / count : 0;
}

/**
 * Check if all gaps are approximately equal (for space-between detection)
 */
export function areGapsEqual(gaps: number[], tolerance: number = 5): boolean {
  if (gaps.length <= 1) return true;

  const avg = calculateAverageGap(gaps);
  if (avg === 0) return true;

  for (const gap of gaps) {
    if (Math.abs(gap - avg) > tolerance) {
      return false;
    }
  }
  
  return true;
}
