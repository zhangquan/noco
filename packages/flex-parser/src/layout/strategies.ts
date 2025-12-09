/**
 * Multi-strategy split system
 * Provides multiple split strategies and selects the best result
 */

import type { NodeSchema, Frame, LayoutContext } from '../types.js';
import { getNodeFrame, normalizeFrame, getBoundingFrame } from '../utils/frameUtil.js';

/**
 * Split result with scoring information
 */
export interface ScoredSplitResult {
  success: boolean;
  groups: NodeSchema[][];
  gaps: number[];
  type: 'rows' | 'column';
  score: number;
  strategyName: string;
  minMarginDis: number | null;
  minAlignDis: number;
}

/**
 * Context for split strategies
 */
export interface SplitContext {
  parentFrame?: Frame;
  tolerance: number;
  direction: 'row' | 'column';
}

/**
 * Split strategy interface
 */
export interface SplitStrategy {
  name: string;
  execute(nodes: NodeSchema[], context: SplitContext): ScoredSplitResult;
}

/**
 * Internal structure for node with pre-computed frame
 */
interface NodeWithFrame {
  node: NodeSchema;
  frame: Frame;
  index: number;
}

/**
 * Prepare nodes with normalized frames
 */
function prepareNodesWithFrames(nodes: NodeSchema[]): NodeWithFrame[] {
  const result: NodeWithFrame[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const frame = getNodeFrame(node);
    if (frame) {
      result.push({ node, frame: normalizeFrame(frame), index: i });
    } else {
      result.push({
        node,
        frame: { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 },
        index: i,
      });
    }
  }
  return result;
}

/**
 * Calculate bounding box for a set of prepared nodes
 */
function getBoundingBoxFromPrepared(nodes: NodeWithFrame[]): Frame {
  if (nodes.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }

  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  for (const { frame } of nodes) {
    if (frame.left < minLeft) minLeft = frame.left;
    if (frame.top < minTop) minTop = frame.top;
    if (frame.right! > maxRight) maxRight = frame.right!;
    if (frame.bottom! > maxBottom) maxBottom = frame.bottom!;
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
 * Calculate variance of an array of numbers
 */
export function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
  return Math.sqrt(calculateVariance(values));
}

/**
 * Calculate coefficient of variation (CV)
 */
export function calculateCV(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg === 0) return 0;
  return calculateStdDev(values) / Math.abs(avg);
}

/**
 * Calculate split score based on multiple factors
 */
export function calculateSplitScore(
  groups: NodeSchema[][],
  gaps: number[],
  minMargin: number | null,
  alignScore: number
): number {
  if (groups.length <= 1) return 0;

  let score = 0;

  // Factor 1: Group balance (50 points max)
  // Prefer even distribution of elements across groups
  const sizes = groups.map((g) => g.length);
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const sizeVariance = calculateVariance(sizes);
  const balanceScore = 50 / (1 + sizeVariance / avgSize);
  score += balanceScore;

  // Factor 2: Gap consistency (30 points max)
  // Prefer uniform gaps between groups
  if (gaps.length > 0) {
    const positiveGaps = gaps.filter((g) => g > 0);
    if (positiveGaps.length > 0) {
      const gapCV = calculateCV(positiveGaps);
      const gapScore = 30 * (1 - Math.min(gapCV, 1));
      score += gapScore;
    }
  }

  // Factor 3: Minimum margin (10 points max)
  // Prefer larger gaps between groups (cleaner separation)
  if (minMargin !== null && minMargin > 0) {
    const marginScore = Math.min(10, minMargin / 5);
    score += marginScore;
  }

  // Factor 4: Alignment quality (10 points max)
  // Lower alignScore means better alignment
  if (alignScore < Infinity && alignScore >= 0) {
    const alignQualityScore = 10 * Math.max(0, 1 - alignScore / 50);
    score += alignQualityScore;
  }

  return score;
}

/**
 * Strategy 1: Greedy Edge Split (original algorithm improved)
 * Sorts by edge coordinates and uses greedy accumulation
 */
