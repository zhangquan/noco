# @workspace/flow-designer

> FlowSDK - React-based workflow/logic flow editor framework with core graph engine

版本: 1.0.0

## 概述

FlowSDK Flow Designer 是一个完整的**工作流可视化编辑器框架**，包含：

- 🧠 **核心引擎** - 图数据结构、节点/边管理、序列化/验证
- 🎨 **React UI** - 拖拽式节点编辑器、属性面板、国际化支持
- 📦 **节点注册** - 内置节点类型和自定义节点扩展

## 包结构

```
@workspace/flow-designer  - 核心引擎 + React UI (本包)
@workspace/flow-runtime   - 流程执行引擎
```

## 特性

### 核心引擎
- 📊 **图数据结构** - `FlowGraph`, `Node`, `Edge` 类
- 📝 **节点注册** - `NodeRegistry` 内置节点定义
- ✅ **验证系统** - Zod schema 验证
- 💾 **序列化** - JSON 导入/导出、迁移支持

### React UI
- 🎨 **可视化编辑** - 拖拽式节点编辑器
- 📦 **丰富的节点组件** - 预置多种节点类型的 UI 组件
- 🔧 **属性设置器** - 可扩展的节点属性配置面板
- 🌍 **国际化** - 支持多语言 (中文、英文等)
- 📝 **历史记录** - 支持撤销/重做
- 🎯 **TypeScript** - 完整的类型支持

## 安装

```bash
pnpm add @workspace/flow-designer
```

## 快速开始

### 使用核心 API

```typescript
import { FlowGraph, Node, Edge, NodeRegistry, defaultRegistry } from '@workspace/flow-designer';

// 创建新流程
const flow = FlowGraph.create('我的流程', 'manual');

// 添加触发节点
const triggerNode = new Node({
  type: 'trigger:manual',
  label: '手动触发',
  position: { x: 100, y: 100 },
});
flow.addNode(triggerNode);

// 添加动作节点
const httpNode = new Node({
  type: 'action:http',
  label: 'HTTP 请求',
  position: { x: 100, y: 250 },
  config: {
    method: 'POST',
    url: 'https://api.example.com/webhook',
  },
});
flow.addNode(httpNode);

// 连接节点
flow.connect(
  triggerNode.id, `${triggerNode.id}-output-0`,
  httpNode.id, `${httpNode.id}-input-0`
);

// 验证流程
const validation = flow.validate();
console.log('验证结果:', validation);

// 导出 schema
const schema = flow.toSchema();
console.log(JSON.stringify(schema, null, 2));
```

### 使用 React UI

```tsx
import React from 'react';
import { FlowDesigner, FlowGraph } from '@workspace/flow-designer';
import '@workspace/flow-designer/styles';

function App() {
  // 创建初始 schema
  const flow = FlowGraph.create('我的流程', 'manual');
  const initialSchema = flow.toSchema();

  // 保存处理
  const handleSave = async (schema) => {
    console.log('保存:', schema);
    // 调用 API 保存
  };

  return (
    <FlowDesigner
      initialSchema={initialSchema}
      tables={[
        { id: 'tbl_orders', title: '订单表' },
        { id: 'tbl_products', title: '商品表' },
      ]}
      onSave={handleSave}
      language="zh_CN"
    />
  );
}
```

## 节点类型

### 触发器 (Triggers)
- `trigger:manual` - 手动触发
- `trigger:schedule` - 定时分析任务
- `trigger:webhook` - Webhook 触发
- `trigger:record` - 数据记录事件触发
- `trigger:form` - 表单提交触发

### 逻辑控制 (Logic)
- `logic:condition` - 条件分支
- `logic:switch` - 多路分支
- `logic:loop` - 循环
- `logic:parallel` - 并行执行
- `logic:merge` - 合并

### 动作 (Actions)
- `action:http` - HTTP 请求
- `action:query` - 数据查询
- `action:create` - 创建记录
- `action:update` - 更新记录
- `action:delete` - 删除记录
- `action:script` - 自定义脚本

### 数据转换 (Transform)
- `transform:map` - 数据映射
- `transform:filter` - 数据过滤
- `transform:template` - 模板渲染
- `transform:json` - JSON 处理

### 集成 (Integrations)
- `integration:email` - 发送邮件
- `integration:sms` - 发送短信
- `integration:notification` - 推送通知

