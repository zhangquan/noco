# TSX 到 Schema 转换技术分析

> 深入分析如何将完整的 React 组件准确转换为可视化 Schema

## 1. React 组件结构解析

一个完整的 React 组件（TSX 文件）包含多个层次：

```tsx
// ============ 1. Imports 层 ============
import React, { useCallback, useMemo } from 'react';
import { Switch } from 'antd';
import { useStore } from './store';
import type { Props } from './types';
import './styles.scss';

// ============ 2. Types 层 ============
interface ComponentProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

// ============ 3. Component 层 ============
export const MyComponent: React.FC<ComponentProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  // -------- 3.1 Hooks 部分 --------
  const [state, setState] = useState(0);
  const data = useStore((s) => s.data);
  
  // -------- 3.2 Handlers 部分 --------
  const handleClick = useCallback(() => {
    onChange('clicked');
  }, [onChange]);
  
  // -------- 3.3 Computed 部分 --------
  const displayValue = useMemo(() => {
    return value.toUpperCase();
  }, [value]);
  
  // -------- 3.4 Early Returns --------
  if (!data) return <Loading />;
  
  // -------- 3.5 JSX Return (核心可视化部分) --------
  return (
    <div className="container">
      <Header title={displayValue} />
      {/* 条件渲染 */}
      {!disabled && <Button onClick={handleClick}>Click</Button>}
      {/* 列表渲染 */}
      {items.map(item => <Item key={item.id} {...item} />)}
    </div>
  );
};

export default MyComponent;
```

### 1.1 可视化关注点分析

| 层次 | 是否可视化 | 处理方式 |
|------|-----------|---------|
| Imports | ❌ | 提取依赖信息，用于组件注册表 |
| Types | ❌ | 提取 Props 定义，用于属性面板 |
| Hooks | ⚠️ 部分 | 提取状态结构，用于状态面板 |
| Handlers | ❌ | 提取事件绑定信息 |
| Computed | ❌ | 标记为"计算属性" |
| Early Returns | ⚠️ 部分 | 标记为"条件分支" |
| **JSX Return** | ✅ **核心** | **主要可视化目标** |

---

## 2. JSX 语法分类与转换策略

### 2.1 基础 JSX 元素

```tsx
// 输入：简单元素
<div className="box" style={{ padding: 16 }}>
  <span>Hello</span>
</div>
```

```typescript
// 输出：VisionSchema
{
  componentName: 'div',
  id: 'div_001',
  props: {
    className: 'box',
    style: { padding: 16 }
  },
  children: [
    {
      componentName: 'span',
      id: 'span_001',
      children: [
        { componentName: 'Text', props: { content: 'Hello' } }
      ]
    }
  ],
  sourceMapping: {
    location: { start: { line: 1, column: 0 }, end: { line: 4, column: 6 } },
    originalCode: '<div className="box"...'
  }
}
```

**转换规则**：
- ✅ 直接映射 `tagName` → `componentName`
- ✅ 属性直接映射到 `props`
- ✅ 子元素递归转换

### 2.2 条件渲染

#### 2.2.1 逻辑与 (&&)

```tsx
// 输入
{visible && <Modal>Content</Modal>}
```

```typescript
// 输出
{
  componentName: '$Conditional',  // 虚拟节点
  id: 'cond_001',
  condition: {
    type: 'logical_and',
    expression: 'visible',
    expressionAST: { /* AST 表示 */ }
  },
  children: [
    { componentName: 'Modal', children: [...] }
  ],
  visual: {
    label: '条件: visible',
    conditionBadge: '&&'
  }
}
```

#### 2.2.2 三元表达式

```tsx
// 输入
{isLoading ? <Spinner /> : <Content data={data} />}
```

```typescript
// 输出
{
  componentName: '$Ternary',  // 虚拟节点
  id: 'tern_001',
  condition: {
    type: 'ternary',
    expression: 'isLoading',
    expressionAST: { /* AST */ }
  },
  branches: {
    consequent: { componentName: 'Spinner', ... },
    alternate: { componentName: 'Content', props: { data: '$data' }, ... }
  },
  visual: {
    label: '条件: isLoading ? A : B'
  }
}
```