export class GreedyEdgeSplitStrategy implements SplitStrategy {
  name = 'greedy-edge';

  execute(nodes: NodeSchema[], context: SplitContext): ScoredSplitResult {
    const { direction, tolerance } = context;

    if (!nodes || nodes.length <= 1) {
      return this.createEmptyResult(nodes || [], direction);
    }

    const prepared = prepareNodesWithFrames(nodes);

    // Sort by edge coordinate
    if (direction === 'column') {
      // For column layout (vertical stacking), sort by bottom
      prepared.sort((a, b) => a.frame.bottom! - b.frame.bottom!);
    } else {
      // For row layout (horizontal arrangement), sort by right
      prepared.sort((a, b) => a.frame.right! - b.frame.right!);
    }

    const groups: NodeSchema[][] = [];
    const gaps: number[] = [];
    let groupStartIdx = 0;

    // Track the current group's extent
    let currentGroupEdge =
      direction === 'column' ? prepared[0].frame.bottom! : prepared[0].frame.right!;

    for (let i = 0; i < prepared.length; i++) {
      const current = prepared[i];
      const currentEdge =
        direction === 'column' ? current.frame.bottom! : current.frame.right!;

      // Update current group's edge
      if (currentEdge > currentGroupEdge) {
        currentGroupEdge = currentEdge;
      }

      // Check if we can split after this element
      const remainingStartIdx = i + 1;
      if (remainingStartIdx < prepared.length) {
        const remainingBBox = getBoundingBoxFromPrepared(
          prepared.slice(remainingStartIdx)
        );

        // Calculate gap
        const gap =
          direction === 'column'
            ? remainingBBox.top - currentGroupEdge
            : remainingBBox.left - currentGroupEdge;

        // If gap exceeds tolerance, split here
        if (gap >= tolerance) {
          const groupNodes = prepared
            .slice(groupStartIdx, remainingStartIdx)
            .map((p) => p.node);
          groups.push(groupNodes);
          gaps.push(gap);

          groupStartIdx = remainingStartIdx;
          currentGroupEdge =
            direction === 'column'
              ? prepared[remainingStartIdx].frame.bottom!
              : prepared[remainingStartIdx].frame.right!;
        }
      }
    }

    // Add the last group
    const lastGroupNodes = prepared.slice(groupStartIdx).map((p) => p.node);
    if (lastGroupNodes.length > 0) {
      groups.push(lastGroupNodes);
    }

    const minMargin = gaps.length > 0 ? Math.min(...gaps) : null;
    const alignScore = this.calculateAlignScore(groups, direction);
    const score = calculateSplitScore(groups, gaps, minMargin, alignScore);

    return {
      success: groups.length > 1,
      groups,
      gaps,
      type: direction === 'column' ? 'rows' : 'column',
      score,
      strategyName: this.name,
      minMarginDis: minMargin,
      minAlignDis: alignScore,
    };
  }

  private calculateAlignScore(
    groups: NodeSchema[][],
    direction: 'row' | 'column'
  ): number {
    if (groups.length < 2) return Infinity;

    let totalDeviation = 0;
    let count = 0;

    for (let i = 0; i < groups.length - 1; i++) {
      const currentFrames = groups[i]
        .map((n) => getNodeFrame(n))
        .filter((f): f is Frame => !!f);
      const nextFrames = groups[i + 1]
        .map((n) => getNodeFrame(n))
        .filter((f): f is Frame => !!f);

      if (currentFrames.length === 0 || nextFrames.length === 0) continue;

      const currentBBox = getBoundingFrame(currentFrames)!;
      const nextBBox = getBoundingFrame(nextFrames)!;

      if (direction === 'column') {
        // For column split, check horizontal alignment
        totalDeviation += Math.abs(currentBBox.left - nextBBox.left);
        totalDeviation += Math.abs(currentBBox.right! - nextBBox.right!);
      } else {
        // For row split, check vertical alignment
        totalDeviation += Math.abs(currentBBox.top - nextBBox.top);
        totalDeviation += Math.abs(currentBBox.bottom! - nextBBox.bottom!);
      }
      count += 2;
    }

    return count > 0 ? totalDeviation / count : Infinity;
  }

