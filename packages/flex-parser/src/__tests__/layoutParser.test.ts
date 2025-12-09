/**
 * Tests for the layout parser
 */

import { describe, it, expect } from 'vitest';
import {
  layoutParser,
  createSchema,
  splitToRow,
  splitToColumn,
  normalizeFrame,
  getNodeFrame,
  determineLayoutType,
  generateFlexStyle,
} from '../index.js';
import type { NodeSchema, Frame } from '../types.js';

describe('normalizeFrame', () => {
  it('should calculate right and bottom from left, top, width, height', () => {
    const frame = normalizeFrame({ left: 10, top: 20, width: 100, height: 50 });
    expect(frame.right).toBe(110);
    expect(frame.bottom).toBe(70);
  });

  it('should handle zero values', () => {
    const frame = normalizeFrame({ left: 0, top: 0, width: 0, height: 0 });
    expect(frame.left).toBe(0);
    expect(frame.top).toBe(0);
    expect(frame.right).toBe(0);
    expect(frame.bottom).toBe(0);
  });
});

describe('createSchema', () => {
  it('should create a basic schema', () => {
    const schema = createSchema('Container');
    expect(schema.componentName).toBe('Container');
    expect(schema.id).toBeDefined();
  });

  it('should create schema with frame', () => {
    const schema = createSchema('Box', {
      frame: { left: 10, top: 20, width: 100, height: 50 },
    });
    expect(schema.frame?.left).toBe(10);
    expect(schema.frame?.top).toBe(20);
    expect(schema.frame?.width).toBe(100);
    expect(schema.frame?.height).toBe(50);
    expect(schema.frame?.right).toBe(110);
    expect(schema.frame?.bottom).toBe(70);
  });

  it('should create schema with children', () => {
    const child = createSchema('Child');
    const parent = createSchema('Parent', { children: [child] });
    expect(parent.children).toHaveLength(1);
    expect(parent.children?.[0].componentName).toBe('Child');
  });
});

describe('splitToColumn', () => {
  it('should split horizontally arranged elements into columns', () => {
    const nodes: NodeSchema[] = [
      createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
      createSchema('B', { frame: { left: 70, top: 0, width: 50, height: 50 } }),
      createSchema('C', { frame: { left: 140, top: 0, width: 50, height: 50 } }),
    ];

    const result = splitToColumn(nodes);
    expect(result.success).toBe(true);
    expect(result.groups).toHaveLength(3);
  });

  it('should not split single element', () => {
    const nodes: NodeSchema[] = [
      createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
    ];

    const result = splitToColumn(nodes);
    expect(result.success).toBe(false);
    expect(result.groups).toHaveLength(1);
  });

  it('should not split overlapping elements', () => {
    const nodes: NodeSchema[] = [
      createSchema('A', { frame: { left: 0, top: 0, width: 100, height: 50 } }),
      createSchema('B', { frame: { left: 50, top: 0, width: 100, height: 50 } }),
    ];

    const result = splitToColumn(nodes);
    // Should return single group as elements overlap
    expect(result.success).toBe(false);
  });
});

describe('splitToRow', () => {
  it('should split vertically arranged elements into rows', () => {
    const nodes: NodeSchema[] = [
      createSchema('A', { frame: { left: 0, top: 0, width: 100, height: 50 } }),
      createSchema('B', { frame: { left: 0, top: 70, width: 100, height: 50 } }),
      createSchema('C', { frame: { left: 0, top: 140, width: 100, height: 50 } }),
    ];

    const result = splitToRow(nodes);
    expect(result.success).toBe(true);
    expect(result.groups).toHaveLength(3);
  });

  it('should not split horizontally arranged elements', () => {
    const nodes: NodeSchema[] = [
      createSchema('A', { frame: { left: 0, top: 0, width: 50, height: 50 } }),
      createSchema('B', { frame: { left: 70, top: 0, width: 50, height: 50 } }),
    ];

    const result = splitToRow(nodes);
    // Should return single group as elements are side by side
    expect(result.success).toBe(false);
  });
});

describe('determineLayoutType', () => {
  it('should determine row layout for horizontally arranged elements', () => {
    const parentFrame: Frame = { left: 0, top: 0, width: 300, height: 100, right: 300, bottom: 100 };
    const children: NodeSchema[] = [
      createSchema('A', { frame: { left: 10, top: 25, width: 80, height: 50 } }),
      createSchema('B', { frame: { left: 110, top: 25, width: 80, height: 50 } }),
      createSchema('C', { frame: { left: 210, top: 25, width: 80, height: 50 } }),
    ];

    const result = determineLayoutType(parentFrame, children);
    expect(result.layoutType).toBe('row');
  });

  it('should determine column layout for vertically arranged elements', () => {
    const parentFrame: Frame = { left: 0, top: 0, width: 100, height: 300, right: 100, bottom: 300 };
    const children: NodeSchema[] = [
      createSchema('A', { frame: { left: 10, top: 10, width: 80, height: 50 } }),
      createSchema('B', { frame: { left: 10, top: 80, width: 80, height: 50 } }),
      createSchema('C', { frame: { left: 10, top: 150, width: 80, height: 50 } }),
    ];

    const result = determineLayoutType(parentFrame, children);
    expect(result.layoutType).toBe('column');
  });
});

