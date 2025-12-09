/**
 * Semantic alignment recognition
 * Enhanced alignment detection with confidence scores
 */

import type { NodeSchema, Frame, AlignHorizontal, AlignVertical } from '../types.js';
import { getNodeFrame, normalizeFrame, getBoundingFrame } from '../utils/frameUtil.js';
import { calculateCV, calculateVariance } from './strategies.js';

/**
 * Extended horizontal alignment types
 */
export type ExtendedAlignHorizontal =
  | 'left'
  | 'center'
  | 'right'
  | 'justify'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

/**
 * Extended vertical alignment types
 */
export type ExtendedAlignVertical =
  | 'top'
  | 'middle'
  | 'bottom'
  | 'stretch'
  | 'baseline'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

/**
 * Alignment analysis result with confidence scores
 */
export interface AlignmentAnalysis {
  horizontal: {
    type: ExtendedAlignHorizontal;
    confidence: number; // 0-1
  };
  vertical: {
    type: ExtendedAlignVertical;
    confidence: number; // 0-1
  };
}

/**
 * Alignment score for a specific alignment type
 */
interface AlignmentScore {
  type: string;
  score: number;
  details?: Record<string, number>;
}

/**
 * Average helper
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate left alignment score
 */
function calculateLeftAlignScore(parentFrame: Frame, frames: Frame[]): number {
  if (frames.length === 0) return 0;

  const boundingFrame = getBoundingFrame(frames)!;
  const leftMargin = boundingFrame.left - parentFrame.left;
  const rightMargin = parentFrame.right! - boundingFrame.right!;

  // Elements should be close to left edge with significant right margin
  const parentWidth = parentFrame.width;
  const leftRatio = leftMargin / parentWidth;
  const rightRatio = rightMargin / parentWidth;

  // Strong left alignment: left margin < 10% and right margin > 20%
  if (leftRatio < 0.1 && rightRatio > 0.2) {
    return 0.9 + (0.1 * (1 - leftRatio / 0.1));
  }

  // Moderate left alignment: left margin < right margin significantly
  if (rightMargin > leftMargin * 2) {
    const ratio = leftMargin / (leftMargin + rightMargin + 0.001);
    return 0.5 + 0.4 * (1 - ratio);
  }

  // Weak left alignment
  if (rightMargin > leftMargin) {
    return 0.3 * (rightMargin - leftMargin) / parentWidth;
  }

  return 0;
}

/**
 * Calculate center alignment score
 */
function calculateCenterAlignScore(
  parentFrame: Frame,
  boundingFrame: Frame
): number {
  // Calculate center offset
  const parentCenter = parentFrame.left + parentFrame.width / 2;
  const contentCenter = boundingFrame.left + boundingFrame.width / 2;
  const centerOffset = Math.abs(parentCenter - contentCenter);

  // Normalize by parent width
  const normalizedOffset = centerOffset / (parentFrame.width / 2 + 0.001);

  // Strong center: offset < 5% of parent half-width
  if (normalizedOffset < 0.05) {
    return 0.95;
  }

  // Moderate center: offset < 15%
  if (normalizedOffset < 0.15) {
    return 0.7 + 0.25 * (1 - normalizedOffset / 0.15);
  }

  // Weak center
  return Math.max(0, 0.5 * (1 - normalizedOffset));
}

/**
 * Calculate right alignment score
 */
function calculateRightAlignScore(parentFrame: Frame, frames: Frame[]): number {
  if (frames.length === 0) return 0;

  const boundingFrame = getBoundingFrame(frames)!;
  const leftMargin = boundingFrame.left - parentFrame.left;
  const rightMargin = parentFrame.right! - boundingFrame.right!;

  // Elements should be close to right edge with significant left margin
  const parentWidth = parentFrame.width;
  const leftRatio = leftMargin / parentWidth;
  const rightRatio = rightMargin / parentWidth;

  // Strong right alignment: right margin < 10% and left margin > 20%
  if (rightRatio < 0.1 && leftRatio > 0.2) {
    return 0.9 + (0.1 * (1 - rightRatio / 0.1));
  }

  // Moderate right alignment: right margin < left margin significantly
  if (leftMargin > rightMargin * 2) {
    const ratio = rightMargin / (leftMargin + rightMargin + 0.001);
    return 0.5 + 0.4 * (1 - ratio);
  }

  // Weak right alignment
  if (leftMargin > rightMargin) {
    return 0.3 * (leftMargin - rightMargin) / parentWidth;
  }

  return 0;
}

