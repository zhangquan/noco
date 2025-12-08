# @workspace/flow

> FlowSDK - React-based workflow/logic flow editor framework

版本: 1.0.0

## 概述

FlowSDK 是一个基于 React 的**工作流/逻辑流编辑器框架**，用于可视化地设计数据驱动的业务逻辑流程。

## 特性

- 🎨 **可视化编辑** - 拖拽式节点编辑器
- 📦 **丰富的节点类型** - 事件触发、数据操作、条件判断等
- 🔧 **属性设置器** - 可扩展的节点属性配置面板
- 🌍 **国际化** - 支持多语言 (中文、英文等)
- 📝 **历史记录** - 支持撤销/重做
- 🎯 **TypeScript** - 完整的类型支持

## 安装

```bash
pnpm add @workspace/flow
```

## 快速开始

```tsx
import React from 'react';
import { FlowDesigner, createFlowSchema } from '@workspace/flow';
import '@workspace/flow/styles';

function App() {
  // 创建初始 schema
  const initialSchema = createFlowSchema({
    title: '我的流程',
    eventType: 'insert',
    tableId: 'tbl_orders',
  });

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

| 类型 | 说明 | 用途 |
|------|------|------|
| `event` | 事件触发 | 流程入口，定义触发条件 |
| `dataList` | 查询数据 | 从数据表查询记录 |
| `dataInsert` | 插入数据 | 向数据表插入记录 |
| `dataUpdate` | 更新数据 | 更新数据表记录 |
| `dataDelete` | 删除数据 | 删除数据表记录 |
| `if` | 条件判断 | 根据条件执行不同分支 |
| `condition` | 条件分支 | IF 节点的子分支 |
| `loop` | 循环 | 循环执行操作 |
| `var` | 变量 | 设置变量值 |
| `http` | HTTP 请求 | 发送 HTTP 请求 |
| `delay` | 延时 | 等待一段时间 |
| `end` | 结束 | 结束流程执行 |

## API

### FlowDesigner

主设计器组件。

```tsx
interface FlowDesignerProps {
  initialSchema?: FlowSchemaType | null;
  flow?: FlowType;
  tables?: Array<{ id: string; title: string }>;
  config?: DesignerConfig;
  onSave?: (schema: FlowSchemaType) => Promise<void>;
  onPublish?: (schema: FlowSchemaType) => Promise<void>;
  onChange?: (schema: FlowSchemaType) => void;
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
  selectedNodeId,
  isDirty,
  setSchema,
  addNode,
  updateNode,
  deleteNode,
  selectNode,
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
} = useFlows({
  baseUrl: 'http://localhost:8080',
  projectId: 'proj_123',
  token: 'your-token',
});
```

### 逻辑模型函数

```tsx
import {
  createFlowSchema,
  createFlowNode,
  addNode,
  updateNode,
  removeNode,
  moveNode,
  duplicateNode,
  validateSchema,
} from '@workspace/flow';

// 创建 schema
const schema = createFlowSchema({ title: '新流程' });

// 创建节点
const node = createFlowNode('dataList', { title: '查询数据' });

// 添加节点
const newSchema = addNode(schema, schema.id, node);
```

## 自定义节点

```tsx
import { registerNode, BaseNode } from '@workspace/flow';

// 自定义节点组件
const CustomNode = ({ node, selected }) => (
  <BaseNode
    node={node}
    selected={selected}
    color="purple"
    icon={<CustomIcon />}
    typeLabel="自定义"
  >
    {/* 节点内容 */}
  </BaseNode>
);

// 注册节点
registerNode({
  type: 'custom' as any,
  name: '自定义节点',
  component: CustomNode,
  category: 'advanced',
});
```

## 目录结构

```
src/
├── index.ts              # 主入口
├── designer.tsx          # 设计器组件
├── types.ts              # 类型定义
├── index.css             # 全局样式
├── components/           # 节点组件
│   ├── nodes/            # 各类节点
│   └── plusNodes/        # 添加节点按钮
├── model/                # 数据模型
│   ├── logic-model.ts    # 核心逻辑
│   ├── register.ts       # 组件注册
│   └── custom-event.ts   # 事件系统
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