describe('generateFlexStyle', () => {
  it('should generate flex style for row layout', () => {
    const node: NodeSchema = {
      componentName: 'Container',
      layoutType: 'row',
      frame: { left: 0, top: 0, width: 300, height: 100, right: 300, bottom: 100 },
    };

    const style = generateFlexStyle(node);
    expect(style.display).toBe('flex');
    expect(style.flexDirection).toBe('row');
    expect(style.width).toBe(300);
    expect(style.height).toBe(100);
  });

  it('should generate flex style for column layout', () => {
    const node: NodeSchema = {
      componentName: 'Container',
      layoutType: 'column',
      frame: { left: 0, top: 0, width: 100, height: 300, right: 100, bottom: 300 },
    };

    const style = generateFlexStyle(node);
    expect(style.display).toBe('flex');
    expect(style.flexDirection).toBe('column');
  });

  it('should apply alignment from x-layout', () => {
    const node: NodeSchema = {
      componentName: 'Container',
      layoutType: 'row',
      frame: { left: 0, top: 0, width: 300, height: 100, right: 300, bottom: 100 },
      'x-layout': {
        alignHorizontal: 'center',
        alignVertical: 'middle',
      },
    };

    const style = generateFlexStyle(node);
    expect(style.justifyContent).toBe('center');
    expect(style.alignItems).toBe('center');
  });
});

describe('layoutParser', () => {
  it('should convert a simple row layout', () => {
    const schema = createSchema('Container', {
      frame: { left: 0, top: 0, width: 300, height: 100 },
      children: [
        createSchema('A', { frame: { left: 10, top: 25, width: 80, height: 50 } }),
        createSchema('B', { frame: { left: 110, top: 25, width: 80, height: 50 } }),
        createSchema('C', { frame: { left: 210, top: 25, width: 80, height: 50 } }),
      ],
    });

    const result = layoutParser(schema);
    expect(result.layoutType).toBe('row');
    expect(result.props?.style?.display).toBe('flex');
    expect(result.props?.style?.flexDirection).toBe('row');
  });

  it('should convert a simple column layout', () => {
    const schema = createSchema('Container', {
      frame: { left: 0, top: 0, width: 100, height: 300 },
      children: [
        createSchema('A', { frame: { left: 10, top: 10, width: 80, height: 50 } }),
        createSchema('B', { frame: { left: 10, top: 80, width: 80, height: 50 } }),
        createSchema('C', { frame: { left: 10, top: 150, width: 80, height: 50 } }),
      ],
    });

    const result = layoutParser(schema);
    expect(result.layoutType).toBe('column');
    expect(result.props?.style?.display).toBe('flex');
    expect(result.props?.style?.flexDirection).toBe('column');
  });

  it('should handle nested layouts', () => {
    const schema = createSchema('Container', {
      frame: { left: 0, top: 0, width: 400, height: 300 },
      children: [
        createSchema('Row1', {
          frame: { left: 10, top: 10, width: 380, height: 80 },
          children: [
            createSchema('A', { frame: { left: 10, top: 15, width: 100, height: 50 } }),
            createSchema('B', { frame: { left: 130, top: 15, width: 100, height: 50 } }),
          ],
        }),
        createSchema('Row2', {
          frame: { left: 10, top: 110, width: 380, height: 80 },
          children: [
            createSchema('C', { frame: { left: 10, top: 15, width: 100, height: 50 } }),
            createSchema('D', { frame: { left: 130, top: 15, width: 100, height: 50 } }),
          ],
        }),
      ],
    });

    const result = layoutParser(schema);
    expect(result.layoutType).toBe('column');
    expect(result.children).toHaveLength(2);
    expect(result.children?.[0].layoutType).toBe('row');
    expect(result.children?.[1].layoutType).toBe('row');
  });

  it('should handle empty or no children', () => {
    const schema = createSchema('Container', {
      frame: { left: 0, top: 0, width: 100, height: 100 },
    });

    const result = layoutParser(schema);
    // When no children are provided, children property is undefined
    expect(result.children).toBeUndefined();
  });

  it('should handle schema with explicit empty children array', () => {
    const schema: NodeSchema = {
      componentName: 'Container',
      frame: { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 },
      children: [],
    };

    const result = layoutParser(schema);
    // When children is empty array, it remains empty
    expect(result.children).toHaveLength(0);
  });

  it('should calculate padding', () => {
    const schema = createSchema('Container', {
      frame: { left: 0, top: 0, width: 200, height: 100 },
      children: [
        createSchema('A', { frame: { left: 20, top: 20, width: 160, height: 60 } }),
      ],
    });

    const result = layoutParser(schema);
    // Padding should be calculated from container edges to content
    expect(result.props?.style?.paddingTop).toBe(20);
    expect(result.props?.style?.paddingLeft).toBe(20);
  });

  it('should calculate gap between elements', () => {
    const schema = createSchema('Container', {
      frame: { left: 0, top: 0, width: 300, height: 100 },
      children: [
        createSchema('A', { frame: { left: 10, top: 25, width: 80, height: 50 } }),
        createSchema('B', { frame: { left: 110, top: 25, width: 80, height: 50 } }),
        createSchema('C', { frame: { left: 210, top: 25, width: 80, height: 50 } }),
      ],
    });

    const result = layoutParser(schema);
    // Gap should be calculated from spacing between elements
    expect(result.props?.style?.gap).toBe(20);
  });
});