/**
 * Calculate justify alignment score (stretch to fill)
 * Justify means individual elements stretch to fill, not just total coverage
 */
function calculateJustifyScore(parentFrame: Frame, frames: Frame[]): number {
  if (frames.length === 0) return 0;

  // For justify, individual elements should stretch to fill available space
  // This is different from space-between where elements have gaps

  // Check if content nearly fills parent width (>95%)
  const boundingFrame = getBoundingFrame(frames)!;
  const fillRatio = boundingFrame.width / parentFrame.width;

  if (fillRatio < 0.95) return 0; // Not justify if there's significant margin

  // For justify, there should be minimal gaps between elements
  if (frames.length > 1) {
    const sorted = [...frames].sort((a, b) => a.left - b.left);
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].left - sorted[i - 1].right!;
      if (gap > 0) totalGap += gap;
    }
    const gapRatio = totalGap / parentFrame.width;
    
    // Justify should have minimal or no gaps
    if (gapRatio > 0.1) return 0.3; // Too much gap for justify
  }

  // Check if elements fill from edge to edge
  const leftMargin = boundingFrame.left - parentFrame.left;
  const rightMargin = parentFrame.right! - boundingFrame.right!;
  const totalMargin = (leftMargin + rightMargin) / parentFrame.width;

  if (totalMargin > 0.05) return 0.5; // Significant margins

  return 0.85 + 0.15 * fillRatio;
}

/**
 * Calculate space-between alignment score
 * Elements spread with equal gaps, first/last touch edges
 */
function calculateSpaceBetweenScore(
  parentFrame: Frame,
  frames: Frame[],
  direction: 'horizontal' | 'vertical'
): number {
  if (frames.length < 2) return 0;

  // Sort frames by position
  const sorted = [...frames].sort((a, b) =>
    direction === 'horizontal' ? a.left - b.left : a.top - b.top
  );

  // Calculate edge margins
  const firstMargin =
    direction === 'horizontal'
      ? sorted[0].left - parentFrame.left
      : sorted[0].top - parentFrame.top;
  const lastMargin =
    direction === 'horizontal'
      ? parentFrame.right! - sorted[sorted.length - 1].right!
      : parentFrame.bottom! - sorted[sorted.length - 1].bottom!;

  // Calculate gaps between elements
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      direction === 'horizontal'
        ? sorted[i].left - sorted[i - 1].right!
        : sorted[i].top - sorted[i - 1].bottom!;
    gaps.push(gap);
  }

  if (gaps.length === 0) return 0;

  const parentSize = direction === 'horizontal' ? parentFrame.width : parentFrame.height;
  const maxEdgeMargin = parentSize * 0.05; // 5% of parent size

  // Space-between requires:
  // 1. First and last elements must be very close to edges
  if (firstMargin > maxEdgeMargin || lastMargin > maxEdgeMargin) {
    return 0; // Not space-between if edges aren't close
  }

  // 2. Need at least 2 elements with gaps
  if (gaps.length < 1) return 0;

  // 3. Gaps should be approximately equal (low CV)
  const gapCV = calculateCV(gaps);
  if (gapCV > 0.3) {
    return 0.3; // Gaps too uneven
  }

  // 4. Gaps should be positive
  const allPositive = gaps.every((g) => g > 0);
  if (!allPositive) return 0.2;

  // Calculate final score
  const edgeScore = 1 - (firstMargin + lastMargin) / (2 * maxEdgeMargin);
  const gapScore = 1 - gapCV;

  return 0.7 + 0.3 * Math.min(edgeScore, gapScore);
}

/**
 * Calculate space-around alignment score
 * Elements spread with equal gaps, half-gaps at edges
 */
