"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.formulaQueryBuilderV2 = formulaQueryBuilderV2;
const types_1 = require("../interface/types");
const queryBuilderHelper_1 = require("../helpers/queryBuilderHelper");
const pg_1 = require("../functionMappings/pg");
// ========================================
// Main Formula Builder
// ========================================
/**
 * Build SQL expression from formula string
 * @param formula - Formula string
 * @param model - Current model
 * @param models - All models
 * @param dbDriver - Database driver
 * @returns SQL expression string
 */
async function formulaQueryBuilderV2(formula, model, models, dbDriver) {
    if (!formula) {
        return 'NULL';
    }
    try {
        // Parse formula into AST
        const ast = parseFormula(formula);
        // Build SQL from AST
        return await buildSqlFromAst(ast, model, models, dbDriver);
    }
    catch (error) {
        console.error('Formula parsing error:', error);
        return 'NULL';
    }
}
// ========================================
// Formula Parser
// ========================================
/**
 * Parse formula string into AST
 * Simple recursive descent parser for formulas
 */
function parseFormula(formula) {
    const tokens = tokenize(formula);
    let pos = 0;
    function peek() {
        return tokens[pos];
    }
    function consume() {
        return tokens[pos++];
    }
    function parseExpression() {
        return parseAddSub();
    }
    function parseAddSub() {
        let left = parseMulDiv();
        while (peek() === '+' || peek() === '-') {
            const operator = consume();
            const right = parseMulDiv();
            left = { type: 'binary', operator, left, right };
        }
        return left;
    }
    function parseMulDiv() {
        let left = parseUnary();
        while (peek() === '*' || peek() === '/' || peek() === '%') {
            const operator = consume();
            const right = parseUnary();
            left = { type: 'binary', operator, left, right };
        }
        return left;
    }
    function parseUnary() {
        if (peek() === '-') {
            consume();
            const operand = parsePrimary();
            return { type: 'binary', operator: '*', left: { type: 'literal', value: -1 }, right: operand };
        }
        return parsePrimary();
    }
    function parsePrimary() {
        const token = peek();
        if (!token) {
            return { type: 'literal', value: null };
        }
        // Parentheses
        if (token === '(') {
            consume();
            const expr = parseExpression();
            if (peek() === ')')
                consume();
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
            // Check if function call
            if (peek() === '(') {
                consume();
                const args = [];
                while (peek() && peek() !== ')') {
                    args.push(parseExpression());
                    if (peek() === ',')
                        consume();
                }
                if (peek() === ')')
                    consume();
                return { type: 'function', name: token.toUpperCase(), args };
            }
            // Column reference (wrapped in {})
            return { type: 'column', name: token };
        }
        // Column reference with braces {column_name}
        if (token.startsWith('{') && token.endsWith('}')) {
            consume();
            return { type: 'column', name: token.slice(1, -1) };
        }
        // Unknown token, treat as literal
        consume();
        return { type: 'literal', value: token };
    }
    return parseExpression();
}
/**
 * Tokenize formula string
 */