  private createEmptyResult(
    nodes: NodeSchema[],
    direction: 'row' | 'column'
  ): ScoredSplitResult {
    return {
      success: false,
      groups: [nodes],
      gaps: [],
      type: direction === 'column' ? 'rows' : 'column',
      score: 0,
      strategyName: this.name,
      minMarginDis: null,
      minAlignDis: Infinity,
    };
  }
}

/**
 * Strategy 2: Center Line Split
 * Uses element center points instead of edges for splitting
 * Better for center-aligned designs
 */
export class CenterLineSplitStrategy implements SplitStrategy {
  name = 'center-line';

  execute(nodes: NodeSchema[], context: SplitContext): ScoredSplitResult {
    const { direction, tolerance } = context;

    if (!nodes || nodes.length <= 1) {
      return this.createEmptyResult(nodes || [], direction);
    }

    const prepared = prepareNodesWithFrames(nodes);

    // Calculate center points
    const nodesWithCenter = prepared.map((p) => ({
      ...p,
      center:
        direction === 'column'
          ? p.frame.top + p.frame.height / 2
          : p.frame.left + p.frame.width / 2,
    }));

    // Sort by center position
    nodesWithCenter.sort((a, b) => a.center - b.center);

    // Find natural split points based on gaps between centers
    const centerGaps: { index: number; gap: number }[] = [];
    for (let i = 0; i < nodesWithCenter.length - 1; i++) {
      const gap = nodesWithCenter[i + 1].center - nodesWithCenter[i].center;
      centerGaps.push({ index: i, gap });
    }

    // Sort gaps to find the largest ones
    const sortedGaps = [...centerGaps].sort((a, b) => b.gap - a.gap);

    // Try different numbers of splits
    const groups: NodeSchema[][] = [];
    const gaps: number[] = [];

    // Use gaps that are significantly larger than average
    const avgGap =
      centerGaps.reduce((sum, g) => sum + g.gap, 0) / centerGaps.length;
    const splitIndices = sortedGaps
      .filter((g) => g.gap > avgGap * 1.5 && g.gap >= Math.abs(tolerance) * 2)
      .map((g) => g.index)
      .sort((a, b) => a - b);

    if (splitIndices.length === 0) {
      return this.createEmptyResult(nodes, direction);
    }

    let lastSplit = -1;
    for (const splitIndex of splitIndices) {
      const groupNodes = nodesWithCenter
        .slice(lastSplit + 1, splitIndex + 1)
        .map((p) => p.node);
      if (groupNodes.length > 0) {
        groups.push(groupNodes);

        // Calculate actual gap based on bounding boxes
        const currentBBox = getBoundingBoxFromPrepared(
          prepared.filter((p) =>
            groupNodes.includes(p.node)
          )
        );
        const nextStartIdx = splitIndex + 1;
        if (nextStartIdx < nodesWithCenter.length) {
          const nextNodes = nodesWithCenter.slice(nextStartIdx);
          const nextBBox = getBoundingBoxFromPrepared(
            prepared.filter((p) =>
              nextNodes.some((n) => n.node === p.node)
            )
          );
          const actualGap =
            direction === 'column'
              ? nextBBox.top - currentBBox.bottom!
              : nextBBox.left - currentBBox.right!;
          gaps.push(actualGap);
        }
      }
      lastSplit = splitIndex;
    }

    // Add the last group
    const lastGroupNodes = nodesWithCenter.slice(lastSplit + 1).map((p) => p.node);
    if (lastGroupNodes.length > 0) {
      groups.push(lastGroupNodes);
    }

    if (groups.length <= 1) {
      return this.createEmptyResult(nodes, direction);
    }

    const minMargin = gaps.length > 0 ? Math.min(...gaps.filter((g) => g > 0)) : null;
    const alignScore = this.calculateAlignScore(groups, direction);
    const score = calculateSplitScore(
      groups,
      gaps,
      minMargin,
      alignScore
    );

    return {
      success: groups.length > 1,
      groups,
      gaps,
      type: direction === 'column' ? 'rows' : 'column',
      score,
      strategyName: this.name,
      minMarginDis: minMargin,
      minAlignDis: alignScore,
    };
  }

