/**
 * Adaptive tolerance calculation
 * Replaces hardcoded tolerance values with context-aware dynamic calculation
 */

import type { NodeSchema, Frame } from '../types.js';
import { getNodeFrame, normalizeFrame, getBoundingFrame } from '../utils/frameUtil.js';
import { calculateVariance, calculateCV } from './strategies.js';

/**
 * Tolerance calculation factors
 */
export interface ToleranceFactors {
  /** Average element size in the split direction */
  avgSize: number;
  /** Number of elements */
  elementCount: number;
  /** Layout density (0-1, how much of parent is filled) */
  layoutDensity: number;
  /** Size uniformity (0-1, how similar element sizes are) */
  sizeUniformity: number;
  /** Position regularity (0-1, how regular the spacing is) */
  positionRegularity: number;
}

/**
 * Tolerance configuration
 */
export interface ToleranceConfig {
  /** Base tolerance as percentage of average size (default: 0.15) */
  baseSizeRatio: number;
  /** Minimum absolute tolerance in pixels (default: 2) */
  minTolerance: number;
  /** Maximum tolerance as percentage of average size (default: 0.3) */
  maxSizeRatio: number;
  /** Element count decay factor (default: 0.92) */
  countDecayFactor: number;
  /** High density multiplier (default: 1.4) */
  highDensityMultiplier: number;
  /** High uniformity multiplier (default: 0.6) */
  highUniformityMultiplier: number;
}

const DEFAULT_CONFIG: ToleranceConfig = {
  baseSizeRatio: 0.15,
  minTolerance: 2,
  maxSizeRatio: 0.3,
  countDecayFactor: 0.92,
  highDensityMultiplier: 1.4,
  highUniformityMultiplier: 0.6,
};

/**
 * Analyze layout factors for tolerance calculation
 */
export function analyzeLayoutFactors(
  nodes: NodeSchema[],
  direction: 'row' | 'column',
  parentFrame?: Frame
): ToleranceFactors {
  if (!nodes || nodes.length === 0) {
    return {
      avgSize: 0,
      elementCount: 0,
      layoutDensity: 0,
      sizeUniformity: 1,
      positionRegularity: 1,
    };
  }

  const frames = nodes
    .map((n) => getNodeFrame(n))
    .filter((f): f is Frame => !!f);

  if (frames.length === 0) {
    return {
      avgSize: 0,
      elementCount: nodes.length,
      layoutDensity: 0,
      sizeUniformity: 1,
      positionRegularity: 1,
    };
  }

  // Calculate average size in the split direction
  const sizes = frames.map((f) =>
    direction === 'column' ? f.height : f.width
  );
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

  // Calculate layout density
  let layoutDensity = 0;
  if (parentFrame) {
    const contentBBox = getBoundingFrame(frames)!;
    const contentArea = contentBBox.width * contentBBox.height;
    const parentArea = parentFrame.width * parentFrame.height;
    const elementArea = frames.reduce((sum, f) => sum + f.width * f.height, 0);
    layoutDensity = parentArea > 0 ? elementArea / parentArea : 0;
  }

  // Calculate size uniformity (1 - coefficient of variation, capped at [0, 1])
  const sizeCV = calculateCV(sizes);
  const sizeUniformity = Math.max(0, Math.min(1, 1 - sizeCV));

  // Calculate position regularity
  const positionRegularity = calculatePositionRegularity(frames, direction);

  return {
    avgSize,
    elementCount: nodes.length,
    layoutDensity,
    sizeUniformity,
    positionRegularity,
  };
}

/**
 * Calculate how regular the element positions are (0-1)
 */
function calculatePositionRegularity(
  frames: Frame[],
  direction: 'row' | 'column'
): number {
  if (frames.length < 2) return 1;

  // Sort frames by position
  const sorted = [...frames].sort((a, b) =>
    direction === 'column' ? a.top - b.top : a.left - b.left
  );

  // Calculate gaps between consecutive elements
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap =
      direction === 'column'
        ? curr.top - prev.bottom!
        : curr.left - prev.right!;
    gaps.push(gap);
  }

  if (gaps.length === 0) return 1;

  // Calculate coefficient of variation of gaps
  const gapCV = calculateCV(gaps.filter((g) => g >= 0));
  
  // Higher regularity means lower variation
  return Math.max(0, Math.min(1, 1 - gapCV));
}