### 2.3 列表渲染

```tsx
// 输入
{items.map(item => (
  <Card key={item.id} title={item.title}>
    {item.content}
  </Card>
))}
```

```typescript
// 输出
{
  componentName: '$Loop',  // 虚拟节点
  id: 'loop_001',
  loop: {
    type: 'map',
    dataSource: 'items',
    itemName: 'item',
    keyExpression: 'item.id'
  },
  template: {  // 循环模板
    componentName: 'Card',
    props: {
      key: { $expr: 'item.id' },
      title: { $expr: 'item.title' }
    },
    children: [
      { componentName: 'Text', props: { content: { $expr: 'item.content' } } }
    ]
  },
  visual: {
    label: '循环: items',
    previewCount: 3  // 预览时显示几个
  }
}
```

### 2.4 Fragment 与多根元素

```tsx
// 输入
<>
  <Header />
  <Main />
  <Footer />
</>
```

```typescript
// 输出
{
  componentName: '$Fragment',
  id: 'frag_001',
  children: [
    { componentName: 'Header', ... },
    { componentName: 'Main', ... },
    { componentName: 'Footer', ... }
  ],
  visual: {
    renderAsGroup: true  // 可视化时作为组渲染
  }
}
```

### 2.5 动态表达式

```tsx
// 输入
<div 
  className={`container ${isActive ? 'active' : ''}`}
  style={{ width: size * 2, ...customStyle }}
  onClick={handleClick}
>
  {formatDate(date)}
</div>
```

```typescript
// 输出
{
  componentName: 'div',
  props: {
    className: {
      $expr: '`container ${isActive ? "active" : ""}`',
      $preview: 'container active',  // 静态预览值
      $dependencies: ['isActive']
    },
    style: {
      $expr: '{ width: size * 2, ...customStyle }',
      $preview: { width: 200 },
      $dependencies: ['size', 'customStyle']
    },
    onClick: {
      $handler: 'handleClick',
      $handlerSource: { line: 15, column: 2 }
    }
  },
  children: [
    {
      componentName: '$Expression',
      expression: {
        $expr: 'formatDate(date)',
        $preview: '2024-01-01',
        $dependencies: ['date']
      }
    }
  ]
}
```

---

## 3. 表达式处理策略

### 3.1 表达式分类

| 类型 | 示例 | 处理策略 |
|------|------|---------|
| 字面量 | `"hello"`, `42`, `true` | 直接使用值 |
| 标识符 | `value`, `props.name` | 标记为变量引用 |
| 模板字符串 | `` `Hello ${name}` `` | 解析模板 + 占位符 |
| 函数调用 | `format(date)` | 保留表达式 + 尝试预估值 |
| 成员访问 | `user.profile.name` | 路径提取 |
| 三元 | `a ? b : c` | 转换为条件节点 |
| 逻辑运算 | `a && b`, `a \|\| b` | 转换为条件节点 |
| 展开运算 | `{...props}` | 标记为动态 props |

### 3.2 表达式值预估

为了在可视化时展示合理的预览，需要"猜测"表达式的值：

```typescript
interface ExpressionResolver {
  // 基于 Props 类型推断
  inferFromType(expr: string, propsType: TypeInfo): unknown;
  
  // 基于默认值推断
  inferFromDefault(expr: string, defaultProps: Record<string, unknown>): unknown;
  
  // 基于命名约定推断
  inferFromNaming(expr: string): unknown;
  
  // 用户提供的预览数据
  resolveFromMockData(expr: string, mockData: Record<string, unknown>): unknown;
}

// 命名约定推断示例
function inferFromNaming(expr: string): unknown {
  const namingPatterns: Record<RegExp, () => unknown> = {
    /^is[A-Z]/:       () => true,           // isVisible → true
    /^has[A-Z]/:      () => true,           // hasData → true
    /^on[A-Z]/:       () => () => {},       // onClick → function
    /count$/i:        () => 5,              // itemCount → 5
    /items?$/i:       () => [{id: 1}, {id: 2}], // items → array
    /^(width|height)$/i: () => 100,         // width → 100
    /^(title|name|label)$/i: () => 'Sample Text',
  };
  
  for (const [pattern, resolver] of Object.entries(namingPatterns)) {
    if (new RegExp(pattern).test(expr)) {
      return resolver();
    }
  }
  return undefined;
}
```

