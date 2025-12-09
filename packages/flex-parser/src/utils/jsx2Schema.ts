/**
 * JSX to Schema converter
 * Converts JSX element structure to NodeSchema format
 */

import type { NodeSchema, JSXElement, Frame, StyleProps } from '../types.js';
import { generateId } from './utils.js';

/**
 * Check if a value is a JSX element
 */
function isJSXElement(value: unknown): value is JSXElement {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value
  );
}

/**
 * Extract component name from JSX type
 */
function getComponentName(type: string | ((...args: unknown[]) => unknown)): string {
  if (typeof type === 'string') {
    // HTML element or string component name
    return type;
  }
  if (typeof type === 'function') {
    // Function component - use function name
    return type.name || 'Anonymous';
  }
  return 'Unknown';
}

/**
 * Extract frame from style props
 */
function extractFrame(style?: Record<string, unknown>): Frame | undefined {
  if (!style) return undefined;

  const left = typeof style.left === 'number' ? style.left : 0;
  const top = typeof style.top === 'number' ? style.top : 0;
  const width = typeof style.width === 'number' ? style.width : 0;
  const height = typeof style.height === 'number' ? style.height : 0;

  // Only return frame if we have at least width and height
  if (width > 0 || height > 0) {
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    };
  }

  return undefined;
}

/**
 * Extract style props, filtering out frame-related properties
 */
function extractStyleProps(style?: Record<string, unknown>): StyleProps | undefined {
  if (!style) return undefined;

  const frameKeys = ['left', 'top', 'width', 'height', 'right', 'bottom'];
  const filteredStyle: StyleProps = {};

  for (const [key, value] of Object.entries(style)) {
    if (!frameKeys.includes(key)) {
      filteredStyle[key] = value;
    }
  }

  return Object.keys(filteredStyle).length > 0 ? filteredStyle : undefined;
}

/**
 * Convert JSX children to NodeSchema array
 */
function convertChildren(
  children: JSXElement | JSXElement[] | string | number | null | undefined
): NodeSchema[] | undefined {
  if (children === null || children === undefined) {
    return undefined;
  }

  if (typeof children === 'string' || typeof children === 'number') {
    // Text node - wrap in a text schema
    return [{
      componentName: 'Text',
      props: { children: String(children) },
    }];
  }

  if (Array.isArray(children)) {
    const convertedChildren: NodeSchema[] = [];
    for (const child of children) {
      if (isJSXElement(child)) {
        convertedChildren.push(jsx2Schema(child));
      } else if (typeof child === 'string' || typeof child === 'number') {
        convertedChildren.push({
          componentName: 'Text',
          props: { children: String(child) },
        });
      }
    }
    return convertedChildren.length > 0 ? convertedChildren : undefined;
  }

  if (isJSXElement(children)) {
    return [jsx2Schema(children)];
  }

  return undefined;
}

/**
 * Convert a JSX element to NodeSchema
 * 
 * @param jsxElement - The JSX element to convert
 * @returns The converted NodeSchema
 * 
 * @example
 * ```tsx
 * const element = <div style={{ left: 0, top: 0, width: 100, height: 50 }}>
 *   <span>Hello</span>
 * </div>;
 * 
 * const schema = jsx2Schema(element);
 * // {
 * //   componentName: 'div',
 * //   frame: { left: 0, top: 0, width: 100, height: 50 },
 * //   children: [{ componentName: 'span', children: [...] }]
 * // }
 * ```
 */
export function jsx2Schema(jsxElement: JSXElement): NodeSchema {
  const { type, props, children: elementChildren } = jsxElement;
  
  const componentName = getComponentName(type);
  const schema: NodeSchema = {
    componentName,
    id: generateId(componentName.toLowerCase()),
  };

  // Process props
  if (props) {
    const { style, children: propsChildren, ...restProps } = props as Record<string, unknown>;

    // Extract frame from style
    const frame = extractFrame(style as Record<string, unknown> | undefined);
    if (frame) {
      schema.frame = frame;
    }

    // Extract remaining style props
    const styleProps = extractStyleProps(style as Record<string, unknown> | undefined);
    
    // Build props object
    const schemaProps: Record<string, unknown> = { ...restProps };
    if (styleProps) {
      schemaProps.style = styleProps;
    }
    
    if (Object.keys(schemaProps).length > 0) {
      schema.props = schemaProps;
    }

    // Handle children from props (for React compatibility)
    const childrenSource = elementChildren ?? propsChildren;
    const convertedChildren = convertChildren(
      childrenSource as JSXElement | JSXElement[] | string | number | null | undefined
    );
    if (convertedChildren) {
      schema.children = convertedChildren;
    }
  } else {
    // No props - just process element children
    const convertedChildren = convertChildren(elementChildren);
    if (convertedChildren) {
      schema.children = convertedChildren;
    }
  }

  return schema;
}

/**
 * Convert NodeSchema back to a plain object structure
 * Useful for serialization
 */
export function schemaToPlainObject(schema: NodeSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {
    componentName: schema.componentName,
  };

  if (schema.id) {
    result.id = schema.id;
  }

  if (schema.frame) {
    result.frame = { ...schema.frame };
  }

  if (schema.props) {
    result.props = { ...schema.props };
  }

  if (schema.layoutType) {
    result.layoutType = schema.layoutType;
  }

  if (schema['x-layout']) {
    result['x-layout'] = { ...schema['x-layout'] };
  }

  if (schema.children && schema.children.length > 0) {
    result.children = schema.children.map(schemaToPlainObject);
  }

  return result;
}

/**
 * Create a NodeSchema from a plain object
 */
export function createSchema(
  componentName: string,
  options: {
    frame?: Partial<Frame>;
    props?: Record<string, unknown>;
    children?: NodeSchema[];
    id?: string;
  } = {}
): NodeSchema {
  const schema: NodeSchema = {
    componentName,
    id: options.id ?? generateId(componentName.toLowerCase()),
  };

  if (options.frame) {
    schema.frame = {
      left: options.frame.left ?? 0,
      top: options.frame.top ?? 0,
      width: options.frame.width ?? 0,
      height: options.frame.height ?? 0,
      right: (options.frame.left ?? 0) + (options.frame.width ?? 0),
      bottom: (options.frame.top ?? 0) + (options.frame.height ?? 0),
    };
  }

  if (options.props) {
    schema.props = options.props;
  }

  if (options.children && options.children.length > 0) {
    schema.children = options.children;
  }

  return schema;
}

/**
 * Create a container schema with children
 */
export function createContainer(
  frame: Partial<Frame>,
  children: NodeSchema[],
  componentName: string = 'Container'
): NodeSchema {
  return createSchema(componentName, {
    frame,
    children,
  });
}
