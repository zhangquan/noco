# Code2Vision 可行性研究报告

> TSX 代码可视化展示与操作方案

## 1. 项目背景与目标

### 1.1 背景

现代前端开发中，React/TSX 已经成为主流的 UI 开发方式。然而，代码与视觉效果之间的转换仍然存在较大的认知鸿沟：

- **设计师**：使用 Figma/Sketch 等可视化工具设计 UI，无法直接理解或修改代码
- **开发者**：需要在代码和浏览器之间频繁切换，理解布局关系
- **低代码平台**：需要在可视化编辑和代码生成之间建立双向映射

### 1.2 项目目标

**Code2Vision** 的核心目标是建立 TSX 代码与可视化界面之间的双向转换能力：

```
┌─────────────┐                      ┌─────────────┐
│   TSX Code  │  ←── Code2Vision ──→ │   Vision    │
│  (Source)   │                      │  (Visual)   │
└─────────────┘                      └─────────────┘
      ↓                                    ↓
   编辑代码            ⟺             可视化操作
```

**具体目标：**

| 目标 | 描述 | 优先级 |
|------|------|--------|
| TSX → Schema | 解析 TSX 代码转换为中间 Schema | P0 |
| Schema → Visual | 将 Schema 渲染为可视化组件树 | P0 |
| Visual → Schema | 可视化操作同步更新 Schema | P1 |
| Schema → TSX | 将 Schema 生成回 TSX 代码 | P1 |
| 实时同步 | 代码编辑与可视化界面实时同步 | P2 |

---

## 2. 核心能力分析

### 2.1 能力矩阵

```
                     Code2Vision 核心能力
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌─────▼─────┐        ┌─────▼─────┐
   │  Parse  │         │  Render   │        │  Operate  │
   │  解析层  │         │  渲染层    │        │   操作层   │
   └────┬────┘         └─────┬─────┘        └─────┬─────┘
        │                    │                    │
   ┌────▼────┐         ┌─────▼─────┐        ┌─────▼─────┐
   │TSX→AST→ │         │Schema→    │        │拖拽/缩放/ │
   │Schema   │         │React Tree │        │属性编辑   │
   └─────────┘         └───────────┘        └───────────┘
```

### 2.2 现有资源分析

本 monorepo 中已有的相关能力：

| Package | 可复用能力 | 相关度 |
|---------|-----------|--------|
| `flex-parser` | JSX→Schema 转换、布局计算、Frame 工具 | ⭐⭐⭐⭐⭐ |
| `flow-designer` | React 组件树渲染、拖拽交互、状态管理 | ⭐⭐⭐⭐ |
| `flow-runtime` | 执行引擎模式（可借鉴） | ⭐⭐ |

### 2.3 技术可行性评估

#### ✅ 已验证的技术

| 技术 | 验证状态 | 说明 |
|------|---------|------|
| TSX 解析 (TypeScript Compiler API) | ✅ 成熟 | 官方支持，社区成熟 |
| JSX → Schema | ✅ 已实现 | `flex-parser` 中的 `jsx2Schema` |
| Schema → Flex Layout | ✅ 已实现 | `flex-parser` 的核心能力 |
| React 组件渲染 | ✅ 成熟 | React 官方支持 |
| 拖拽交互 | ✅ 成熟 | react-dnd / @dnd-kit |

#### ⚠️ 需要解决的技术挑战

| 挑战 | 复杂度 | 解决方案 |
|------|--------|---------|
| TSX 源码级别解析 | 中 | TypeScript Compiler API + Babel |
| 代码位置映射 (Source Map) | 高 | 保留 AST 位置信息 |
| 复杂组件支持 | 高 | 组件注册表 + 渲染适配器 |
| 实时同步 | 高 | 增量更新 + 差异算法 |
| 代码生成保留格式 | 中 | Prettier + Magic String |

---