### 3.3 Mock 数据生成

```typescript
// 基于 Props 类型自动生成 Mock 数据
interface MockDataGenerator {
  generateFromPropsType(propsType: TypeInfo): MockData;
}

// 示例
interface CardProps {
  title: string;
  count: number;
  items: Array<{ id: string; name: string }>;
  visible?: boolean;
}

// 自动生成
const mockData = {
  title: 'Sample Title',
  count: 10,
  items: [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
  ],
  visible: true,
};
```

---

## 4. 组件识别与渲染

### 4.1 组件类型

| 类型 | 示例 | 识别方式 | 渲染策略 |
|------|------|---------|---------|
| HTML 元素 | `<div>`, `<span>` | 小写开头 | 直接渲染 |
| 自定义组件 | `<MyButton>` | 大写开头 | 查询注册表 |
| 第三方组件 | `<antd.Button>` | 成员表达式 | 查询注册表 |
| 动态组件 | `<Component>` | 变量引用 | 运行时解析/占位 |

### 4.2 组件注册表

```typescript
interface ComponentRegistry {
  // 注册组件
  register(name: string, config: ComponentConfig): void;
  
  // 获取组件配置
  get(name: string): ComponentConfig | undefined;
  
  // 检查是否已注册
  has(name: string): boolean;
  
  // 批量从 import 声明注册
  registerFromImports(imports: ImportDeclaration[]): void;
}

interface ComponentConfig {
  // 组件标识
  name: string;
  
  // 来源信息
  source: {
    type: 'html' | 'local' | 'npm' | 'unknown';
    package?: string;      // npm 包名
    path?: string;         // 本地路径
    exportName?: string;   // 导出名称
  };
  
  // 可视化配置
  visual: {
    // 在画布上的渲染器
    canvasRenderer?: React.ComponentType<any>;
    
    // 缩略图/图标
    icon?: string | React.ReactNode;
    
    // 分类（用于组件面板）
    category?: string;
    
    // 默认尺寸
    defaultSize?: { width: number; height: number };
    
    // 是否容器组件
    isContainer?: boolean;
    
    // 接受的子组件类型
    acceptedChildren?: string[];
  };
  
  // Props 配置（用于属性面板）
  propsSchema?: PropSchema[];
  
  // 默认 props
  defaultProps?: Record<string, unknown>;
}
```

### 4.3 未知组件处理

当遇到未注册的组件时：

```typescript
// 策略 1: 占位框渲染
function UnknownComponentRenderer({ schema }: { schema: VisionSchema }) {
  return (
    <div className="unknown-component">
      <div className="unknown-component__header">
        <Icon type="question" />
        <span>{schema.componentName}</span>
      </div>
      <div className="unknown-component__body">
        <p>未识别的组件</p>
        <code>{JSON.stringify(schema.props, null, 2)}</code>
      </div>
      {/* 子组件仍然尝试渲染 */}
      <div className="unknown-component__children">
        {schema.children?.map(child => (
          <SchemaRenderer key={child.id} schema={child} />
        ))}
      </div>
    </div>
  );
}

// 策略 2: 尝试运行时渲染（需要运行时环境）
function RuntimeComponentRenderer({ schema, runtime }: Props) {
  const Component = runtime.resolveComponent(schema.componentName);
  
  if (!Component) {
    return <UnknownComponentRenderer schema={schema} />;
  }
  
  // 实际渲染组件
  return <Component {...schema.props}>{renderChildren(schema.children)}</Component>;
}
```

---

## 5. 完整转换流程

### 5.1 转换管道

