/**
 * Supported Functions
 * 
 * Defines the built-in functions available in flows.
 */

export interface FunctionDefinition {
  /** Function name */
  name: string;
  /** Display name */
  label: string;
  /** Category */
  category: string;
  /** Description */
  description: string;
  /** Function arguments */
  args: FunctionArg[];
  /** Return type */
  returnType: string;
  /** Example usage */
  example?: string;
}

export interface FunctionArg {
  /** Argument name */
  name: string;
  /** Display label */
  label: string;
  /** Argument type */
  type: 'string' | 'number' | 'boolean' | 'any' | 'array' | 'object';
  /** Whether required */
  required: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Description */
  description?: string;
}

/**
 * Built-in functions
 */
export const supportedFunctions: FunctionDefinition[] = [
  // String functions
  {
    name: 'concat',
    label: 'Concat',
    category: 'String',
    description: 'Concatenate multiple strings',
    args: [
      { name: 'values', label: 'Values', type: 'array', required: true },
      { name: 'separator', label: 'Separator', type: 'string', required: false, defaultValue: '' },
    ],
    returnType: 'string',
    example: 'concat(["Hello", "World"], " ") => "Hello World"',
  },
  {
    name: 'substring',
    label: 'Substring',
    category: 'String',
    description: 'Extract a portion of a string',
    args: [
      { name: 'text', label: 'Text', type: 'string', required: true },
      { name: 'start', label: 'Start', type: 'number', required: true },
      { name: 'end', label: 'End', type: 'number', required: false },
    ],
    returnType: 'string',
    example: 'substring("Hello", 0, 2) => "He"',
  },
  {
    name: 'toUpperCase',
    label: 'To Upper Case',
    category: 'String',
    description: 'Convert string to upper case',
    args: [{ name: 'text', label: 'Text', type: 'string', required: true }],
    returnType: 'string',
  },
  {
    name: 'toLowerCase',
    label: 'To Lower Case',
    category: 'String',
    description: 'Convert string to lower case',
    args: [{ name: 'text', label: 'Text', type: 'string', required: true }],
    returnType: 'string',
  },
  {
    name: 'trim',
    label: 'Trim',
    category: 'String',
    description: 'Remove whitespace from both ends',
    args: [{ name: 'text', label: 'Text', type: 'string', required: true }],
    returnType: 'string',
  },
  {
    name: 'replace',
    label: 'Replace',
    category: 'String',
    description: 'Replace occurrences in string',
    args: [
      { name: 'text', label: 'Text', type: 'string', required: true },
      { name: 'search', label: 'Search', type: 'string', required: true },
      { name: 'replacement', label: 'Replacement', type: 'string', required: true },
    ],
    returnType: 'string',
  },

  // Number functions
  {
    name: 'add',
    label: 'Add',
    category: 'Math',
    description: 'Add numbers',
    args: [
      { name: 'a', label: 'A', type: 'number', required: true },
      { name: 'b', label: 'B', type: 'number', required: true },
    ],
    returnType: 'number',
  },
  {
    name: 'subtract',
    label: 'Subtract',
    category: 'Math',
    description: 'Subtract numbers',
    args: [
      { name: 'a', label: 'A', type: 'number', required: true },
      { name: 'b', label: 'B', type: 'number', required: true },
    ],
    returnType: 'number',
  },
  {
    name: 'multiply',
    label: 'Multiply',
    category: 'Math',
    description: 'Multiply numbers',
    args: [
      { name: 'a', label: 'A', type: 'number', required: true },
      { name: 'b', label: 'B', type: 'number', required: true },
    ],
    returnType: 'number',
  },
  {
    name: 'divide',
    label: 'Divide',
    category: 'Math',
    description: 'Divide numbers',
    args: [
      { name: 'a', label: 'A', type: 'number', required: true },
      { name: 'b', label: 'B', type: 'number', required: true },
    ],
    returnType: 'number',
  },
  {
    name: 'round',
    label: 'Round',
    category: 'Math',
    description: 'Round a number',
    args: [
      { name: 'value', label: 'Value', type: 'number', required: true },
      { name: 'decimals', label: 'Decimals', type: 'number', required: false, defaultValue: 0 },
    ],
    returnType: 'number',
  },
  {
    name: 'floor',
    label: 'Floor',
    category: 'Math',
    description: 'Round down to nearest integer',
    args: [{ name: 'value', label: 'Value', type: 'number', required: true }],
    returnType: 'number',
  },
  {
    name: 'ceil',
    label: 'Ceiling',
    category: 'Math',
    description: 'Round up to nearest integer',
    args: [{ name: 'value', label: 'Value', type: 'number', required: true }],
    returnType: 'number',
  },
  {
    name: 'abs',
    label: 'Absolute',
    category: 'Math',
    description: 'Get absolute value',
    args: [{ name: 'value', label: 'Value', type: 'number', required: true }],
    returnType: 'number',
  },
  {
    name: 'min',
    label: 'Minimum',
    category: 'Math',
    description: 'Get minimum value',
    args: [{ name: 'values', label: 'Values', type: 'array', required: true }],
    returnType: 'number',
  },
  {
    name: 'max',
    label: 'Maximum',
    category: 'Math',
    description: 'Get maximum value',
    args: [{ name: 'values', label: 'Values', type: 'array', required: true }],
    returnType: 'number',
  },

  // Date functions
  {
    name: 'now',
    label: 'Now',
    category: 'Date',
    description: 'Get current date/time',
    args: [],
    returnType: 'date',
  },
  {
    name: 'formatDate',
    label: 'Format Date',
    category: 'Date',
    description: 'Format a date',
    args: [
      { name: 'date', label: 'Date', type: 'any', required: true },
      { name: 'format', label: 'Format', type: 'string', required: true },
    ],
    returnType: 'string',
    example: 'formatDate(now(), "YYYY-MM-DD")',
  },
  {
    name: 'addDays',
    label: 'Add Days',
    category: 'Date',
    description: 'Add days to a date',
    args: [
      { name: 'date', label: 'Date', type: 'any', required: true },
      { name: 'days', label: 'Days', type: 'number', required: true },
    ],
    returnType: 'date',
  },
  {
    name: 'diffDays',
    label: 'Difference in Days',
    category: 'Date',
    description: 'Get difference between dates in days',
    args: [
      { name: 'date1', label: 'Date 1', type: 'any', required: true },
      { name: 'date2', label: 'Date 2', type: 'any', required: true },
    ],
    returnType: 'number',
  },

  // Array functions
  {
    name: 'length',
    label: 'Length',
    category: 'Array',
    description: 'Get array length',
    args: [{ name: 'array', label: 'Array', type: 'array', required: true }],
    returnType: 'number',
  },
  {
    name: 'first',
    label: 'First',
    category: 'Array',
    description: 'Get first element',
    args: [{ name: 'array', label: 'Array', type: 'array', required: true }],
    returnType: 'any',
  },
  {
    name: 'last',
    label: 'Last',
    category: 'Array',
    description: 'Get last element',
    args: [{ name: 'array', label: 'Array', type: 'array', required: true }],
    returnType: 'any',
  },
  {
    name: 'sum',
    label: 'Sum',
    category: 'Array',
    description: 'Sum all numeric values',
    args: [{ name: 'array', label: 'Array', type: 'array', required: true }],
    returnType: 'number',
  },
  {
    name: 'average',
    label: 'Average',
    category: 'Array',
    description: 'Get average of numeric values',
    args: [{ name: 'array', label: 'Array', type: 'array', required: true }],
    returnType: 'number',
  },
  {
    name: 'filter',
    label: 'Filter',
    category: 'Array',
    description: 'Filter array by condition',
    args: [
      { name: 'array', label: 'Array', type: 'array', required: true },
      { name: 'field', label: 'Field', type: 'string', required: true },
      { name: 'value', label: 'Value', type: 'any', required: true },
    ],
    returnType: 'array',
  },
  {
    name: 'map',
    label: 'Map',
    category: 'Array',
    description: 'Extract field from array',
    args: [
      { name: 'array', label: 'Array', type: 'array', required: true },
      { name: 'field', label: 'Field', type: 'string', required: true },
    ],
    returnType: 'array',
  },

  // Logic functions
  {
    name: 'if',
    label: 'If',
    category: 'Logic',
    description: 'Conditional expression',
    args: [
      { name: 'condition', label: 'Condition', type: 'boolean', required: true },
      { name: 'trueValue', label: 'True Value', type: 'any', required: true },
      { name: 'falseValue', label: 'False Value', type: 'any', required: true },
    ],
    returnType: 'any',
  },
  {
    name: 'and',
    label: 'And',
    category: 'Logic',
    description: 'Logical AND',
    args: [{ name: 'values', label: 'Values', type: 'array', required: true }],
    returnType: 'boolean',
  },
  {
    name: 'or',
    label: 'Or',
    category: 'Logic',
    description: 'Logical OR',
    args: [{ name: 'values', label: 'Values', type: 'array', required: true }],
    returnType: 'boolean',
  },
  {
    name: 'not',
    label: 'Not',
    category: 'Logic',
    description: 'Logical NOT',
    args: [{ name: 'value', label: 'Value', type: 'boolean', required: true }],
    returnType: 'boolean',
  },
  {
    name: 'isEmpty',
    label: 'Is Empty',
    category: 'Logic',
    description: 'Check if value is empty',
    args: [{ name: 'value', label: 'Value', type: 'any', required: true }],
    returnType: 'boolean',
  },
  {
    name: 'isNull',
    label: 'Is Null',
    category: 'Logic',
    description: 'Check if value is null',
    args: [{ name: 'value', label: 'Value', type: 'any', required: true }],
    returnType: 'boolean',
  },
];

/**
 * Get function definition by name
 */
export function getFunctionDefinition(name: string): FunctionDefinition | undefined {
  return supportedFunctions.find((f) => f.name === name);
}

/**
 * Get functions by category
 */
export function getFunctionsByCategory(): Map<string, FunctionDefinition[]> {
  const categories = new Map<string, FunctionDefinition[]>();
  
  supportedFunctions.forEach((fn) => {
    const list = categories.get(fn.category) || [];
    list.push(fn);
    categories.set(fn.category, list);
  });

  return categories;
}

/**
 * Get all categories
 */
export function getFunctionCategories(): string[] {
  return Array.from(new Set(supportedFunctions.map((f) => f.category)));
}