## 3. 技术架构设计

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        Code2Vision Architecture                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐                    ┌─────────────────┐      │
│  │   Code Editor   │◄───── Sync ───────►│  Visual Canvas  │      │
│  │   (Monaco/CM)   │                    │    (React)      │      │
│  └────────┬────────┘                    └────────┬────────┘      │
│           │                                      │                │
│           ▼                                      ▼                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    Core Engine                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │    │
│  │  │  Parser  │  │  Schema  │  │ Renderer │  │Generator │  │    │
│  │  │          │  │  Store   │  │          │  │          │  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
│           │                                      │                │
│           ▼                                      ▼                │
│  ┌─────────────────┐                    ┌─────────────────┐      │
│  │  Component      │                    │   Interaction   │      │
│  │  Registry       │                    │   Layer         │      │
│  └─────────────────┘                    └─────────────────┘      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 核心模块设计

#### 3.2.1 Parser 模块（解析层）

```typescript
// 核心接口定义
interface Parser {
  // TSX 源码 → AST
  parseSource(source: string): TSXNode;
  
  // AST → VisionSchema (中间表示)
  toSchema(ast: TSXNode): VisionSchema;
  
  // 获取源码位置映射
  getSourceMap(): SourceMap;
}

interface TSXNode {
  type: 'Element' | 'Fragment' | 'Expression' | 'Text';
  tagName: string;
  props: Record<string, PropValue>;
  children: TSXNode[];
  location: SourceLocation;  // 关键：保留源码位置
}

interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}
```

#### 3.2.2 VisionSchema（中间表示层）

```typescript
// 扩展自 flex-parser 的 NodeSchema
interface VisionSchema extends NodeSchema {
  // 基础信息
  id: string;
  componentName: string;
  
  // 布局信息（来自 flex-parser）
  frame?: Frame;
  layoutType?: 'row' | 'column' | 'mix';
  'x-layout'?: XLayout;
  
  // 可视化扩展
  visual?: {
    visible: boolean;
    locked: boolean;
    collapsed: boolean;
    label?: string;
  };
  
  // 源码映射（关键！）
  sourceMapping?: {
    source: string;           // 源文件路径
    location: SourceLocation;  // 在源码中的位置
    originalCode: string;      // 原始代码片段
  };
  
  // 组件属性
  props?: Record<string, unknown>;
  children?: VisionSchema[];
}
```

#### 3.2.3 Renderer 模块（渲染层）

```typescript
interface Renderer {
  // 将 Schema 渲染为 React 组件树
  render(schema: VisionSchema): React.ReactNode;
  
  // 更新特定节点
  updateNode(id: string, updates: Partial<VisionSchema>): void;
  
  // 获取节点的 DOM 边界
  getBounds(id: string): DOMRect | null;
}

// 组件注册表 - 支持自定义组件渲染
interface ComponentRegistry {
  register(name: string, config: ComponentConfig): void;
  get(name: string): ComponentConfig | undefined;
  
  // 渲染适配器
  getRenderer(name: string): ComponentRenderer;
}

interface ComponentConfig {
  // 组件元数据
  name: string;
  displayName: string;
  category: 'basic' | 'layout' | 'form' | 'custom';
  
  // 渲染配置
  renderer: ComponentRenderer;
  
  // 属性配置（用于属性面板）
  propSchema: PropSchema[];
  
  // 默认样式
  defaultStyle?: StyleProps;
}
```

#### 3.2.4 Generator 模块（代码生成层）

```typescript
interface Generator {
  // Schema → TSX 代码
  toCode(schema: VisionSchema): string;
  
  // 增量更新源码
  patchSource(
    source: string, 
    changes: SchemaChange[]
  ): string;
}

interface SchemaChange {
  type: 'update' | 'add' | 'remove' | 'move';
  nodeId: string;
  path?: string[];           // 属性路径
  value?: unknown;           // 新值
  sourceLocation?: SourceLocation;
}
```

### 3.3 数据流设计