function calculateSpaceAroundScore(
  parentFrame: Frame,
  frames: Frame[],
  direction: 'horizontal' | 'vertical'
): number {
  if (frames.length < 2) return 0;

  // Sort frames by position
  const sorted = [...frames].sort((a, b) =>
    direction === 'horizontal' ? a.left - b.left : a.top - b.top
  );

  // Calculate edge margins
  const firstMargin =
    direction === 'horizontal'
      ? sorted[0].left - parentFrame.left
      : sorted[0].top - parentFrame.top;
  const lastMargin =
    direction === 'horizontal'
      ? parentFrame.right! - sorted[sorted.length - 1].right!
      : parentFrame.bottom! - sorted[sorted.length - 1].bottom!;

  // Calculate gaps between elements
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      direction === 'horizontal'
        ? sorted[i].left - sorted[i - 1].right!
        : sorted[i].top - sorted[i - 1].bottom!;
    gaps.push(gap);
  }

  if (gaps.length === 0) return 0;

  // All gaps must be positive
  if (!gaps.every((g) => g > 0)) return 0;

  const avgGap = average(gaps);
  
  // Edge margins must both be positive
  if (firstMargin <= 0 || lastMargin <= 0) return 0;

  // Space-around: edge margins should be approximately half the inner gap
  const expectedEdgeMargin = avgGap / 2;
  const tolerance = expectedEdgeMargin * 0.3; // 30% tolerance

  const firstMarginOk = Math.abs(firstMargin - expectedEdgeMargin) <= tolerance;
  const lastMarginOk = Math.abs(lastMargin - expectedEdgeMargin) <= tolerance;

  if (!firstMarginOk || !lastMarginOk) {
    return 0; // Not space-around pattern
  }

  // Gaps should be approximately equal
  const gapCV = calculateCV(gaps);
  if (gapCV > 0.2) {
    return 0.3; // Gaps too uneven
  }

  // Edge margins should be similar
  const edgeRatio = Math.min(firstMargin, lastMargin) / Math.max(firstMargin, lastMargin);
  if (edgeRatio < 0.7) {
    return 0.4;
  }

  return 0.7 + 0.3 * (1 - gapCV);
}

/**
 * Calculate space-evenly alignment score
 * All gaps (including edges) are equal
 */
function calculateSpaceEvenlyScore(
  parentFrame: Frame,
  frames: Frame[],
  direction: 'horizontal' | 'vertical'
): number {
  if (frames.length < 2) return 0;

  // Sort frames by position
  const sorted = [...frames].sort((a, b) =>
    direction === 'horizontal' ? a.left - b.left : a.top - b.top
  );

  // Calculate all gaps including edges
  const firstMargin =
    direction === 'horizontal'
      ? sorted[0].left - parentFrame.left
      : sorted[0].top - parentFrame.top;
  const lastMargin =
    direction === 'horizontal'
      ? parentFrame.right! - sorted[sorted.length - 1].right!
      : parentFrame.bottom! - sorted[sorted.length - 1].bottom!;

  const allGaps = [firstMargin];
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      direction === 'horizontal'
        ? sorted[i].left - sorted[i - 1].right!
        : sorted[i].top - sorted[i - 1].bottom!;
    allGaps.push(gap);
  }
  allGaps.push(lastMargin);

  // All gaps must be positive
  if (!allGaps.every((g) => g > 0)) return 0;

  // Space-evenly: all gaps (including edges) should be approximately equal
  const avgGap = average(allGaps);
  const tolerance = avgGap * 0.15; // 15% tolerance

  const allGapsEqual = allGaps.every((g) => Math.abs(g - avgGap) <= tolerance);
  if (!allGapsEqual) {
    return 0; // Not space-evenly pattern
  }

  // Calculate CV for final score refinement
  const gapCV = calculateCV(allGaps);
  return 0.8 + 0.2 * (1 - gapCV);
}

/**
 * Calculate top alignment score
 */
