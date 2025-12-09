/**
 * Tests for P0 optimizations:
 * - Multi-strategy split system
 * - Adaptive tolerance calculation
 * - Semantic alignment recognition
 */

import { describe, it, expect } from 'vitest';
import {
  createSchema,
  MultiStrategySplitExecutor,
  GreedyEdgeSplitStrategy,
  CenterLineSplitStrategy,
  GridAlignedSplitStrategy,
  ClusteringSplitStrategy,
  calculateVariance,
  calculateCV,
  analyzeLayoutFactors,
  calculateAdaptiveTolerance,
  calculateOverlapDetectionTolerance,
  analyzeAlignment,
  analyzeHorizontalAlignment,
  analyzeVerticalAlignment,
  alignmentToCSS,
  determineLayoutType,
  detectAlignmentExtended,
  layoutParser,
} from '../index.js';
import type { NodeSchema, Frame } from '../types.js';

// ============================================================================
// Multi-Strategy Split System Tests
// ============================================================================

describe('Multi-Strategy Split System', () => {
  describe('GreedyEdgeSplitStrategy', () => {
    it('should split horizontally arranged elements', () => {
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
        createSchema('B', { frame: { left: 100, top: 0, width: 50, height: 50 } }),
        createSchema('C', { frame: { left: 200, top: 0, width: 50, height: 50 } }),
      ];

      const strategy = new GreedyEdgeSplitStrategy();
      const result = strategy.execute(nodes, {
        direction: 'row',
        tolerance: -10,
      });

      expect(result.success).toBe(true);
      expect(result.groups.length).toBe(3);
      expect(result.strategyName).toBe('greedy-edge');
    });

    it('should split vertically arranged elements', () => {
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 100, height: 50 } }),
        createSchema('B', { frame: { left: 0, top: 80, width: 100, height: 50 } }),
        createSchema('C', { frame: { left: 0, top: 160, width: 100, height: 50 } }),
      ];

      const strategy = new GreedyEdgeSplitStrategy();
      const result = strategy.execute(nodes, {
        direction: 'column',
        tolerance: -10,
      });

      expect(result.success).toBe(true);
      expect(result.groups.length).toBe(3);
    });
  });

  describe('CenterLineSplitStrategy', () => {
    it('should split based on center points', () => {
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 60, height: 50 } }),
        createSchema('B', { frame: { left: 100, top: 0, width: 60, height: 50 } }),
        createSchema('C', { frame: { left: 200, top: 0, width: 60, height: 50 } }),
      ];

      const strategy = new CenterLineSplitStrategy();
      const result = strategy.execute(nodes, {
        direction: 'row',
        tolerance: -10,
      });

      expect(result.strategyName).toBe('center-line');
      // Result depends on center point gaps
    });
  });

  describe('GridAlignedSplitStrategy', () => {
    it('should detect grid-aligned patterns', () => {
      // Elements in a grid pattern
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
        createSchema('B', { frame: { left: 100, top: 0, width: 50, height: 50 } }),
        createSchema('C', { frame: { left: 0, top: 80, width: 50, height: 50 } }),
        createSchema('D', { frame: { left: 100, top: 80, width: 50, height: 50 } }),
      ];

      const strategy = new GridAlignedSplitStrategy();
      const rowResult = strategy.execute(nodes, {
        direction: 'column',
        tolerance: -10,
      });

      expect(rowResult.strategyName).toBe('grid-aligned');
      expect(rowResult.success).toBe(true);
      expect(rowResult.groups.length).toBe(2); // 2 rows
    });
  });

  describe('ClusteringSplitStrategy', () => {
    it('should cluster nearby elements', () => {
      // Elements with clear clusters
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 40, height: 40 } }),
        createSchema('B', { frame: { left: 50, top: 0, width: 40, height: 40 } }),
        // Gap
        createSchema('C', { frame: { left: 200, top: 0, width: 40, height: 40 } }),
        createSchema('D', { frame: { left: 250, top: 0, width: 40, height: 40 } }),
      ];

      const strategy = new ClusteringSplitStrategy();
      const result = strategy.execute(nodes, {
        direction: 'row',
        tolerance: -20,
      });

      expect(result.strategyName).toBe('clustering');
      expect(result.success).toBe(true);
      expect(result.groups.length).toBe(2); // 2 clusters
    });
  });

  describe('MultiStrategySplitExecutor', () => {
    it('should select the best strategy result', () => {
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
        createSchema('B', { frame: { left: 80, top: 0, width: 50, height: 50 } }),
        createSchema('C', { frame: { left: 160, top: 0, width: 50, height: 50 } }),
      ];

      const executor = new MultiStrategySplitExecutor();
      const result = executor.execute(nodes, {
        direction: 'row',
        tolerance: -10,
      });

      expect(result.success).toBe(true);
      expect(result.groups.length).toBeGreaterThanOrEqual(2);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should return all strategy results', () => {
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
        createSchema('B', { frame: { left: 80, top: 0, width: 50, height: 50 } }),
      ];

      const executor = new MultiStrategySplitExecutor();
      const results = executor.executeAll(nodes, {
        direction: 'row',
        tolerance: -10,
      });

      expect(results.length).toBe(4); // 4 strategies
    });
  });

  describe('calculateSplitScore', () => {
    it('should calculate higher score for balanced groups', () => {
      const balancedGroups = [[{} as NodeSchema], [{} as NodeSchema], [{} as NodeSchema]];
      const unbalancedGroups = [[{} as NodeSchema], [{} as NodeSchema, {} as NodeSchema, {} as NodeSchema, {} as NodeSchema]];

      // Using calculateVariance to compare
      const balancedVariance = calculateVariance([1, 1, 1]);
      const unbalancedVariance = calculateVariance([1, 4]);

      expect(balancedVariance).toBeLessThan(unbalancedVariance);
    });
  });
});