```
┌─────────────────────────────────────────────────────────────────┐
│                    TSX → Schema Pipeline                         │
└─────────────────────────────────────────────────────────────────┘

  TSX Source Code
        │
        ▼
┌───────────────────┐
│  1. Parse to AST  │  TypeScript Compiler API
│  (ts.SourceFile)  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  2. Extract Info  │  提取组件元信息
│  - Imports        │  - 依赖分析
│  - Props Type     │  - Props 类型
│  - Hooks          │  - 状态结构
│  - Component Def  │  - 组件定义位置
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  3. Find JSX Root │  定位 return 语句中的 JSX
│  - return (...)   │
│  - Early returns  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  4. Transform JSX │  递归转换 JSX → Schema
│  - Elements       │
│  - Conditions     │
│  - Loops          │
│  - Expressions    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  5. Resolve Deps  │  解析依赖和表达式
│  - Component Reg  │
│  - Mock Data      │
│  - Computed Props │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  6. Layout Calc   │  计算布局信息
│  - Frame calc     │  (集成 flex-parser)
│  - Auto layout    │
└─────────┬─────────┘
          │
          ▼
    VisionSchema
```

### 5.2 核心转换代码

```typescript
import * as ts from 'typescript';

interface TransformContext {
  sourceFile: ts.SourceFile;
  componentRegistry: ComponentRegistry;
  mockDataProvider: MockDataProvider;
  idGenerator: () => string;
}

/**
 * 将 TSX 源码转换为 VisionSchema
 */
export function transformTSXToSchema(
  source: string,
  options: TransformOptions = {}
): TransformResult {
  // 1. 解析为 AST
  const sourceFile = ts.createSourceFile(
    'component.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  
  // 2. 提取组件信息
  const componentInfo = extractComponentInfo(sourceFile);
  
  // 3. 创建转换上下文
  const context: TransformContext = {
    sourceFile,
    componentRegistry: options.registry ?? createDefaultRegistry(),
    mockDataProvider: options.mockData ?? createMockDataProvider(componentInfo.propsType),
    idGenerator: createIdGenerator(),
  };
  
  // 4. 找到 JSX 根节点并转换
  const jsxRoot = findJSXRoot(sourceFile);
  const schema = transformJSXNode(jsxRoot, context);
  
  return {
    schema,
    componentInfo,
    sourceMap: createSourceMap(sourceFile),
  };
}

/**
 * 递归转换 JSX 节点
 */
function transformJSXNode(
  node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment | ts.JsxExpression,
  context: TransformContext
): VisionSchema {
  
  // Fragment
  if (ts.isJsxFragment(node)) {
    return transformFragment(node, context);
  }
  
  // 表达式（条件、循环等）
  if (ts.isJsxExpression(node)) {
    return transformExpression(node, context);
  }
  
  // 普通元素
  const tagName = getTagName(node);
  const props = transformProps(getAttributes(node), context);
  const children = transformChildren(getChildren(node), context);
  
  return {
    componentName: tagName,
    id: context.idGenerator(),
    props,
    children: children.length > 0 ? children : undefined,
    sourceMapping: getSourceMapping(node, context.sourceFile),
    visual: inferVisualConfig(tagName, props, context.componentRegistry),
  };
}

/**
 * 转换 JSX 表达式
 */
function transformExpression(
  node: ts.JsxExpression,
  context: TransformContext
): VisionSchema {
  const expr = node.expression;
  if (!expr) return createTextSchema('');
  
  // 三元表达式 → 条件节点
  if (ts.isConditionalExpression(expr)) {
    return {
      componentName: '$Ternary',
      id: context.idGenerator(),
      condition: {
        type: 'ternary',
        expression: expr.condition.getText(context.sourceFile),
        expressionAST: serializeAST(expr.condition),
      },
      branches: {
        consequent: transformJSXOrExpression(expr.whenTrue, context),
        alternate: transformJSXOrExpression(expr.whenFalse, context),
      },
      sourceMapping: getSourceMapping(node, context.sourceFile),
    };
  }
  
  // 逻辑与 (&&) → 条件节点
  if (ts.isBinaryExpression(expr) && 
      expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return {
      componentName: '$Conditional',
      id: context.idGenerator(),
      condition: {
        type: 'logical_and',
        expression: expr.left.getText(context.sourceFile),
      },
      children: [transformJSXOrExpression(expr.right, context)],
      sourceMapping: getSourceMapping(node, context.sourceFile),
    };
  }
  
  // .map() → 循环节点
  if (ts.isCallExpression(expr) && isMapCall(expr)) {
    return transformMapExpression(expr, context);
  }
  
  // 其他表达式 → 表达式节点
  return {
    componentName: '$Expression',
    id: context.idGenerator(),
    expression: {
      $expr: expr.getText(context.sourceFile),
      $preview: context.mockDataProvider.evaluate(expr),
      $dependencies: extractDependencies(expr),
    },
    sourceMapping: getSourceMapping(node, context.sourceFile),
  };
}

/**
 * 转换 .map() 调用为循环节点
 */
function transformMapExpression(
  expr: ts.CallExpression,
  context: TransformContext
): VisionSchema {
  const mapTarget = (expr.expression as ts.PropertyAccessExpression).expression;
  const callback = expr.arguments[0];
  
  let itemName = 'item';
  let template: VisionSchema;
  
  if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
    // 获取回调参数名
    const param = callback.parameters[0];
    if (param) {
      itemName = param.name.getText(context.sourceFile);
    }
    
    // 获取回调体（JSX）
    const body = callback.body;
    if (ts.isJsxElement(body) || ts.isJsxSelfClosingElement(body) || ts.isJsxFragment(body)) {
      template = transformJSXNode(body, context);
    } else if (ts.isParenthesizedExpression(body)) {
      template = transformJSXOrExpression(body.expression, context);
    } else {
      template = createPlaceholderSchema('循环体');
    }
  } else {
    template = createPlaceholderSchema('循环体');
  }
  
  return {
    componentName: '$Loop',
    id: context.idGenerator(),
    loop: {
      type: 'map',
      dataSource: mapTarget.getText(context.sourceFile),
      itemName,
      keyExpression: findKeyProp(template),
    },
    template,
    visual: {
      label: `循环: ${mapTarget.getText(context.sourceFile)}`,
      previewCount: 3,
    },
    sourceMapping: getSourceMapping(expr, context.sourceFile),
  };
}
```