  private calculateAlignScore(
    groups: NodeSchema[][],
    direction: 'row' | 'column'
  ): number {
    // Same as GreedyEdgeSplitStrategy
    if (groups.length < 2) return Infinity;

    let totalDeviation = 0;
    let count = 0;

    for (let i = 0; i < groups.length - 1; i++) {
      const currentFrames = groups[i]
        .map((n) => getNodeFrame(n))
        .filter((f): f is Frame => !!f);
      const nextFrames = groups[i + 1]
        .map((n) => getNodeFrame(n))
        .filter((f): f is Frame => !!f);

      if (currentFrames.length === 0 || nextFrames.length === 0) continue;

      const currentBBox = getBoundingFrame(currentFrames)!;
      const nextBBox = getBoundingFrame(nextFrames)!;

      if (direction === 'column') {
        totalDeviation += Math.abs(currentBBox.left - nextBBox.left);
        totalDeviation += Math.abs(currentBBox.right! - nextBBox.right!);
      } else {
        totalDeviation += Math.abs(currentBBox.top - nextBBox.top);
        totalDeviation += Math.abs(currentBBox.bottom! - nextBBox.bottom!);
      }
      count += 2;
    }

    return count > 0 ? totalDeviation / count : Infinity;
  }

  private createEmptyResult(
    nodes: NodeSchema[],
    direction: 'row' | 'column'
  ): ScoredSplitResult {
    return {
      success: false,
      groups: [nodes],
      gaps: [],
      type: direction === 'column' ? 'rows' : 'column',
      score: 0,
      strategyName: this.name,
      minMarginDis: null,
      minAlignDis: Infinity,
    };
  }
}

/**
 * Strategy 3: Grid Aligned Split
 * Detects grid alignment patterns and splits accordingly
 * Best for regular, grid-like layouts
 */
export class GridAlignedSplitStrategy implements SplitStrategy {
  name = 'grid-aligned';

  execute(nodes: NodeSchema[], context: SplitContext): ScoredSplitResult {
    const { direction } = context;

    if (!nodes || nodes.length <= 1) {
      return this.createEmptyResult(nodes || [], direction);
    }

    const prepared = prepareNodesWithFrames(nodes);

    // Extract positions with tolerance-based grouping
    const positions = this.extractAlignedPositions(prepared, direction);

    if (positions.length < 2) {
      return this.createEmptyResult(nodes, direction);
    }

    // Group nodes by their position band
    const groups: NodeSchema[][] = [];
    const gaps: number[] = [];

    for (let i = 0; i < positions.length; i++) {
      const { start, end, nodes: groupNodes } = positions[i];
      groups.push(groupNodes.map((n) => n.node));

      if (i < positions.length - 1) {
        const nextStart = positions[i + 1].start;
        gaps.push(nextStart - end);
      }
    }

    if (groups.length <= 1) {
      return this.createEmptyResult(nodes, direction);
    }

    const minMargin = gaps.length > 0 ? Math.min(...gaps.filter((g) => g > 0)) : null;
    const alignScore = this.calculateAlignScore(groups, direction);
    // Bonus score for grid-aligned strategy when positions are regular
    const gridBonus = this.calculateGridRegularityBonus(positions);
    const baseScore = calculateSplitScore(groups, gaps, minMargin, alignScore);
    const score = baseScore + gridBonus;

    return {
      success: groups.length > 1,
      groups,
      gaps,
      type: direction === 'column' ? 'rows' : 'column',
      score,
      strategyName: this.name,
      minMarginDis: minMargin,
      minAlignDis: alignScore,
    };
  }