### 工具 (Utilities)
- `utility:delay` - 延时
- `utility:log` - 日志
- `utility:comment` - 注释

## API

### 核心类

#### FlowGraph

流程图主类，管理节点和边。

```typescript
// 创建
const flow = FlowGraph.create('流程名称', 'manual');
const flow = FlowGraph.fromSchema(existingSchema);

// 节点操作
flow.addNode(node);
flow.getNode(id);
flow.updateNode(id, data);
flow.removeNode(id);
flow.moveNode(id, x, y);
flow.cloneNode(id);

// 边操作
flow.addEdge(edge);
flow.connect(sourceId, sourcePort, targetId, targetPort);
flow.getEdge(id);
flow.removeEdge(id);
flow.getEdgesForNode(nodeId);

// 分析
flow.validate();
flow.getTopologicalOrder();
flow.isDAG();
flow.getPredecessors(nodeId);
flow.getSuccessors(nodeId);

// 序列化
flow.toSchema();
flow.toJSON();
flow.clone();
```

#### Node

节点类。

```typescript
const node = new Node({
  type: 'action:http',
  label: 'HTTP Request',
  position: { x: 0, y: 0 },
  config: { url: 'https://...' },
});

node.moveTo(x, y);
node.updateConfig({ url: '...' });
node.validate();
node.clone();
```

#### Edge

边类。

```typescript
const edge = Edge.create(sourceId, sourcePort, targetId, targetPort);
const conditionalEdge = Edge.createConditional(sourceId, sourcePort, targetId, targetPort, 'condition');

edge.setCondition('value > 10');
edge.validate();
```

### React 组件

#### FlowDesigner

主设计器组件。

```tsx
interface FlowDesignerProps {
  initialSchema?: FlowSchema | null;
  flow?: FlowType;
  tables?: Array<{ id: string; title: string }>;
  config?: DesignerConfig;
  onSave?: (schema: FlowSchema) => Promise<void>;
  onPublish?: (schema: FlowSchema) => Promise<void>;
  onChange?: (schema: FlowSchema) => void;
  language?: 'zh_CN' | 'en';
  showHeader?: boolean;
  showSetter?: boolean;
}
```

#### useFlowSchemaStore

Flow Schema 状态管理 Hook。

```tsx
const {
  schema,
  selection,
  viewport,
  isDirty,
  setSchema,
  addNode,
  updateNode,
  deleteNode,
  addEdge,
  deleteEdge,
  selectNode,
  clearSelection,
  setZoom,
  setPan,
} = useFlowSchemaStore();
```

### 工具函数

```typescript
import {
  serializeFlow,
  deserializeFlow,
  validateFlow,
  exportFlow,
  importFlow,
} from '@workspace/flow-designer';

// 序列化
const json = serializeFlow(flow, { pretty: true });
const flow = deserializeFlow(json);

// 验证
const result = validateFlow(schema);
```

## 目录结构

```
src/
├── index.ts              # 主入口
├── types.ts              # 类型定义
├── core/                 # 核心引擎
│   ├── Node.ts           # 节点类
│   ├── Edge.ts           # 边类
│   └── FlowGraph.ts      # 图类
├── registry/             # 节点注册
│   └── NodeRegistry.ts   # 节点定义注册
├── utils/                # 工具函数
│   ├── serializer.ts     # 序列化
│   └── validator.ts      # 验证
├── designer.tsx          # 设计器组件
├── components/           # 节点组件
│   ├── nodes/            # 各类节点 UI
│   └── plusNodes/        # 添加节点按钮
├── model/                # UI 数据模型
│   ├── register.ts       # UI 组件注册
│   └── custom-event.ts   # UI 事件系统
├── render/               # 渲染层
│   ├── FlowRender.tsx    # 流程渲染
│   └── component-map-logic.tsx
├── setter/               # 属性设置器
│   ├── index.tsx         # 设置面板
│   └── components/       # 设置器组件
├── states/               # 状态管理
│   ├── flowSchemaStore.ts
│   ├── historyStore.ts
│   └── useFlows.ts
└── lang/                 # 国际化
    ├── zh_CN.json
    └── en.json
```

## 相关包

- [@workspace/flow-runtime](../flow-runtime) - 流程执行引擎
- [@workspace/platform-server](../platform-server) - 后端服务

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm typecheck
```

## License

MIT