function tokenize(formula) {
    const tokens = [];
    let i = 0;
    while (i < formula.length) {
        const char = formula[i];
        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        // Operators and punctuation
        if ('+-*/%(),'.includes(char)) {
            tokens.push(char);
            i++;
            continue;
        }
        // String literals
        if (char === '"' || char === "'") {
            const quote = char;
            let str = quote;
            i++;
            while (i < formula.length && formula[i] !== quote) {
                if (formula[i] === '\\' && i + 1 < formula.length) {
                    str += formula[i + 1];
                    i += 2;
                }
                else {
                    str += formula[i];
                    i++;
                }
            }
            str += quote;
            i++;
            tokens.push(str);
            continue;
        }
        // Column references with braces
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
        // Numbers
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
        // Identifiers (function names, column names)
        if (/[a-zA-Z_]/.test(char)) {
            let ident = '';
            while (i < formula.length && /[\w]/.test(formula[i])) {
                ident += formula[i];
                i++;
            }
            tokens.push(ident);
            continue;
        }
        // Unknown character, skip
        i++;
    }
    return tokens;
}
// ========================================
// SQL Builder from AST
// ========================================
async function buildSqlFromAst(node, model, models, dbDriver) {
    switch (node.type) {
        case 'literal':
            return formatLiteral(node.value);
        case 'column':
            return await buildColumnReference(node.name, model, models, dbDriver);
        case 'function':
            return await buildFunctionCall(node.name, node.args || [], model, models, dbDriver);
        case 'binary':
            const left = await buildSqlFromAst(node.left, model, models, dbDriver);
            const right = await buildSqlFromAst(node.right, model, models, dbDriver);
            return `(${left} ${node.operator} ${right})`;
        default:
            return 'NULL';
    }
}
function formatLiteral(value) {
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
async function buildColumnReference(columnName, model, models, dbDriver) {
    const column = (0, queryBuilderHelper_1.getColumnByName)(columnName, model);
    if (!column) {
        // Column not found, return as literal
        return `'${columnName}'`;
    }
    // Handle virtual columns
    if ((0, queryBuilderHelper_1.isVirtualColumn)(column)) {
        return await buildVirtualColumnReference(column, model, models, dbDriver);
    }
    // Regular column
    return (0, queryBuilderHelper_1.getSqlColumnNameWithCast)(column, model);
}
async function buildVirtualColumnReference(column, model, models, dbDriver) {
    switch (column.uidt) {
        case types_1.UITypes.Formula:
            const formulaOptions = column.colOptions;
            if (formulaOptions?.formula) {
                return await formulaQueryBuilderV2(formulaOptions.formula, model, models, dbDriver);
            }
            return 'NULL';
        case types_1.UITypes.Rollup:
            const { genRollupSelectV2 } = await Promise.resolve().then(() => __importStar(require('./genRollupSelectV2')));
            const rollupQuery = await genRollupSelectV2({
                column,
                model,
                models,
                dbDriver,
            });
            return `(${rollupQuery.toQuery()})`;
        case types_1.UITypes.Lookup:
            const lookupOptions = column.colOptions;
            if (lookupOptions?.fk_relation_column_id && lookupOptions?.fk_lookup_column_id) {
                const relationColumn = (0, queryBuilderHelper_1.getColumnById)(lookupOptions.fk_relation_column_id, model);
                if (relationColumn) {
                    const relationOptions = relationColumn.colOptions;
                    if (relationOptions?.fk_related_model_id) {
                        const relatedTable = (0, queryBuilderHelper_1.getTableByIdMust)(relationOptions.fk_related_model_id, models);
                        const lookupColumn = (0, queryBuilderHelper_1.getColumnById)(lookupOptions.fk_lookup_column_id, relatedTable);
                        if (lookupColumn) {
                            const lookupSqlCol = (0, queryBuilderHelper_1.getSqlColumnName)(lookupColumn, relatedTable, 'lookup_ref');
                            return `(SELECT ${lookupSqlCol} FROM nc_bigtable lookup_ref WHERE lookup_ref.fk_table_id = '${relatedTable.id}' AND lookup_ref.id = nc_bigtable.data ->> '${relationColumn.column_name}' LIMIT 1)`;
                        }
                    }
                }
            }
            return 'NULL';
        case types_1.UITypes.LinkToAnotherRecord:
        case types_1.UITypes.Links:
            const { genLinkCountToSelect } = await Promise.resolve().then(() => __importStar(require('./genLinkCountToSelect')));
            const countQuery = genLinkCountToSelect({
                modelId: model.id,
                column,
                models,
                dbDriver,
            });
            return `(${countQuery.toQuery()})`;
        default:
            return 'NULL';
    }
}
async function buildFunctionCall(functionName, args, model, models, dbDriver) {
    // Build argument SQL expressions
    const argExprs = [];
    for (const arg of args) {
        argExprs.push(await buildSqlFromAst(arg, model, models, dbDriver));
    }
    // Get function from mappings
    const fn = (0, pg_1.getFunction)(functionName);
    if (fn) {
        const result = fn(argExprs, dbDriver);
        if (typeof result === 'string') {
            return result;
        }
        return result.toQuery();
    }
    // Unknown function, call directly (might be a PostgreSQL built-in)
    return `${functionName}(${argExprs.join(', ')})`;
}
//# sourceMappingURL=formulaQueryBuilderV2.js.map