---

## 6. 实际组件转换示例

### 6.1 简单组件

**输入 (BooleanSetter.tsx)**:

```tsx
export const BooleanSetter: React.FC<BooleanSetterProps> = ({
  value,
  onChange,
  disabled,
  checkedLabel,
  uncheckedLabel,
}) => {
  const handleChange = useCallback((checked: boolean) => {
    onChange(checked);
  }, [onChange]);

  return (
    <Switch
      checked={!!value}
      onChange={handleChange}
      disabled={disabled}
      checkedChildren={checkedLabel}
      unCheckedChildren={uncheckedLabel}
    />
  );
};
```

**输出 (VisionSchema)**:

```json
{
  "componentName": "Switch",
  "id": "switch_001",
  "props": {
    "checked": { "$expr": "!!value", "$preview": true },
    "onChange": { "$handler": "handleChange" },
    "disabled": { "$expr": "disabled", "$preview": false },
    "checkedChildren": { "$expr": "checkedLabel", "$preview": "开" },
    "unCheckedChildren": { "$expr": "uncheckedLabel", "$preview": "关" }
  },
  "sourceMapping": {
    "location": { "start": { "line": 10, "column": 4 }, "end": { "line": 16, "column": 6 } },
    "originalCode": "<Switch..."
  },
  "componentInfo": {
    "name": "BooleanSetter",
    "propsType": "BooleanSetterProps",
    "hooks": ["useCallback"],
    "handlers": [{ "name": "handleChange", "line": 8 }]
  }
}
```

### 6.2 复杂组件（带条件和循环）

**输入 (部分 FlowRender.tsx)**:

```tsx
return (
  <div className={`flow-render ${className || ''}`}>
    <div className="flow-render__container">
      {/* Root event node */}
      <div className="flow-render__root">
        {renderFlowNode(schema as unknown as FlowNodeType, 0)}
      </div>

      {/* Root actions */}
      {schema.actions && (
        <div className="flow-render__root-actions">
          {renderActions(schema.actions, schema.id, 1)}
        </div>
      )}

      {/* Add button for root */}
      {showAddButtons && !isReadOnly && (!schema.actions || schema.actions.length === 0) && (
        <div className="flow-render__add-wrapper flow-render__add-wrapper--root">
          <AddNode
            parentId={schema.id}
            size="default"
            iconOnly={false}
            tooltip="添加第一个节点"
          />
        </div>
      )}
    </div>
  </div>
);
```