function calculateTopAlignScore(parentFrame: Frame, frames: Frame[]): number {
  if (frames.length === 0) return 0;

  const boundingFrame = getBoundingFrame(frames)!;
  const topMargin = boundingFrame.top - parentFrame.top;
  const bottomMargin = parentFrame.bottom! - boundingFrame.bottom!;

  // If elements fill most of the height, this isn't really "top" alignment
  // It's more likely stretch
  const fillRatio = boundingFrame.height / parentFrame.height;
  if (fillRatio > 0.9) {
    return 0.3; // Low score, likely stretch
  }

  const parentHeight = parentFrame.height;
  const topRatio = topMargin / parentHeight;
  const bottomRatio = bottomMargin / parentHeight;

  // Strong top alignment: top margin < 10% and bottom margin > 20%
  if (topRatio < 0.1 && bottomRatio > 0.2) {
    return 0.9 + (0.1 * (1 - topRatio / 0.1));
  }

  // Moderate top alignment: top margin < bottom margin significantly
  if (bottomMargin > topMargin * 2) {
    const ratio = topMargin / (topMargin + bottomMargin + 0.001);
    return 0.5 + 0.4 * (1 - ratio);
  }

  // Weak top alignment
  if (bottomMargin > topMargin) {
    return 0.3 * (bottomMargin - topMargin) / parentHeight;
  }

  return 0;
}

/**
 * Calculate middle (vertical center) alignment score
 */
function calculateMiddleAlignScore(
  parentFrame: Frame,
  boundingFrame: Frame
): number {
  // If elements fill most of the height, this isn't really "middle" alignment
  const fillRatio = boundingFrame.height / parentFrame.height;
  if (fillRatio > 0.9) {
    return 0.3; // Low score, likely stretch
  }

  const parentCenter = parentFrame.top + parentFrame.height / 2;
  const contentCenter = boundingFrame.top + boundingFrame.height / 2;
  const centerOffset = Math.abs(parentCenter - contentCenter);

  const normalizedOffset = centerOffset / (parentFrame.height / 2 + 0.001);

  // Strong center: offset < 5%
  if (normalizedOffset < 0.05) {
    return 0.95;
  }

  // Moderate center: offset < 15%
  if (normalizedOffset < 0.15) {
    return 0.7 + 0.25 * (1 - normalizedOffset / 0.15);
  }

  return Math.max(0, 0.5 * (1 - normalizedOffset));
}

/**
 * Calculate bottom alignment score
 */
function calculateBottomAlignScore(parentFrame: Frame, frames: Frame[]): number {
  if (frames.length === 0) return 0;

  const boundingFrame = getBoundingFrame(frames)!;
  const topMargin = boundingFrame.top - parentFrame.top;
  const bottomMargin = parentFrame.bottom! - boundingFrame.bottom!;

  // If elements fill most of the height, this isn't really "bottom" alignment
  const fillRatio = boundingFrame.height / parentFrame.height;
  if (fillRatio > 0.9) {
    return 0.3; // Low score, likely stretch
  }

  const parentHeight = parentFrame.height;
  const topRatio = topMargin / parentHeight;
  const bottomRatio = bottomMargin / parentHeight;

  // Strong bottom alignment: bottom margin < 10% and top margin > 20%
  if (bottomRatio < 0.1 && topRatio > 0.2) {
    return 0.9 + (0.1 * (1 - bottomRatio / 0.1));
  }

  // Moderate bottom alignment: bottom margin < top margin significantly
  if (topMargin > bottomMargin * 2) {
    const ratio = bottomMargin / (topMargin + bottomMargin + 0.001);
    return 0.5 + 0.4 * (1 - ratio);
  }

  // Weak bottom alignment
  if (topMargin > bottomMargin) {
    return 0.3 * (topMargin - bottomMargin) / parentHeight;
  }

  return 0;
}

/**
 * Calculate stretch alignment score
 */