  private extractAlignedPositions(
    nodes: NodeWithFrame[],
    direction: 'row' | 'column'
  ): Array<{ start: number; end: number; nodes: NodeWithFrame[] }> {
    const tolerance = 5; // Alignment tolerance

    // Get position ranges for each node
    const ranges = nodes.map((n) => ({
      node: n,
      start: direction === 'column' ? n.frame.top : n.frame.left,
      end: direction === 'column' ? n.frame.bottom! : n.frame.right!,
    }));

    // Sort by start position
    ranges.sort((a, b) => a.start - b.start);

    // Group overlapping ranges
    const groups: Array<{ start: number; end: number; nodes: NodeWithFrame[] }> = [];
    let currentGroup: { start: number; end: number; nodes: NodeWithFrame[] } | null = null;

    for (const range of ranges) {
      if (!currentGroup) {
        currentGroup = {
          start: range.start,
          end: range.end,
          nodes: [range.node],
        };
      } else if (range.start <= currentGroup.end + tolerance) {
        // Overlaps with current group
        currentGroup.end = Math.max(currentGroup.end, range.end);
        currentGroup.nodes.push(range.node);
      } else {
        // New group
        groups.push(currentGroup);
        currentGroup = {
          start: range.start,
          end: range.end,
          nodes: [range.node],
        };
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private calculateGridRegularityBonus(
    positions: Array<{ start: number; end: number; nodes: NodeWithFrame[] }>
  ): number {
    if (positions.length < 2) return 0;

    // Check if positions are evenly spaced
    const starts = positions.map((p) => p.start);
    const gaps: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      gaps.push(starts[i] - starts[i - 1]);
    }

    if (gaps.length === 0) return 0;

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const cv = calculateCV(gaps);

    // Higher bonus for more regular spacing
    return 10 * (1 - Math.min(cv, 1));
  }

  private calculateAlignScore(
    groups: NodeSchema[][],
    direction: 'row' | 'column'
  ): number {
    if (groups.length < 2) return Infinity;

    let totalDeviation = 0;
    let count = 0;

    for (let i = 0; i < groups.length - 1; i++) {
      const currentFrames = groups[i]
        .map((n) => getNodeFrame(n))
        .filter((f): f is Frame => !!f);
      const nextFrames = groups[i + 1]
        .map((n) => getNodeFrame(n))
        .filter((f): f is Frame => !!f);

      if (currentFrames.length === 0 || nextFrames.length === 0) continue;

      const currentBBox = getBoundingFrame(currentFrames)!;
      const nextBBox = getBoundingFrame(nextFrames)!;

      if (direction === 'column') {
        totalDeviation += Math.abs(currentBBox.left - nextBBox.left);
        totalDeviation += Math.abs(currentBBox.right! - nextBBox.right!);
      } else {
        totalDeviation += Math.abs(currentBBox.top - nextBBox.top);
        totalDeviation += Math.abs(currentBBox.bottom! - nextBBox.bottom!);
      }
      count += 2;
    }

    return count > 0 ? totalDeviation / count : Infinity;
  }

  private createEmptyResult(
    nodes: NodeSchema[],
    direction: 'row' | 'column'
  ): ScoredSplitResult {
    return {
      success: false,
      groups: [nodes],
      gaps: [],
      type: direction === 'column' ? 'rows' : 'column',
      score: 0,
      strategyName: this.name,
      minMarginDis: null,
      minAlignDis: Infinity,
    };
  }
}

/**
 * Strategy 4: Clustering Split
 * Uses hierarchical clustering based on element positions
 * Best for irregular layouts with natural groupings
 */
export class ClusteringSplitStrategy implements SplitStrategy {
  name = 'clustering';

  execute(nodes: NodeSchema[], context: SplitContext): ScoredSplitResult {
    const { direction, tolerance } = context;

    if (!nodes || nodes.length <= 1) {
      return this.createEmptyResult(nodes || [], direction);
    }

    const prepared = prepareNodesWithFrames(nodes);

    // Calculate pairwise distances
    const distances = this.calculateDistances(prepared, direction);

    // Perform hierarchical clustering
    const clusters = this.hierarchicalClustering(
      prepared,
      distances,
      Math.abs(tolerance) * 2
    );

    if (clusters.length <= 1) {
      return this.createEmptyResult(nodes, direction);
    }

    // Sort clusters by position
    clusters.sort((a, b) => {
      const aPos = this.getClusterPosition(a, direction);
      const bPos = this.getClusterPosition(b, direction);
      return aPos - bPos;
    });

    const groups = clusters.map((cluster) => cluster.map((n) => n.node));
    const gaps = this.calculateGaps(clusters, direction);

    const minMargin = gaps.length > 0 ? Math.min(...gaps.filter((g) => g > 0)) : null;
    const alignScore = this.calculateAlignScore(groups, direction);
    const score = calculateSplitScore(groups, gaps, minMargin, alignScore);

    return {
      success: groups.length > 1,
      groups,
      gaps,
      type: direction === 'column' ? 'rows' : 'column',
      score,
      strategyName: this.name,
      minMarginDis: minMargin,
      minAlignDis: alignScore,
    };
  }

  private calculateDistances(
    nodes: NodeWithFrame[],
    direction: 'row' | 'column'
  ): number[][] {
    const n = nodes.length;
    const distances: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dist = this.calculateDistance(nodes[i], nodes[j], direction);
        distances[i][j] = dist;
        distances[j][i] = dist;
      }
    }

    return distances;
  }