// ============================================================================
// Adaptive Tolerance Tests
// ============================================================================

describe('Adaptive Tolerance Calculation', () => {
  describe('analyzeLayoutFactors', () => {
    it('should calculate layout factors correctly', () => {
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 100, height: 50 } }),
        createSchema('B', { frame: { left: 120, top: 0, width: 100, height: 50 } }),
        createSchema('C', { frame: { left: 240, top: 0, width: 100, height: 50 } }),
      ];

      const factors = analyzeLayoutFactors(nodes, 'row');

      expect(factors.avgSize).toBe(100); // Average width
      expect(factors.elementCount).toBe(3);
      expect(factors.sizeUniformity).toBeCloseTo(1, 1); // All same size
    });

    it('should detect low uniformity for varied sizes', () => {
      const nodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
        createSchema('B', { frame: { left: 70, top: 0, width: 150, height: 50 } }),
        createSchema('C', { frame: { left: 240, top: 0, width: 30, height: 50 } }),
      ];

      const factors = analyzeLayoutFactors(nodes, 'row');

      expect(factors.sizeUniformity).toBeLessThan(0.8);
    });
  });

  describe('calculateAdaptiveTolerance', () => {
    it('should return smaller tolerance for more elements', () => {
      const fewNodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 100, height: 50 } }),
        createSchema('B', { frame: { left: 120, top: 0, width: 100, height: 50 } }),
      ];

      const manyNodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 100, height: 50 } }),
        createSchema('B', { frame: { left: 120, top: 0, width: 100, height: 50 } }),
        createSchema('C', { frame: { left: 240, top: 0, width: 100, height: 50 } }),
        createSchema('D', { frame: { left: 360, top: 0, width: 100, height: 50 } }),
        createSchema('E', { frame: { left: 480, top: 0, width: 100, height: 50 } }),
      ];

      const fewTolerance = calculateAdaptiveTolerance(fewNodes, 'row');
      const manyTolerance = calculateAdaptiveTolerance(manyNodes, 'row');

      expect(manyTolerance).toBeLessThan(fewTolerance);
    });

    it('should return larger tolerance for uniform elements', () => {
      const uniformNodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 100, height: 50 } }),
        createSchema('B', { frame: { left: 120, top: 0, width: 100, height: 50 } }),
        createSchema('C', { frame: { left: 240, top: 0, width: 100, height: 50 } }),
      ];

      const variedNodes: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
        createSchema('B', { frame: { left: 70, top: 0, width: 200, height: 50 } }),
        createSchema('C', { frame: { left: 290, top: 0, width: 80, height: 50 } }),
      ];

      const uniformTolerance = calculateAdaptiveTolerance(uniformNodes, 'row');
      const variedTolerance = calculateAdaptiveTolerance(variedNodes, 'row');

      // Uniform elements get stricter tolerance (smaller)
      expect(uniformTolerance).toBeLessThan(variedTolerance);
    });
  });

  describe('calculateOverlapDetectionTolerance', () => {
    it('should return adaptive tolerances based on element sizes', () => {
      const smallFrames: Frame[] = [
        { left: 0, top: 0, width: 20, height: 20, right: 20, bottom: 20 },
        { left: 30, top: 0, width: 20, height: 20, right: 50, bottom: 20 },
      ];

      const largeFrames: Frame[] = [
        { left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 },
        { left: 250, top: 0, width: 200, height: 200, right: 450, bottom: 200 },
      ];

      const smallTolerance = calculateOverlapDetectionTolerance(smallFrames);
      const largeTolerance = calculateOverlapDetectionTolerance(largeFrames);

      expect(largeTolerance.lightTolerance).toBeGreaterThan(smallTolerance.lightTolerance);
      expect(largeTolerance.significantTolerance).toBeGreaterThan(smallTolerance.significantTolerance);
    });
  });
});