```
┌─────────────────────────────────────────────────────────────┐
│                        Data Flow                             │
└─────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   TSX Source     │
                    │   (.tsx file)    │
                    └────────┬─────────┘
                             │
              ┌──────────────▼──────────────┐
              │         Parser              │
              │  TypeScript Compiler API    │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │      TSX AST + SourceMap    │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │       Schema Converter      │
              │   (扩展 flex-parser)         │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │       VisionSchema          │
              │    (Central Data Model)     │
              └──────────────┬──────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Visual Canvas  │ │ Component Tree │ │ Property Panel │
│   Renderer     │ │    Renderer    │ │    Renderer    │
└────────────────┘ └────────────────┘ └────────────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │      User Interaction       │
              │  (Drag, Resize, Edit Props) │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │      Schema Updates         │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │      Code Generator         │
              │   (Incremental Patch)       │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Updated TSX Source        │
              └─────────────────────────────┘
```

---

## 4. 实现方案

### 4.1 Phase 1: 基础解析能力（TSX → Schema）

**目标**：实现 TSX 代码到 VisionSchema 的转换

**技术选型**：
- TypeScript Compiler API（`ts.createSourceFile`）
- 扩展 `flex-parser` 的 Schema 格式

**实现步骤**：

```typescript
// 1. TSX 解析
const sourceFile = ts.createSourceFile(
  'component.tsx',
  sourceCode,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

// 2. AST 遍历 + 转换
function visitNode(node: ts.Node): VisionSchema | null {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    return {
      componentName: getTagName(node),
      props: extractProps(node),
      children: getChildren(node).map(visitNode).filter(Boolean),
      sourceMapping: {
        location: getNodeLocation(node, sourceFile),
        originalCode: node.getText(sourceFile),
      },
    };
  }
  return null;
}
```

**输出**：
- `@workspace/code2vision/src/parser/` - TSX 解析模块
- `@workspace/code2vision/src/schema/` - VisionSchema 定义

### 4.2 Phase 2: 可视化渲染（Schema → Visual）

**目标**：将 VisionSchema 渲染为可视化组件树

**技术选型**：
- React + Canvas/SVG（用于渲染框线和辅助）
- CSS 变量（用于主题和高亮）
- Zustand（状态管理）

**实现步骤**：

```tsx
// VisionCanvas 组件
function VisionCanvas({ schema }: { schema: VisionSchema }) {
  return (
    <div className="vision-canvas">
      <SchemaRenderer 
        schema={schema} 
        registry={componentRegistry}
        onSelect={handleSelect}
        onHover={handleHover}
      />
      <SelectionOverlay selectedIds={selectedIds} />
      <GuideLines />
    </div>
  );
}

// Schema 渲染器
function SchemaRenderer({ schema, registry }) {
  const Component = registry.getRenderer(schema.componentName);
  
  return (
    <VisionNode 
      id={schema.id}
      frame={schema.frame}
      sourceMapping={schema.sourceMapping}
    >
      <Component {...schema.props}>
        {schema.children?.map(child => (
          <SchemaRenderer key={child.id} schema={child} registry={registry} />
        ))}
      </Component>
    </VisionNode>
  );
}
```

**输出**：
- `@workspace/code2vision/src/canvas/` - 可视化画布
- `@workspace/code2vision/src/components/` - 内置组件渲染器

### 4.3 Phase 3: 交互操作（Visual → Schema）

**目标**：支持可视化拖拽、缩放、属性编辑

**技术选型**：
- @dnd-kit/core（拖拽）
- React Hook Form（属性编辑）
- Immer（不可变更新）

**核心交互**：

| 交互 | 描述 | 实现方式 |
|------|------|---------|
| 选择 | 点击选中组件 | Click Event → Schema ID |
| 移动 | 拖拽组件位置 | DnD → Update frame |
| 缩放 | 拖拽边框调整大小 | Resize Handles → Update frame |
| 编辑属性 | 属性面板修改 | Form → Update props |
| 层级操作 | 调整组件层级 | Tree DnD → Update children |