function calculateStretchScore(
  parentFrame: Frame,
  frames: Frame[],
  direction: 'horizontal' | 'vertical'
): number {
  if (frames.length === 0) return 0;

  // For stretch, elements should fill the cross axis (not the main axis)
  // direction === 'horizontal' means we're checking vertical stretch in a row layout
  // direction === 'vertical' means we're checking horizontal stretch in a column layout
  const stretchRatios = frames.map((f) => {
    if (direction === 'horizontal') {
      return f.height / parentFrame.height;
    } else {
      return f.width / parentFrame.width;
    }
  });

  // All elements must have high stretch ratio (> 90%)
  const minStretch = Math.min(...stretchRatios);
  if (minStretch < 0.9) {
    return minStretch * 0.3; // Low score for non-stretch
  }

  // Check if elements are positioned at the edges (top and bottom for vertical stretch)
  const edgeAligned = frames.every((f) => {
    const normalizedF = normalizeFrame(f);
    if (direction === 'horizontal') {
      const topGap = normalizedF.top - parentFrame.top;
      const bottomGap = parentFrame.bottom! - normalizedF.bottom!;
      const tolerance = Math.max(2, parentFrame.height * 0.05);
      return topGap <= tolerance && bottomGap <= tolerance;
    } else {
      const leftGap = normalizedF.left - parentFrame.left;
      const rightGap = parentFrame.right! - normalizedF.right!;
      const tolerance = Math.max(2, parentFrame.width * 0.05);
      return leftGap <= tolerance && rightGap <= tolerance;
    }
  });

  if (!edgeAligned) {
    return minStretch * 0.6;
  }

  // Very high score for proper stretch (should beat top/middle/bottom)
  return 0.95 + 0.05 * average(stretchRatios);
}

/**
 * Analyze horizontal alignment of children within parent
 */
export function analyzeHorizontalAlignment(
  parentFrame: Frame,
  children: NodeSchema[]
): { type: ExtendedAlignHorizontal; confidence: number } {
  if (children.length === 0) {
    return { type: 'left', confidence: 1 };
  }

  const frames = children
    .map((c) => getNodeFrame(c))
    .filter((f): f is Frame => !!f);

  if (frames.length === 0) {
    return { type: 'left', confidence: 1 };
  }

  const boundingFrame = getBoundingFrame(frames)!;
  const parent = normalizeFrame(parentFrame);

  // Calculate scores for each alignment type
  const scores: AlignmentScore[] = [
    { type: 'left', score: calculateLeftAlignScore(parent, frames) },
    { type: 'center', score: calculateCenterAlignScore(parent, boundingFrame) },
    { type: 'right', score: calculateRightAlignScore(parent, frames) },
    { type: 'justify', score: calculateJustifyScore(parent, frames) },
    {
      type: 'space-between',
      score: calculateSpaceBetweenScore(parent, frames, 'horizontal'),
    },
    {
      type: 'space-around',
      score: calculateSpaceAroundScore(parent, frames, 'horizontal'),
    },
    {
      type: 'space-evenly',
      score: calculateSpaceEvenlyScore(parent, frames, 'horizontal'),
    },
  ];

  // Sort by score
  scores.sort((a, b) => b.score - a.score);

  // Return the best match
  const best = scores[0];
  const secondBest = scores[1];

  // Confidence is higher when there's a clear winner
  const confidence = secondBest
    ? Math.min(1, best.score * (1 + best.score - secondBest.score))
    : best.score;

  return {
    type: best.type as ExtendedAlignHorizontal,
    confidence,
  };
}

/**
 * Analyze vertical alignment of children within parent
 */