  private calculateDistance(
    a: NodeWithFrame,
    b: NodeWithFrame,
    direction: 'row' | 'column'
  ): number {
    if (direction === 'column') {
      // For column layout, focus on vertical distance
      const aBottom = a.frame.bottom!;
      const bTop = b.frame.top;
      const bBottom = b.frame.bottom!;
      const aTop = a.frame.top;

      if (aBottom <= bTop) {
        return bTop - aBottom;
      } else if (bBottom <= aTop) {
        return aTop - bBottom;
      } else {
        // Overlap - return negative distance
        return -Math.min(aBottom - bTop, bBottom - aTop);
      }
    } else {
      // For row layout, focus on horizontal distance
      const aRight = a.frame.right!;
      const bLeft = b.frame.left;
      const bRight = b.frame.right!;
      const aLeft = a.frame.left;

      if (aRight <= bLeft) {
        return bLeft - aRight;
      } else if (bRight <= aLeft) {
        return aLeft - bRight;
      } else {
        // Overlap - return negative distance
        return -Math.min(aRight - bLeft, bRight - aLeft);
      }
    }
  }

  private hierarchicalClustering(
    nodes: NodeWithFrame[],
    distances: number[][],
    threshold: number
  ): NodeWithFrame[][] {
    // Initialize each node as its own cluster
    let clusters: Set<number>[] = nodes.map((_, i) => new Set([i]));

    // Merge clusters until no more can be merged
    let merged = true;
    while (merged) {
      merged = false;

      // Find the closest pair of clusters
      let minDist = Infinity;
      let mergeI = -1;
      let mergeJ = -1;

      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const dist = this.clusterDistance(
            clusters[i],
            clusters[j],
            distances
          );
          if (dist < minDist) {
            minDist = dist;
            mergeI = i;
            mergeJ = j;
          }
        }
      }