```typescript
// 状态管理示例
interface VisionState {
  schema: VisionSchema;
  selectedIds: Set<string>;
  hoveredId: string | null;
  
  // Actions
  updateNode: (id: string, updates: Partial<VisionSchema>) => void;
  moveNode: (id: string, newParentId: string, index: number) => void;
  deleteNode: (id: string) => void;
}
```

**输出**：
- `@workspace/code2vision/src/interactions/` - 交互层
- `@workspace/code2vision/src/panels/` - 属性面板

### 4.4 Phase 4: 代码生成（Schema → TSX）

**目标**：将修改后的 Schema 同步回 TSX 代码

**技术选型**：
- magic-string（增量代码修改）
- Prettier（代码格式化）
- diff-match-patch（差异对比）

**实现策略**：

```typescript
// 增量更新策略
class CodeGenerator {
  private magicString: MagicString;
  
  constructor(source: string) {
    this.magicString = new MagicString(source);
  }
  
  // 应用单个变更
  applyChange(change: SchemaChange): void {
    const { sourceLocation, value } = change;
    
    if (change.type === 'update' && sourceLocation) {
      // 直接替换源码位置
      this.magicString.overwrite(
        sourceLocation.start.offset,
        sourceLocation.end.offset,
        generatePropCode(change.path!, value)
      );
    }
  }
  
  // 生成最终代码
  generate(): string {
    return prettier.format(this.magicString.toString(), {
      parser: 'typescript',
    });
  }
}
```

**输出**：
- `@workspace/code2vision/src/generator/` - 代码生成器

---

## 5. 技术风险与挑战

### 5.1 风险评估矩阵

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| TSX 语法多样性 | 高 | 高 | 聚焦常用模式，渐进支持 |
| 性能问题（大型组件树） | 中 | 中 | 虚拟化渲染、增量更新 |
| 源码映射丢失 | 中 | 高 | 严格保留位置信息 |
| 用户组件支持 | 高 | 中 | 组件注册表 + 占位渲染 |
| 代码格式破坏 | 中 | 中 | Prettier + 增量修改 |

### 5.2 技术挑战详解

#### 挑战 1: TSX 动态表达式

```tsx
// 这类动态表达式难以静态可视化
<div className={isActive ? 'active' : 'inactive'}>
  {items.map(item => <Item key={item.id} {...item} />)}
</div>
```

**解决方案**：
1. 表达式求值：在静态分析时提供默认值
2. 表达式标记：在可视化中标记"动态"区域
3. 渐进增强：先支持静态部分，后续增加动态预览

#### 挑战 2: 组件边界识别

```tsx
// 自定义组件的渲染逻辑无法静态分析
<CustomButton variant="primary">Click me</CustomButton>
```

**解决方案**：
1. **组件注册表**：预注册组件的可视化配置
2. **Fallback 渲染**：未知组件使用占位框
3. **运行时探测**：可选的运行时组件边界探测

#### 挑战 3: CSS 样式计算

```tsx
// 样式可能来自多个来源
<div className="container mx-auto" style={{ padding: 16 }}>
```

**解决方案**：
1. **内联样式优先**：优先解析 style 属性
2. **CSS 模块解析**：静态分析 CSS 文件
3. **Tailwind 支持**：内置 Tailwind 类名到样式的映射

---

## 6. 与现有系统的集成

### 6.1 与 flex-parser 的集成