export function analyzeVerticalAlignment(
  parentFrame: Frame,
  children: NodeSchema[]
): { type: ExtendedAlignVertical; confidence: number } {
  if (children.length === 0) {
    return { type: 'top', confidence: 1 };
  }

  const frames = children
    .map((c) => getNodeFrame(c))
    .filter((f): f is Frame => !!f);

  if (frames.length === 0) {
    return { type: 'top', confidence: 1 };
  }

  const boundingFrame = getBoundingFrame(frames)!;
  const parent = normalizeFrame(parentFrame);

  // Calculate scores for each alignment type
  const scores: AlignmentScore[] = [
    { type: 'top', score: calculateTopAlignScore(parent, frames) },
    { type: 'middle', score: calculateMiddleAlignScore(parent, boundingFrame) },
    { type: 'bottom', score: calculateBottomAlignScore(parent, frames) },
    {
      type: 'stretch',
      score: calculateStretchScore(parent, frames, 'horizontal'),
    },
    {
      type: 'space-between',
      score: calculateSpaceBetweenScore(parent, frames, 'vertical'),
    },
    {
      type: 'space-around',
      score: calculateSpaceAroundScore(parent, frames, 'vertical'),
    },
    {
      type: 'space-evenly',
      score: calculateSpaceEvenlyScore(parent, frames, 'vertical'),
    },
  ];

  // Sort by score
  scores.sort((a, b) => b.score - a.score);

  // Return the best match
  const best = scores[0];
  const secondBest = scores[1];

  // Confidence is higher when there's a clear winner
  const confidence = secondBest
    ? Math.min(1, best.score * (1 + best.score - secondBest.score))
    : best.score;

  return {
    type: best.type as ExtendedAlignVertical,
    confidence,
  };
}

/**
 * Full alignment analysis for a parent-children relationship
 */
export function analyzeAlignment(
  parentFrame: Frame,
  children: NodeSchema[]
): AlignmentAnalysis {
  return {
    horizontal: analyzeHorizontalAlignment(parentFrame, children),
    vertical: analyzeVerticalAlignment(parentFrame, children),
  };
}

/**
 * Convert extended alignment to standard CSS values
 */
export function alignmentToCSS(
  horizontal: ExtendedAlignHorizontal,
  vertical: ExtendedAlignVertical,
  layoutType: 'row' | 'column'
): { justifyContent: string; alignItems: string } {
  // Map alignment to CSS based on layout direction
  if (layoutType === 'row') {
    // Row: horizontal -> justify-content, vertical -> align-items
    return {
      justifyContent: horizontalToJustifyContent(horizontal),
      alignItems: verticalToAlignItems(vertical),
    };
  } else {
    // Column: vertical -> justify-content, horizontal -> align-items
    return {
      justifyContent: verticalToJustifyContent(vertical),
      alignItems: horizontalToAlignItems(horizontal),
    };
  }
}

function horizontalToJustifyContent(align: ExtendedAlignHorizontal): string {
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
    case 'space-around':
      return 'space-around';
    case 'space-evenly':
      return 'space-evenly';
    default:
      return 'flex-start';
  }
}

function horizontalToAlignItems(align: ExtendedAlignHorizontal): string {
  switch (align) {
    case 'left':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'right':
      return 'flex-end';
    case 'justify':
      return 'stretch';
    default:
      return 'flex-start';
  }
}

function verticalToAlignItems(align: ExtendedAlignVertical): string {
  switch (align) {
    case 'top':
      return 'flex-start';
    case 'middle':
      return 'center';
    case 'bottom':
      return 'flex-end';
    case 'stretch':
      return 'stretch';
    case 'baseline':
      return 'baseline';
    default:
      return 'flex-start';
  }
}

function verticalToJustifyContent(align: ExtendedAlignVertical): string {
  switch (align) {
    case 'top':
      return 'flex-start';
    case 'middle':
      return 'center';
    case 'bottom':
      return 'flex-end';
    case 'space-between':
      return 'space-between';
    case 'space-around':
      return 'space-around';
    case 'space-evenly':
      return 'space-evenly';
    default:
      return 'flex-start';
  }
}

/**
 * Convert extended alignment types to standard AlignHorizontal/AlignVertical
 * For backward compatibility with existing types
 */
export function normalizeHorizontalAlignment(
  align: ExtendedAlignHorizontal
): AlignHorizontal {
  switch (align) {
    case 'space-around':
    case 'space-evenly':
      return 'space-between'; // Fall back to closest standard type
    default:
      return align as AlignHorizontal;
  }
}

export function normalizeVerticalAlignment(
  align: ExtendedAlignVertical
): AlignVertical {
  switch (align) {
    case 'baseline':
      return 'top'; // Fall back
    case 'space-between':
    case 'space-around':
    case 'space-evenly':
      return 'top'; // Fall back for non-standard
    default:
      return align as AlignVertical;
  }
}