/**
 * Calculate adaptive tolerance based on layout factors
 */
export function calculateAdaptiveTolerance(
  nodes: NodeSchema[],
  direction: 'row' | 'column',
  parentFrame?: Frame,
  config: Partial<ToleranceConfig> = {}
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const factors = analyzeLayoutFactors(nodes, direction, parentFrame);

  if (factors.avgSize === 0) {
    return cfg.minTolerance;
  }

  // Base tolerance: percentage of average element size
  let tolerance = factors.avgSize * cfg.baseSizeRatio;

  // Adjust for element count (more elements = stricter tolerance)
  // Uses exponential decay: tolerance * 0.92^(n-2) for n > 2
  if (factors.elementCount > 2) {
    const countFactor = Math.pow(
      cfg.countDecayFactor,
      factors.elementCount - 2
    );
    tolerance *= countFactor;
  }

  // Adjust for layout density (higher density = more lenient)
  if (factors.layoutDensity > 0.6) {
    tolerance *= cfg.highDensityMultiplier;
  }

  // Adjust for size uniformity (more uniform = stricter)
  if (factors.sizeUniformity > 0.8) {
    tolerance *= cfg.highUniformityMultiplier;
  }

  // Adjust for position regularity (more regular = stricter)
  if (factors.positionRegularity > 0.8) {
    tolerance *= 0.7;
  }

  // Apply bounds
  const minTolerance = cfg.minTolerance;
  const maxTolerance = factors.avgSize * cfg.maxSizeRatio;

  return Math.max(minTolerance, Math.min(tolerance, maxTolerance));
}

/**
 * Calculate tolerance specifically for row splitting (vertical separation)
 */
export function calculateRowSplitTolerance(
  nodes: NodeSchema[],
  parentFrame?: Frame,
  config: Partial<ToleranceConfig> = {}
): number {
  // For row split, we're looking at vertical gaps
  // Elements stack vertically, so we use height-based tolerance
  return calculateAdaptiveTolerance(nodes, 'column', parentFrame, config);
}

/**
 * Calculate tolerance specifically for column splitting (horizontal separation)
 */
export function calculateColumnSplitTolerance(
  nodes: NodeSchema[],
  parentFrame?: Frame,
  config: Partial<ToleranceConfig> = {}
): number {
  // For column split, we're looking at horizontal gaps
  // Elements arrange horizontally, so we use width-based tolerance
  return calculateAdaptiveTolerance(nodes, 'row', parentFrame, config);
}

/**
 * Get tolerance that allows slight overlap (negative tolerance)
 * Used when we want to be more lenient about element separation
 */
export function getOverlapTolerance(
  nodes: NodeSchema[],
  direction: 'row' | 'column',
  parentFrame?: Frame
): number {
  const baseTolerance = calculateAdaptiveTolerance(
    nodes,
    direction,
    parentFrame
  );
  
  // Return negative value to allow overlap up to this amount
  return -baseTolerance;
}

/**
 * Determine if a gap should be considered a valid split point
 */
export function isValidSplitGap(
  gap: number,
  tolerance: number,
  strictMode: boolean = false
): boolean {
  if (strictMode) {
    // In strict mode, require positive gap
    return gap > 0;
  }
  
  // In normal mode, allow gap >= tolerance (which may be negative)
  return gap >= tolerance;
}

/**
 * Calculate overlap tolerance specifically for detecting overlapping elements
 * Used in classifyChildren to determine if elements significantly overlap
 */
export function calculateOverlapDetectionTolerance(
  frames: Frame[]
): { lightTolerance: number; significantTolerance: number } {
  if (frames.length === 0) {
    return { lightTolerance: 5, significantTolerance: 10 };
  }

  // Use average of smaller dimension
  const avgSize =
    frames.reduce((sum, f) => sum + Math.min(f.width, f.height), 0) /
    frames.length;

  // Light tolerance: ~5% of average size, min 3px
  const lightTolerance = Math.max(3, avgSize * 0.05);

  // Significant tolerance: ~10% of average size, min 8px
  const significantTolerance = Math.max(8, avgSize * 0.1);

  return { lightTolerance, significantTolerance };
}