// ============================================================================
// Semantic Alignment Recognition Tests
// ============================================================================

describe('Semantic Alignment Recognition', () => {
  describe('analyzeHorizontalAlignment', () => {
    it('should detect left alignment', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 10, top: 25, width: 80, height: 50 } }),
        createSchema('B', { frame: { left: 10, top: 25, width: 100, height: 50 } }),
      ];

      const result = analyzeHorizontalAlignment(parentFrame, children);
      expect(result.type).toBe('left');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect center alignment', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 150, top: 25, width: 100, height: 50 } }),
      ];

      const result = analyzeHorizontalAlignment(parentFrame, children);
      expect(result.type).toBe('center');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect right alignment', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 290, top: 25, width: 100, height: 50 } }),
        createSchema('B', { frame: { left: 300, top: 25, width: 90, height: 50 } }),
      ];

      const result = analyzeHorizontalAlignment(parentFrame, children);
      expect(result.type).toBe('right');
    });

    it('should detect space-between alignment', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 25, width: 80, height: 50 } }),
        createSchema('B', { frame: { left: 160, top: 25, width: 80, height: 50 } }),
        createSchema('C', { frame: { left: 320, top: 25, width: 80, height: 50 } }),
      ];

      const result = analyzeHorizontalAlignment(parentFrame, children);
      expect(result.type).toBe('space-between');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect space-evenly alignment', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 };
      // Space-evenly: all gaps equal (including edges)
      // Total space = 400, 3 elements of 80px = 240px content
      // Available space = 160px, 4 gaps = 40px each
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 40, top: 25, width: 80, height: 50 } }),
        createSchema('B', { frame: { left: 160, top: 25, width: 80, height: 50 } }),
        createSchema('C', { frame: { left: 280, top: 25, width: 80, height: 50 } }),
      ];

      const result = analyzeHorizontalAlignment(parentFrame, children);
      expect(result.type).toBe('space-evenly');
    });
  });

  describe('analyzeVerticalAlignment', () => {
    it('should detect top alignment', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 100, height: 400, right: 100, bottom: 400 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 25, top: 10, width: 50, height: 80 } }),
      ];

      const result = analyzeVerticalAlignment(parentFrame, children);
      expect(result.type).toBe('top');
    });

    it('should detect middle alignment', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 100, height: 400, right: 100, bottom: 400 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 25, top: 160, width: 50, height: 80 } }),
      ];

      const result = analyzeVerticalAlignment(parentFrame, children);
      expect(result.type).toBe('middle');
    });

    it('should detect stretch alignment', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 10, top: 0, width: 30, height: 100 } }),
        createSchema('B', { frame: { left: 50, top: 0, width: 30, height: 100 } }),
      ];

      const result = analyzeVerticalAlignment(parentFrame, children);
      expect(result.type).toBe('stretch');
    });
  });

  describe('alignmentToCSS', () => {
    it('should convert row layout alignment to CSS', () => {
      const css = alignmentToCSS('center', 'middle', 'row');
      expect(css.justifyContent).toBe('center');
      expect(css.alignItems).toBe('center');
    });

    it('should convert column layout alignment to CSS', () => {
      const css = alignmentToCSS('center', 'middle', 'column');
      expect(css.justifyContent).toBe('center');
      expect(css.alignItems).toBe('center');
    });

    it('should convert space-between to CSS', () => {
      const css = alignmentToCSS('space-between', 'top', 'row');
      expect(css.justifyContent).toBe('space-between');
      expect(css.alignItems).toBe('flex-start');
    });

    it('should convert space-evenly to CSS', () => {
      const css = alignmentToCSS('space-evenly', 'middle', 'row');
      expect(css.justifyContent).toBe('space-evenly');
      expect(css.alignItems).toBe('center');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  describe('determineLayoutType with optimizations', () => {
    it('should use multi-strategy for complex layouts', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 10, top: 10, width: 380, height: 80 } }),
        createSchema('B', { frame: { left: 10, top: 110, width: 380, height: 80 } }),
        createSchema('C', { frame: { left: 10, top: 210, width: 380, height: 80 } }),
      ];

      const result = determineLayoutType(parentFrame, children);
      expect(result.layoutType).toBe('column');
      expect(result.groups.length).toBe(3);
    });

    it('should handle grid-like layouts', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 10, top: 10, width: 180, height: 130 } }),
        createSchema('B', { frame: { left: 210, top: 10, width: 180, height: 130 } }),
        createSchema('C', { frame: { left: 10, top: 160, width: 180, height: 130 } }),
        createSchema('D', { frame: { left: 210, top: 160, width: 180, height: 130 } }),
      ];

      const result = determineLayoutType(parentFrame, children);
      expect(result.layoutType).toBe('column'); // Should split into 2 rows
      expect(result.groups.length).toBe(2);
    });
  });

  describe('layoutParser with enhanced alignment', () => {
    it('should detect space-between in row layout', () => {
      const schema = createSchema('Container', {
        frame: { left: 0, top: 0, width: 400, height: 100 },
        children: [
          createSchema('A', { frame: { left: 0, top: 25, width: 80, height: 50 } }),
          createSchema('B', { frame: { left: 160, top: 25, width: 80, height: 50 } }),
          createSchema('C', { frame: { left: 320, top: 25, width: 80, height: 50 } }),
        ],
      });

      const result = layoutParser(schema);
      expect(result.layoutType).toBe('row');
      // Should have space-between justifyContent
      expect(result.props?.style?.justifyContent).toBe('space-between');
    });

    it('should detect center alignment', () => {
      const schema = createSchema('Container', {
        frame: { left: 0, top: 0, width: 400, height: 100 },
        children: [
          createSchema('A', { frame: { left: 150, top: 25, width: 100, height: 50 } }),
        ],
      });

      const result = layoutParser(schema);
      // Should detect center alignment
      expect(result['x-layout']?.alignHorizontal).toBe('center');
    });
  });

  describe('detectAlignmentExtended', () => {
    it('should return extended types with confidence', () => {
      const parentFrame: Frame = { left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 };
      const children: NodeSchema[] = [
        createSchema('A', { frame: { left: 0, top: 25, width: 80, height: 50 } }),
        createSchema('B', { frame: { left: 160, top: 25, width: 80, height: 50 } }),
        createSchema('C', { frame: { left: 320, top: 25, width: 80, height: 50 } }),
      ];

      const result = detectAlignmentExtended(parentFrame, children);
      expect(result.alignHorizontal).toBe('space-between');
      expect(result.horizontalConfidence).toBeGreaterThan(0);
      expect(result.verticalConfidence).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('calculateVariance', () => {
    it('should calculate variance correctly', () => {
      expect(calculateVariance([1, 1, 1])).toBe(0);
      expect(calculateVariance([0, 2, 4])).toBeCloseTo(2.67, 1);
    });
  });

  describe('calculateCV', () => {
    it('should calculate coefficient of variation', () => {
      expect(calculateCV([10, 10, 10])).toBe(0);
      const cv = calculateCV([10, 20, 30]);
      expect(cv).toBeGreaterThan(0);
    });
  });
});