      // Merge if distance is below threshold
      if (minDist <= threshold && mergeI >= 0 && mergeJ >= 0) {
        const merged_cluster = new Set([...clusters[mergeI], ...clusters[mergeJ]]);
        clusters = clusters.filter((_, idx) => idx !== mergeI && idx !== mergeJ);
        clusters.push(merged_cluster);
        merged = true;
      }
    }

    return clusters.map((cluster) => [...cluster].map((i) => nodes[i]));
  }

  private clusterDistance(
    a: Set<number>,
    b: Set<number>,
    distances: number[][]
  ): number {
    // Use single-linkage (minimum distance)
    let minDist = Infinity;
    for (const i of a) {
      for (const j of b) {
        if (distances[i][j] < minDist) {
          minDist = distances[i][j];
        }
      }
    }
    return minDist;
  }

  private getClusterPosition(
    cluster: NodeWithFrame[],
    direction: 'row' | 'column'
  ): number {
    if (direction === 'column') {
      return Math.min(...cluster.map((n) => n.frame.top));
    } else {
      return Math.min(...cluster.map((n) => n.frame.left));
    }
  }

  private calculateGaps(
    clusters: NodeWithFrame[][],
    direction: 'row' | 'column'
  ): number[] {
    const gaps: number[] = [];

    for (let i = 0; i < clusters.length - 1; i++) {
      const currentBBox = getBoundingBoxFromPrepared(clusters[i]);
      const nextBBox = getBoundingBoxFromPrepared(clusters[i + 1]);

      const gap =
        direction === 'column'
          ? nextBBox.top - currentBBox.bottom!
          : nextBBox.left - currentBBox.right!;

      gaps.push(gap);
    }

    return gaps;
  }

  private calculateAlignScore(
    groups: NodeSchema[][],
    direction: 'row' | 'column'
  ): number {
    if (groups.length < 2) return Infinity;

    let totalDeviation = 0;
    let count = 0;

    for (let i = 0; i < groups.length - 1; i++) {
      const currentFrames = groups[i]
        .map((n) => getNodeFrame(n))
        .filter((f): f is Frame => !!f);
      const nextFrames = groups[i + 1]
        .map((n) => getNodeFrame(n))
        .filter((f): f is Frame => !!f);

      if (currentFrames.length === 0 || nextFrames.length === 0) continue;

      const currentBBox = getBoundingFrame(currentFrames)!;
      const nextBBox = getBoundingFrame(nextFrames)!;

      if (direction === 'column') {
        totalDeviation += Math.abs(currentBBox.left - nextBBox.left);
        totalDeviation += Math.abs(currentBBox.right! - nextBBox.right!);
      } else {
        totalDeviation += Math.abs(currentBBox.top - nextBBox.top);
        totalDeviation += Math.abs(currentBBox.bottom! - nextBBox.bottom!);
      }
      count += 2;
    }

    return count > 0 ? totalDeviation / count : Infinity;
  }

  private createEmptyResult(
    nodes: NodeSchema[],
    direction: 'row' | 'column'
  ): ScoredSplitResult {
    return {
      success: false,
      groups: [nodes],
      gaps: [],
      type: direction === 'column' ? 'rows' : 'column',
      score: 0,
      strategyName: this.name,
      minMarginDis: null,
      minAlignDis: Infinity,
    };
  }
}

/**
 * Multi-strategy split executor
 * Runs all strategies and returns the best result
 */
export class MultiStrategySplitExecutor {
  private strategies: SplitStrategy[];

  constructor() {
    this.strategies = [
      new GreedyEdgeSplitStrategy(),
      new CenterLineSplitStrategy(),
      new GridAlignedSplitStrategy(),
      new ClusteringSplitStrategy(),
    ];
  }

  /**
   * Execute all strategies and return the best result
   */
  execute(nodes: NodeSchema[], context: SplitContext): ScoredSplitResult {
    if (!nodes || nodes.length <= 1) {
      return {
        success: false,
        groups: [nodes || []],
        gaps: [],
        type: context.direction === 'column' ? 'rows' : 'column',
        score: 0,
        strategyName: 'none',
        minMarginDis: null,
        minAlignDis: Infinity,
      };
    }

    const results = this.strategies.map((strategy) =>
      strategy.execute(nodes, context)
    );

    // Filter successful results
    const successfulResults = results.filter((r) => r.success);

    if (successfulResults.length === 0) {
      // Return the best unsuccessful result (highest score)
      return results.sort((a, b) => b.score - a.score)[0];
    }

    // Return the result with the highest score
    return successfulResults.sort((a, b) => b.score - a.score)[0];
  }

  /**
   * Get all results for debugging/analysis
   */
  executeAll(nodes: NodeSchema[], context: SplitContext): ScoredSplitResult[] {
    return this.strategies.map((strategy) => strategy.execute(nodes, context));
  }
}
