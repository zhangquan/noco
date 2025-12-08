# @workspace/flow-ui

> FlowSDK UI - React-based workflow/logic flow editor UI components

版本: 1.0.0

## 概述

FlowSDK UI 是一个基于 React 的**工作流可视化编辑器 UI 框架**，提供流程设计器的可视化组件。与 `@workspace/flow-designer` 核心包配合使用。

## 包结构

```
@workspace/flow-designer  - 核心数据模型、图结构管理
@workspace/flow-runtime   - 流程执行引擎
@workspace/flow-ui        - React UI 组件 (本包)
```

## 特性

- 🎨 **可视化编辑** - 拖拽式节点编辑器
- 📦 **丰富的节点组件** - 预置多种节点类型的 UI 组件
- 🔧 **属性设置器** - 可扩展的节点属性配置面板
- 🌍 **国际化** - 支持多语言 (中文、英文等)
- 📝 **历史记录** - 支持撤销/重做
- 🎯 **TypeScript** - 完整的类型支持

## 安装

```bash
pnpm add @workspace/flow-ui @workspace/flow-designer
```

## 快速开始

```tsx
import React from 'react';
import { FlowDesigner } from '@workspace/flow-ui';
import { FlowGraph } from '@workspace/flow-designer';
import '@workspace/flow-ui/styles';

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

## 与 flow-designer 集成

```tsx
import { FlowGraph, Node, Edge, defaultRegistry } from '@workspace/flow-designer';
import { useFlowSchemaStore } from '@workspace/flow-ui';

// 使用 FlowGraph 管理数据
const flow = FlowGraph.create('订单处理流程', 'record');

// 添加节点
const triggerNode = new Node({
  type: 'trigger:record',
  label: '订单创建触发',
  config: { table: 'orders', event: 'create' },
});
flow.addNode(triggerNode);

const httpNode = new Node({
  type: 'action:http',
  label: '通知库存系统',
  config: { url: '/api/inventory/update', method: 'POST' },
});
flow.addNode(httpNode);

// 连接节点
flow.connect(triggerNode.id, 'Output', httpNode.id, 'Input');

// 获取 schema 用于 UI
const schema = flow.toSchema();

// 在 UI 中使用
const { setSchema } = useFlowSchemaStore();
setSchema(schema);
```

## 节点类型

继承自 `@workspace/flow-designer` 的节点类型:

### 触发器 (Triggers)
- `trigger:manual` - 手动触发
- `trigger:schedule` - 定时触发
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

### FlowDesigner

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

### useFlowSchemaStore

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

### useFlows

Flow CRUD 操作 Hook。

```tsx
const {
  flows,
  loading,
  error,
  fetchFlows,
  createFlow,
  updateFlow,
  deleteFlow,
  saveFlowSchema,
  publishFlow,
} from '@workspace/flow-ui';
} = useFlows({
  baseUrl: 'http://localhost:8080',
  projectId: 'proj_123',
  token: 'your-token',
});
```

## 目录结构

```
src/
├── index.ts              # 主入口
├── designer.tsx          # 设计器组件
├── types.ts              # UI 类型定义 (扩展 flow-designer)
├── index.css             # 全局样式
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
│   ├── flowSchemaStore.ts  # 使用 FlowSchema 类型
│   ├── historyStore.ts
│   └── useFlows.ts
└── lang/                 # 国际化
    ├── zh_CN.json
    └── en.json
```

## 相关包

- [@workspace/flow-designer](../flow-designer) - 核心数据模型
- [@workspace/flow-runtime](../flow-runtime) - 执行引擎
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