```
┌─────────────────────────────────────────────────────────┐
│                   Integration Flow                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  code2vision                         flex-parser         │
│  ┌──────────────┐                   ┌──────────────┐    │
│  │ TSX Parser   │──── VisionSchema ──►│ layoutParser │    │
│  └──────────────┘     (extends       └──────────────┘    │
│                        NodeSchema)          │            │
│                                             ▼            │
│  ┌──────────────┐                   ┌──────────────┐    │
│  │ Code         │◄── FlexSchema ────│ Flex Layout  │    │
│  │ Generator    │                   │ Calculator   │    │
│  └──────────────┘                   └──────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**复用 flex-parser 的能力**：
- `NodeSchema` 类型定义
- `layoutParser` 布局计算
- Frame 工具函数
- 树操作工具函数

### 6.2 与 flow-designer 的集成

**可复用的能力**：
- 组件渲染架构 (`components/nodes/`)
- 状态管理模式 (`states/`)
- Setter 组件 (`setter/`)

---

## 7. 里程碑规划

### Milestone 1: 核心解析（2-3 周）

- [ ] TSX 解析器实现
- [ ] VisionSchema 定义
- [ ] 基础测试用例

**交付物**：能够解析简单 TSX 并输出 VisionSchema

### Milestone 2: 可视化渲染（2-3 周）

- [ ] Canvas 组件实现
- [ ] 基础组件渲染器
- [ ] 选中/高亮交互

**交付物**：能够将 VisionSchema 渲染为可视化组件树

### Milestone 3: 交互能力（3-4 周）

- [ ] 拖拽移动
- [ ] 缩放调整
- [ ] 属性面板

**交付物**：能够可视化操作组件

### Milestone 4: 代码同步（2-3 周）

- [ ] 代码生成器
- [ ] 增量更新
- [ ] 双向同步

**交付物**：可视化操作能同步回代码

### Milestone 5: 完善与优化（2-3 周）

- [ ] 性能优化
- [ ] 更多组件支持
- [ ] 用户体验优化

**交付物**：生产可用的 Code2Vision

---

## 8. 资源需求

### 8.1 技术依赖

```json
{
  "dependencies": {
    "typescript": "^5.0.0",
    "@workspace/flex-parser": "workspace:*",
    "react": "^18.0.0",
    "@dnd-kit/core": "^6.0.0",
    "zustand": "^4.0.0",
    "magic-string": "^0.30.0",
    "prettier": "^3.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/react": "^18.0.0"
  }
}
```

### 8.2 开发工作量估算

| 模块 | 人天 | 说明 |
|------|------|------|
| Parser | 8-10 | TSX 解析 + Schema 转换 |
| Renderer | 10-12 | Canvas + 组件渲染 |
| Interactions | 12-15 | 拖拽、缩放、编辑 |
| Generator | 8-10 | 代码生成 + 增量更新 |
| Integration | 5-7 | 系统集成 + 测试 |
| **总计** | **43-54** | 约 2-3 个月 |

---

## 9. 结论与建议

### 9.1 可行性结论

**技术可行性：✅ 高**
- 核心技术栈成熟（TypeScript API、React）
- 已有 flex-parser 提供基础能力
- 社区有类似实践（如 React DevTools、Storybook）

**资源可行性：✅ 中**
- 预计需要 2-3 个月开发周期
- 需要前端开发经验丰富的工程师

**风险可控性：✅ 中**
- 主要风险在于 TSX 语法多样性
- 可通过渐进式支持降低风险

### 9.2 建议

1. **分阶段实施**：先实现核心解析和渲染，后续迭代增加交互能力
2. **聚焦常用模式**：优先支持 80% 的常见 TSX 写法
3. **充分复用现有能力**：最大化利用 flex-parser 和 flow-designer
4. **建立测试基准**：收集真实 TSX 样本作为测试基准

### 9.3 下一步行动

1. [ ] 确认项目启动
2. [ ] 创建 `@workspace/code2vision` 包
3. [ ] 实现 TSX Parser POC
4. [ ] 验证与 flex-parser 的集成

---

## 附录

### A. 参考项目

| 项目 | 相关度 | 参考点 |
|------|--------|--------|
| [React DevTools](https://github.com/facebook/react/tree/main/packages/react-devtools) | 高 | 组件树可视化 |
| [Storybook](https://storybook.js.org/) | 中 | 组件预览 |
| [Plasmic](https://www.plasmic.app/) | 高 | 代码⟷设计双向同步 |
| [Builder.io](https://www.builder.io/) | 高 | 可视化编辑器 |
| [Framer](https://www.framer.com/) | 高 | 代码组件 + 可视化 |

### B. 技术规范参考

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [JSX Specification](https://facebook.github.io/jsx/)
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
