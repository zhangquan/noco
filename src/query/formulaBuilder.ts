/**
 * Formula query builder
 * @module query/formulaBuilder
 */

import type { Knex } from 'knex';
import type { Column, Table } from '../types';
import { UITypes, getColumnName } from '../types';
import { getColumnByName, getColumnById, isVirtualColumn, getTableByIdOrThrow } from '../utils/columnUtils';
import { getColumnExpressionWithCast, getColumnExpression } from './sqlBuilder';
import { getFunction } from '../functions';
import { TABLE_DATA } from '../config';

// ============================================================================
// AST Types
// ============================================================================

interface FormulaNode {
  type: 'function' | 'column' | 'literal' | 'binary';
  name?: string;
  value?: unknown;
  args?: FormulaNode[];
  left?: FormulaNode;
  right?: FormulaNode;
  operator?: string;
}

// ============================================================================
// Main Formula Builder
// ============================================================================

/**
 * Build SQL expression from formula string
 */
export async function buildFormulaExpression(
  formula: string,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<string> {
  if (!formula) {
    return 'NULL';
  }

  try {
    const ast = parseFormula(formula);
    return await buildSqlFromAst(ast, table, tables, db);
  } catch (error) {
    console.error('Formula parsing error:', error);
    return 'NULL';
  }
}

// ============================================================================
// Formula Parser
// ============================================================================

function parseFormula(formula: string): FormulaNode {
  const tokens = tokenize(formula);
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function consume(): string {
    return tokens[pos++];
  }

  function parseExpression(): FormulaNode {
    return parseAddSub();
  }

  function parseAddSub(): FormulaNode {
    let left = parseMulDiv();

    while (peek() === '+' || peek() === '-') {
      const operator = consume();
      const right = parseMulDiv();
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  function parseMulDiv(): FormulaNode {
    let left = parseUnary();

    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const operator = consume();
      const right = parseUnary();
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  function parseUnary(): FormulaNode {
    if (peek() === '-') {
      consume();
      const operand = parsePrimary();
      return {
        type: 'binary',
        operator: '*',
        left: { type: 'literal', value: -1 },
        right: operand,
      };
    }
    return parsePrimary();
  }

  function parsePrimary(): FormulaNode {
    const token = peek();

    if (!token) {
      return { type: 'literal', value: null };
    }

    // Parentheses
    if (token === '(') {
      consume();
      const expr = parseExpression();
      if (peek() === ')') consume();
      return expr;
    }

    // String literal
    if (token.startsWith('"') || token.startsWith("'")) {
      consume();
      return { type: 'literal', value: token.slice(1, -1) };
    }

    // Number literal
    if (/^-?\d+\.?\d*$/.test(token)) {
      consume();
      return { type: 'literal', value: parseFloat(token) };
    }

    // Function call or column reference
    if (/^[a-zA-Z_][\w]*$/.test(token)) {
      consume();

      if (peek() === '(') {
        consume();
        const args: FormulaNode[] = [];

        while (peek() && peek() !== ')') {
          args.push(parseExpression());
          if (peek() === ',') consume();
        }

        if (peek() === ')') consume();

        return { type: 'function', name: token.toUpperCase(), args };
      }

      return { type: 'column', name: token };
    }

    // Column reference with braces
    if (token.startsWith('{') && token.endsWith('}')) {
      consume();
      return { type: 'column', name: token.slice(1, -1) };
    }

    consume();
    return { type: 'literal', value: token };
  }

  return parseExpression();
}

function tokenize(formula: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if ('+-*/%(),'.includes(char)) {
      tokens.push(char);
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let str = quote;
      i++;
      while (i < formula.length && formula[i] !== quote) {
        if (formula[i] === '\\' && i + 1 < formula.length) {
          str += formula[i + 1];
          i += 2;
        } else {
          str += formula[i];
          i++;
        }
      }
      str += quote;
      i++;
      tokens.push(str);
      continue;
    }

    if (char === '{') {
      let ref = '{';
      i++;
      while (i < formula.length && formula[i] !== '}') {
        ref += formula[i];
        i++;
      }
      ref += '}';
      i++;
      tokens.push(ref);
      continue;
    }

    if (/\d/.test(char) || (char === '-' && i + 1 < formula.length && /\d/.test(formula[i + 1]))) {
      let num = '';
      if (char === '-') {
        num += char;
        i++;
      }
      while (i < formula.length && /[\d.]/.test(formula[i])) {
        num += formula[i];
        i++;
      }
      tokens.push(num);
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let ident = '';
      while (i < formula.length && /[\w]/.test(formula[i])) {
        ident += formula[i];
        i++;
      }
      tokens.push(ident);
      continue;
    }

    i++;
  }

  return tokens;
}

// ============================================================================
// SQL Builder from AST
// ============================================================================

async function buildSqlFromAst(
  node: FormulaNode,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<string> {
  switch (node.type) {
    case 'literal':
      return formatLiteral(node.value);

    case 'column':
      return await buildColumnRef(node.name!, table, tables, db);

    case 'function':
      return await buildFunctionCall(node.name!, node.args || [], table, tables, db);

    case 'binary':
      const left = await buildSqlFromAst(node.left!, table, tables, db);
      const right = await buildSqlFromAst(node.right!, table, tables, db);
      return `(${left} ${node.operator} ${right})`;

    default:
      return 'NULL';
  }
}

function formatLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return String(value);
}

async function buildColumnRef(
  columnName: string,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<string> {
  const column = getColumnByName(columnName, table);
  if (!column) {
    return `'${columnName}'`;
  }

  if (isVirtualColumn(column)) {
    return await buildVirtualColumnRef(column, table, tables, db);
  }

  return getColumnExpressionWithCast(column, table);
}

async function buildVirtualColumnRef(
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<string> {
  switch (column.uidt) {
    case UITypes.Formula: {
      const options = column.colOptions as { formula?: string };
      if (options?.formula) {
        return await buildFormulaExpression(options.formula, table, tables, db);
      }
      return 'NULL';
    }

    case UITypes.Rollup: {
      const { buildRollupSubquery } = await import('./rollupBuilder');
      const rollupQuery = await buildRollupSubquery({ column, table, tables, db });
      return `(${rollupQuery.toQuery()})`;
    }

    case UITypes.Lookup: {
      const options = column.colOptions as {
        fk_relation_column_id?: string;
        fk_lookup_column_id?: string;
      };
      if (options?.fk_relation_column_id && options?.fk_lookup_column_id) {
        const relationColumn = getColumnById(options.fk_relation_column_id, table);
        if (relationColumn) {
          const relationOptions = relationColumn.colOptions as { fk_related_model_id?: string };
          if (relationOptions?.fk_related_model_id) {
            const relatedTable = getTableByIdOrThrow(tables, relationOptions.fk_related_model_id);
            const lookupColumn = getColumnById(options.fk_lookup_column_id, relatedTable);
            if (lookupColumn) {
              const lookupSqlCol = getColumnExpression(lookupColumn, relatedTable, 'lookup_ref');
              const relationColName = getColumnName(relationColumn);
              return `(SELECT ${lookupSqlCol} FROM ${TABLE_DATA} lookup_ref WHERE lookup_ref.table_id = '${relatedTable.id}' AND lookup_ref.id = ${TABLE_DATA}.data ->> '${relationColName}' LIMIT 1)`;
            }
          }
        }
      }
      return 'NULL';
    }

    case UITypes.LinkToAnotherRecord:
    case UITypes.Links: {
      const { buildLinkCountSubquery } = await import('./linkBuilder');
      const countQuery = buildLinkCountSubquery({
        modelId: table.id,
        column,
        tables,
        db,
      });
      return `(${countQuery.toQuery()})`;
    }

    default:
      return 'NULL';
  }
}

async function buildFunctionCall(
  functionName: string,
  args: FormulaNode[],
  table: Table,
  tables: Table[],
  db: Knex
): Promise<string> {
  const argExprs: string[] = [];
  for (const arg of args) {
    argExprs.push(await buildSqlFromAst(arg, table, tables, db));
  }

  const fn = getFunction(functionName);
  if (fn) {
    const result = fn(argExprs, db);
    return typeof result === 'string' ? result : result.toQuery();
  }

  return `${functionName}(${argExprs.join(', ')})`;
}