**输出 (VisionSchema)**:

```json
{
  "componentName": "div",
  "id": "div_001",
  "props": {
    "className": {
      "$expr": "`flow-render ${className || ''}`",
      "$preview": "flow-render"
    }
  },
  "children": [
    {
      "componentName": "div",
      "id": "div_002",
      "props": { "className": "flow-render__container" },
      "children": [
        {
          "componentName": "div",
          "id": "div_003",
          "props": { "className": "flow-render__root" },
          "children": [
            {
              "componentName": "$Expression",
              "id": "expr_001",
              "expression": {
                "$expr": "renderFlowNode(schema as unknown as FlowNodeType, 0)",
                "$type": "function_call",
                "$preview": "<<FlowNode>>"
              },
              "visual": {
                "label": "renderFlowNode(...)",
                "expandable": false
              }
            }
          ]
        },
        {
          "componentName": "$Conditional",
          "id": "cond_001",
          "condition": {
            "type": "logical_and",
            "expression": "schema.actions"
          },
          "children": [
            {
              "componentName": "div",
              "id": "div_004",
              "props": { "className": "flow-render__root-actions" },
              "children": [
                {
                  "componentName": "$Expression",
                  "id": "expr_002",
                  "expression": {
                    "$expr": "renderActions(schema.actions, schema.id, 1)",
                    "$type": "function_call"
                  }
                }
              ]
            }
          ],
          "visual": {
            "label": "条件: schema.actions",
            "conditionBadge": "&&"
          }
        },
        {
          "componentName": "$Conditional",
          "id": "cond_002",
          "condition": {
            "type": "logical_and",
            "expression": "showAddButtons && !isReadOnly && (!schema.actions || schema.actions.length === 0)"
          },
          "children": [
            {
              "componentName": "div",
              "id": "div_005",
              "props": {
                "className": "flow-render__add-wrapper flow-render__add-wrapper--root"
              },
              "children": [
                {
                  "componentName": "AddNode",
                  "id": "addnode_001",
                  "props": {
                    "parentId": { "$expr": "schema.id" },
                    "size": "default",
                    "iconOnly": false,
                    "tooltip": "添加第一个节点"
                  }
                }
              ]
            }
          ],
          "visual": {
            "label": "条件: showAddButtons && ...",
            "conditionBadge": "&&"
          }
        }
      ]
    }
  ]
}
```

---

## 7. 可视化渲染策略

### 7.1 不同 Schema 类型的渲染

```tsx
// Schema 渲染器
function SchemaRenderer({ schema, context }: Props) {
  switch (schema.componentName) {
    case '$Conditional':
      return <ConditionalRenderer schema={schema} context={context} />;
    
    case '$Ternary':
      return <TernaryRenderer schema={schema} context={context} />;
    
    case '$Loop':
      return <LoopRenderer schema={schema} context={context} />;
    
    case '$Expression':
      return <ExpressionRenderer schema={schema} context={context} />;
    
    case '$Fragment':
      return <FragmentRenderer schema={schema} context={context} />;
    
    default:
      return <ComponentRenderer schema={schema} context={context} />;
  }
}

// 条件渲染器 - 显示条件徽标
function ConditionalRenderer({ schema, context }: Props) {
  return (
    <div className="vision-conditional">
      <div className="vision-conditional__badge">
        <span className="condition-icon">?</span>
        <span className="condition-expr">{schema.condition.expression}</span>
      </div>
      <div className="vision-conditional__content">
        {schema.children?.map(child => (
          <SchemaRenderer key={child.id} schema={child} context={context} />
        ))}
      </div>
    </div>
  );
}

// 循环渲染器 - 显示多个预览实例
function LoopRenderer({ schema, context }: Props) {
  const previewCount = schema.visual?.previewCount ?? 2;
  const mockItems = context.mockData.generateArray(schema.loop.dataSource, previewCount);
  
  return (
    <div className="vision-loop">
      <div className="vision-loop__badge">
        <span className="loop-icon">↻</span>
        <span className="loop-label">{schema.loop.dataSource}.map()</span>
      </div>
      <div className="vision-loop__items">
        {mockItems.map((item, index) => (
          <div key={index} className="vision-loop__item">
            {index === 0 && <span className="item-label">模板</span>}
            {index > 0 && <span className="item-label">预览 {index}</span>}
            <SchemaRenderer 
              schema={schema.template} 
              context={{ ...context, loopItem: { [schema.loop.itemName]: item } }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 7.2 可视化效果示意

```
┌──────────────────────────────────────────────────────────┐
│  FlowRender Component                                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ div.flow-render                                    │  │
│  │                                                    │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ div.flow-render__container                   │  │  │
│  │  │                                              │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │ div.flow-render__root                  │  │  │  │
│  │  │  │  ┌─────────────────────────────────┐  │  │  │  │
│  │  │  │  │ ƒ renderFlowNode(...)           │  │  │  │  │
│  │  │  │  └─────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  │                                              │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │ ? schema.actions                       │  │  │  │
│  │  │  │  ┌─────────────────────────────────┐  │  │  │  │
│  │  │  │  │ div.flow-render__root-actions   │  │  │  │  │
│  │  │  │  │  ƒ renderActions(...)           │  │  │  │  │
│  │  │  │  └─────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  │                                              │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │ ? showAddButtons && !isReadOnly && ..  │  │  │  │
│  │  │  │  ┌─────────────────────────────────┐  │  │  │  │
│  │  │  │  │ AddNode                         │  │  │  │  │
│  │  │  │  │ size="default" tooltip="..."    │  │  │  │  │
│  │  │  │  └─────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  │                                              │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘

图例：
  ┌───┐ - 普通元素
  ? xxx - 条件渲染
  ↻ xxx - 循环渲染
  ƒ xxx - 函数调用
```

---

## 8. 关键技术决策

### 8.1 虚拟节点策略

对于条件、循环等非直接元素，引入虚拟节点（`$` 前缀）：

| 虚拟节点 | 用途 | 可视化表现 |
|---------|------|-----------|
| `$Conditional` | 逻辑与条件 | 条件徽标 + 内容 |
| `$Ternary` | 三元条件 | 分支视图 |
| `$Loop` | 循环渲染 | 循环模板 + 预览 |
| `$Expression` | 动态表达式 | 表达式框 |
| `$Fragment` | Fragment | 虚线组框 |

### 8.2 表达式保留策略

```typescript
// 表达式值结构
interface ExpressionValue {
  $expr: string;           // 原始表达式
  $preview?: unknown;      // 预览值
  $type?: 'literal' | 'identifier' | 'member' | 'call' | 'template' | 'complex';
  $dependencies?: string[]; // 依赖的变量
  $editable?: boolean;     // 是否可在可视化中编辑
}
```

### 8.3 源码映射保留

每个节点都保留源码位置，用于：
- 双向跳转（可视化 ↔ 代码）
- 增量代码更新
- 错误定位

```typescript
interface SourceMapping {
  source: string;            // 源文件路径
  location: SourceLocation;  // 位置信息
  originalCode: string;      // 原始代码片段
}
```

---

## 9. 总结

### 9.1 转换准确性保证

| 保证项 | 实现方式 |
|--------|---------|
| 结构完整性 | 1:1 映射 JSX 树结构 |
| 位置准确性 | 保留 AST 位置信息 |
| 语义完整性 | 虚拟节点表达条件/循环 |
| 表达式保留 | $expr 字段保存原始表达式 |
| 可逆转换 | sourceMapping 支持代码回写 |

### 9.2 已知限制

| 限制 | 影响 | 缓解方案 |
|------|------|---------|
| 复杂表达式 | 预览值可能不准确 | Mock 数据 + 类型推断 |
| 动态组件 | 无法静态确定渲染结果 | 运行时渲染/占位 |
| 内部函数渲染 | `renderXxx()` 无法展开 | 标记为函数调用节点 |
| CSS 类名样式 | 无法获取具体样式 | CSS 解析 / Tailwind 支持 |

### 9.3 推荐实现顺序

1. **基础 JSX 元素转换** (Week 1)
2. **条件渲染支持** (Week 2)
3. **循环渲染支持** (Week 2-3)
4. **表达式处理** (Week 3)
5. **组件注册表** (Week 4)
6. **源码映射** (Week 4-5)
