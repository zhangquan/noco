# FlowSDK 设计架构文档

## 概述

FlowSDK 是一个基于 React 的**工作流/逻辑流编辑器框架**，用于可视化地设计数据驱动的业务逻辑流程。本文档聚焦于**设计时 (Design Time)** 架构，包括流程编辑器、数据模型、组件注册和状态管理。

## 技术栈

| 技术 | 用途 |
| -- | -- |
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| Zustand | 状态管理 |
| Ant Design | UI 组件库 |
| Vite | 构建工具 |
| @xyflow/react | 流程图渲染 (可选) |
| immer | 不可变数据 |
| i18next | 国际化 (支持32种语言) |

## 目录结构

```
packages/flow/src/
├── index.ts              # 主入口，导出所有公共 API
├── designer.tsx          # FlowDesigner 设计器组件
├── types.ts              # TypeScript 类型定义
├── index.css             # 全局样式
│
├── components/           # 流程节点组件
│   ├── nodes/            # 节点组件
│   │   ├── BaseNode/     # 基础节点组件
│   │   ├── EventNode.tsx # 事件触发节点
│   │   ├── IfNode.tsx    # 条件判断节点
│   │   ├── ConditionNode.tsx # 条件分支节点
│   │   ├── ReqNode.tsx   # 请求数据节点
│   │   ├── InsertDataNode.tsx # 插入数据节点
│   │   ├── VarNode.tsx   # 变量节点
│   │   ├── FnNode.tsx    # 函数节点
│   │   └── ...
│   ├── plusNodes/        # 添加节点组件
│   │   └── AddNode.tsx   # 添加节点下拉菜单
│   └── utils/            # 组件工具函数
│
├── model/                # 数据模型层
│   ├── logic-model.ts    # 核心逻辑模型 (增删改查流程节点)
│   ├── register.ts       # 组件/逻辑注册器
│   ├── custom-event.ts   # 自定义事件系统
│   ├── history.ts        # 历史记录管理
│   ├── support-event-type.ts   # 支持的事件类型
│   ├── support-funs.ts   # 支持的函数
│   └── support-var-type.ts     # 支持的变量类型
│
├── render/               # 流程渲染层
│   ├── FlowRender.tsx    # 流程图渲染组件
│   ├── FlowRender.scss   # 渲染样式
│   └── component-map-logic.tsx # 设计时节点组件注册
│
├── setter/               # 属性设置器
│   ├── index.tsx         # 设置面板主组件
│   ├── renderSetter.tsx  # 设置器渲染逻辑
│   ├── types.ts          # 设置器类型
│   ├── components/       # 设置器组件
│   │   ├── base/         # 基础设置器 (String, Number, Select等)
│   │   ├── layout/       # 布局组件
│   │   ├── plugins/      # 插件 (变量绑定等)
│   │   └── dataSetter.tsx # 数据设置器
│   └── utils/            # 设置器工具
│
├── states/               # 状态管理
│   ├── flowSchemaStore.ts # Flow Schema Zustand Store
│   ├── useFlows.ts       # Flow CRUD Hook
│   ├── useFlowApps.ts    # FlowApp 管理 Hook
│   └── useSchemaUpload.ts # Schema 上传 Hook
│
├── utils/                # 工具函数
│   └── const.tsx         # 常量定义 (节点类型、菜单等)
│
├── lang/                 # 国际化语言文件
│   ├── zh_CN.json        # 简体中文
│   ├── en.json           # 英文
│   └── ... (32种语言)
│
├── assets/               # 静态资源
└── public/               # 公共资源
```

## Flow Schema 数据模型

Flow 的数据存储采用分层架构，包含数据库模型和运行时 Schema 两部分。

### 数据库模型

**Flow 表 (nc_flows)**

```typescript
interface FlowType {
  id: string;                      // 流程唯一标识 (UUID)
  title: string;                   // 流程名称
  order: number;                   // 排序顺序
  type: string;                    // 流程类型
  fk_app_id: string;               // 所属应用 ID
  fk_data_id?: string;             // 关联的开发环境 Schema ID
  fk_publish_data_id?: string;     // 关联的发布环境 Schema ID
  is_publish: boolean;             // 是否已发布
  publish_at: string | number | Date; // 发布时间
  need_publish: boolean;           // 是否需要发布
  meta?: object;                   // 元数据
  deleted?: boolean;               // 是否已删除
}
```

**Schema 表 (nc_schema)**

```typescript
interface SchemaDataType {
  id: string;                      // Schema 唯一标识 (UUID)
  version: string;                 // 版本号
  data?: any;                      // Schema 数据 (JSON)
  domain: SchemaDomain;            // 域类型
  fk_org_id?: string;              // 所属组织 ID
  fk_project_id?: string;          // 所属项目 ID
  fk_domain_id: string;            // 关联的域 ID (如 Flow ID)
  meta?: object;                   // 元数据
}
```

### Platform Server Flow 类型定义

在 `platform-server` 中，Flow 相关的类型定义如下：

```typescript
// Flow 实体类型
interface Flow {
  id: string;                      // 流程唯一标识
  project_id: string;              // 所属项目 ID
  group_id?: string;               // 分组 ID
  title: string;                   // 流程名称
  fk_schema_id?: string;           // 开发环境 Schema ID
  fk_publish_schema_id?: string;   // 发布环境 Schema ID
  trigger_type?: FlowTriggerType;  // 触发类型
  enabled?: boolean;               // 是否启用
  order?: number;                  // 排序顺序
  meta?: Record<string, unknown>;  // 元数据
  created_at: Date;                // 创建时间
  updated_at: Date;                // 更新时间
}

// 触发类型枚举
type FlowTriggerType = 'manual' | 'schedule' | 'webhook' | 'record' | 'form';

// Schema 数据类型
interface SchemaData {
  id: string;                      // Schema 唯一标识
  domain: SchemaDomain;            // 域类型 ('model' | 'app' | 'page' | 'flow')
  fk_domain_id: string;            // 关联的域 ID
  fk_project_id: string;           // 所属项目 ID
  data: Record<string, unknown>;   // Schema 数据
  env: SchemaEnv;                  // 环境 ('DEV' | 'PRO')
  version?: number;                // 版本号
  created_at: Date;                // 创建时间
  updated_at: Date;                // 更新时间
}
```

---

## FlowSchemaType - 根节点 Schema

Flow 的根节点必须是 `EVENT` 类型，定义了整个工作流的入口：

```typescript
interface FlowSchemaType {
  id: string;                      // 节点 ID (nanoid)
  actionType: FlowNodeTypes.EVENT; // 固定为 'event'
  props?: {
    title?: string;                // 流程描述
    eventType?: FlowEventTypes;    // 触发事件类型
    tableId?: string;              // 关联数据表 ID
    viewId?: string;               // 关联视图 ID
  };
  actions?: FlowNodeType[];        // 子动作节点列表
}
```

### FlowNodeType - 通用节点类型

```typescript
interface FlowNodeType {
  id: string;                      // 节点唯一标识 (nanoid)
  actionType: FlowNodeTypes;       // 节点类型
  props?: Record<string, any>;     // 节点属性 (因类型而异)
  actions?: FlowNodeType[];        // 子动作节点 (用于 EVENT, CONDITION)
  conditions?: FlowConditionNodeType[]; // 条件分支 (仅用于 IF 节点)
  x?: number;                      // X 坐标 (可选，用于可视化布局)
  y?: number;                      // Y 坐标 (可选)
}
```

### FlowNodeTypes - 节点类型枚举

```typescript
enum FlowNodeTypes {
  EVENT = 'event',           // 事件触发节点 (根节点)
  DATAINSERT = 'dataInsert', // 插入数据节点
  DATALIST = 'dataList',     // 请求/查询数据节点
  DATAUPDATE = 'dataUpdate', // 更新数据节点
  IF = 'if',                 // 条件判断节点
  CONDITION = 'condition',   // 条件分支节点
}
```

### FlowEventTypes - 事件类型枚举

```typescript
enum FlowEventTypes {
  INSERT = 'insert',   // 当创建数据时执行
  UPDATE = 'update',   // 当更新数据时执行
  TIMER = 'time',      // 定时执行 (待实现)
}
```

### FlowConditionNodeType - 条件分支节点

```typescript
interface FlowConditionNodeType {
  id: string;                      // 分支 ID
  actionType: FlowNodeTypes.CONDITION; // 固定为 'condition'
  props?: {
    title?: string;                // 分支描述
    expression?: ExpressionType | string; // 条件表达式
  };
  actions: FlowNodeType[];         // 分支内的动作节点
}
```

---

## 各节点类型的 Props 定义

### EVENT 节点 Props

```typescript
interface EventNodeProps {
  title?: string;                  // 描述
  eventType?: FlowEventTypes;      // 事件类型 (insert/update/time)
  tableId?: string;                // 数据表 ID
  viewId?: string;                 // 数据视图 ID
}
```

### DATALIST 节点 Props

```typescript
interface DataListNodeProps {
  title?: string;                  // 描述
  tableId?: string;                // 数据表 ID
  viewId?: string;                 // 数据视图 ID
  filters?: FilterType[];          // 过滤条件
  limit?: string | number;         // 最大记录数
}
```

### DATAINSERT 节点 Props

```typescript
interface DataInsertNodeProps {
  title?: string;                  // 描述
  tableId?: string;                // 数据表 ID
  viewId?: string;                 // 数据视图 ID
  body?: Record<string, any>;      // 提交数据 (字段名 -> 值)
}
```

### DATAUPDATE 节点 Props

```typescript
interface DataUpdateNodeProps {
  title?: string;                  // 描述
  tableId?: string;                // 数据表 ID
  viewId?: string;                 // 数据视图 ID
  rowId?: string | ExpressionType; // 记录 ID (支持表达式绑定)
  body?: Record<string, any>;      // 更新数据 (字段名 -> 值)
}
```

### IF / CONDITION 节点 Props

```typescript
interface ConditionNodeProps {
  title?: string;                  // 描述
  expression?: ExpressionType | string; // 条件表达式 (支持绑定)
}
```

---

## ExpressionType - 表达式绑定格式

当属性需要绑定动态值时，使用表达式类型：

```typescript
interface ExpressionType {
  type: 'expression';              // 固定标识
  value: string;                   // 表达式值，如 '{eventData.fieldName}'
  label?: string;                  // 显示名称 (可选)
}
```

### 表达式上下文变量

| 变量 | 说明 | 示例 |
| -- | -- | -- |
| `eventData` | 触发事件时的数据 | `{eventData.id}` |
| `flowData` | 流程执行过程中的数据 | `{flowData.nodeId.result}` |
| `loopData` | 循环中的当前项 | `{loopData.item}` |
| `context` | 全局上下文 | `{context.userId}` |

---

## 完整 Schema 示例

```json
{
  "id": "event_abc123",
  "actionType": "event",
  "props": {
    "title": "当创建订单时同步库存",
    "eventType": "insert",
    "tableId": "tbl_orders",
    "viewId": "viw_default"
  },
  "actions": [
    {
      "id": "list_def456",
      "actionType": "dataList",
      "props": {
        "title": "查询商品库存",
        "tableId": "tbl_products",
        "viewId": "viw_default",
        "filters": [
          {
            "field": "id",
            "op": "eq",
            "value": {
              "type": "expression",
              "value": "{eventData.product_id}",
              "label": "订单商品ID"
            }
          }
        ],
        "limit": "1"
      }
    },
    {
      "id": "if_ghi789",
      "actionType": "if",
      "props": {
        "title": "判断库存是否充足"
      },
      "conditions": [
        {
          "id": "cond_jkl012",
          "actionType": "condition",
          "props": {
            "title": "库存充足",
            "expression": {
              "type": "expression",
              "value": "{flowData.list_def456.stock} >= {eventData.quantity}"
            }
          },
          "actions": [
            {
              "id": "update_mno345",
              "actionType": "dataUpdate",
              "props": {
                "title": "扣减库存",
                "tableId": "tbl_products",
                "rowId": {
                  "type": "expression",
                  "value": "{eventData.product_id}"
                },
                "body": {
                  "stock": {
                    "type": "expression",
                    "value": "{flowData.list_def456.stock} - {eventData.quantity}"
                  }
                }
              }
            }
          ]
        },
        {
          "id": "cond_pqr678",
          "actionType": "condition",
          "props": {
            "title": "库存不足 (默认分支)"
          },
          "actions": []
        }
      ]
    }
  ]
}
```

---

## Schema 存储流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     Flow Schema 存储流程                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   设计器编辑 Schema                                              │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Flow.updateSchema(flowId, schemaData)                  │   │
│   │    ├── 检查 flow.fk_data_id 是否存在                     │   │
│   │    ├── 存在: SchemaData.updateData(fk_data_id, data)    │   │
│   │    └── 不存在: SchemaData.insert({fk_domain_id, data})  │   │
│   │              → 更新 Flow.fk_data_id                      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    发布 (Publish)                        │   │
│   │    ├── 复制 Schema 到新版本                               │   │
│   │    └── 更新 Flow.fk_publish_data_id                      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API 路由

Flow 相关的 API 路由：

| 方法 | 路径 | 描述 |
| -- | -- | -- |
| GET | `/api/v1/db/meta/projects/:id/flows` | 工作流列表 |
| POST | `/api/v1/db/meta/projects/:id/flows` | 创建工作流 |
| GET | `/api/v1/db/meta/projects/:id/flows/:flowId` | 工作流详情 |
| PATCH | `/api/v1/db/meta/projects/:id/flows/:flowId` | 更新工作流 |
| DELETE | `/api/v1/db/meta/projects/:id/flows/:flowId` | 删除工作流 |
| POST | `/api/v1/db/meta/projects/:id/flows/:flowId/save` | 保存工作流 |
| POST | `/api/v1/db/meta/projects/:id/flows/:flowId/publish` | 发布工作流 |
| POST | `/api/v1/db/meta/projects/:id/flows/:flowId/enable` | 启用工作流 |
| POST | `/api/v1/db/meta/projects/:id/flows/:flowId/disable` | 禁用工作流 |
| POST | `/api/v1/db/meta/projects/:id/flows/reorder` | 工作流排序 |
| POST | `/api/v1/db/meta/projects/:id/flows/:flowId/move-to-group` | 移动到分组 |

### 请求/响应示例

#### 创建工作流

**请求:**
```http
POST /api/v1/db/meta/projects/:projectId/flows
Content-Type: application/json

{
  "title": "订单库存同步",
  "trigger_type": "record",
  "group_id": "group_123",
  "meta": {
    "description": "当创建订单时自动扣减库存"
  }
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "flow_abc123",
    "project_id": "proj_xyz",
    "title": "订单库存同步",
    "trigger_type": "record",
    "group_id": "group_123",
    "enabled": false,
    "order": 1,
    "meta": {
      "description": "当创建订单时自动扣减库存"
    },
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 保存工作流 Schema

**请求:**
```http
POST /api/v1/db/meta/projects/:projectId/flows/:flowId/save
Content-Type: application/json

{
  "title": "订单库存同步 v2",
  "trigger_type": "record",
  "meta": {
    "schema": {
      "id": "event_abc123",
      "actionType": "event",
      "props": {
        "eventType": "insert",
        "tableId": "tbl_orders"
      },
      "actions": []
    }
  }
}
```

#### 发布工作流

**请求:**
```http
POST /api/v1/db/meta/projects/:projectId/flows/:flowId/publish
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "flow_abc123",
    "fk_schema_id": "schema_dev_123",
    "fk_publish_schema_id": "schema_pro_456",
    "enabled": true,
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 服务层 API

### FlowService

```typescript
import { FlowService } from '@workspace/platform-server';

// 创建工作流
const flow = await FlowService.createFlow({
  project_id: 'proj_123',
  title: '订单处理流程',
  trigger_type: 'record',
  group_id: 'group_456',
  meta: { description: '...' }
});

// 列出项目下的工作流
const flows = await FlowService.listForProject('proj_123', 'group_456');

// 列出启用的工作流
const enabledFlows = await FlowService.listEnabled('proj_123');

// 按触发类型列出
const webhookFlows = await FlowService.listByTrigger('proj_123', 'webhook');

// 更新工作流
await FlowService.updateFlow('flow_123', {
  title: '更新后的标题',
  trigger_type: 'schedule',
  enabled: true
});

// 保存工作流 (meta/schema)
await FlowService.saveFlow('flow_123', {
  title: '保存标题',
  meta: { schema: { ... } }
});

// 发布工作流
await FlowService.publish('flow_123');

// 启用/禁用工作流
await FlowService.enable('flow_123');
await FlowService.disable('flow_123');

// 重新排序
await FlowService.reorder('proj_123', [
  { id: 'flow_1', order: 0 },
  { id: 'flow_2', order: 1 },
  { id: 'flow_3', order: 2 }
]);

// 移动到分组
await FlowService.moveToGroup('flow_123', 'group_789');

// 删除工作流
await FlowService.deleteFlow('flow_123');
```

---

## 节点组件开发指南

### 创建自定义节点

```typescript
// components/nodes/CustomNode.tsx
import React from 'react';
import { BaseNode } from './BaseNode';
import type { FlowNodeType } from '../../types';

interface CustomNodeProps {
  node: FlowNodeType;
  selected?: boolean;
  onSelect?: () => void;
}

export const CustomNode: React.FC<CustomNodeProps> = ({
  node,
  selected,
  onSelect
}) => {
  return (
    <BaseNode
      node={node}
      selected={selected}
      onSelect={onSelect}
      title={node.props?.title || '自定义节点'}
      icon={<CustomIcon />}
    >
      {/* 节点内容 */}
      <div className="custom-node-content">
        {/* ... */}
      </div>
    </BaseNode>
  );
};
```

### 注册节点组件

```typescript
// render/component-map-logic.tsx
import { CustomNode } from '../components/nodes/CustomNode';

export const nodeComponentMap = {
  event: EventNode,
  dataInsert: InsertDataNode,
  dataList: ReqNode,
  dataUpdate: UpdateDataNode,
  if: IfNode,
  condition: ConditionNode,
  custom: CustomNode,  // 注册自定义节点
};
```

### 创建节点设置器

```typescript
// setter/components/CustomSetter.tsx
import React from 'react';
import { Form, Input, Select } from 'antd';
import type { SetterProps } from '../types';

export const CustomSetter: React.FC<SetterProps> = ({
  node,
  onChange
}) => {
  return (
    <Form layout="vertical">
      <Form.Item label="标题">
        <Input
          value={node.props?.title}
          onChange={(e) => onChange({
            ...node,
            props: { ...node.props, title: e.target.value }
          })}
        />
      </Form.Item>
      {/* 更多设置项 */}
    </Form>
  );
};
```

---

## 状态管理

### Flow Schema Store

```typescript
// states/flowSchemaStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FlowSchemaType, FlowNodeType } from '../types';

interface FlowSchemaState {
  schema: FlowSchemaType | null;
  selectedNodeId: string | null;
  
  // Actions
  setSchema: (schema: FlowSchemaType) => void;
  selectNode: (nodeId: string | null) => void;
  addNode: (parentId: string, node: FlowNodeType) => void;
  updateNode: (nodeId: string, updates: Partial<FlowNodeType>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string, index: number) => void;
}

export const useFlowSchemaStore = create<FlowSchemaState>()(
  immer((set) => ({
    schema: null,
    selectedNodeId: null,
    
    setSchema: (schema) => set({ schema }),
    
    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
    
    addNode: (parentId, node) => set((state) => {
      // 查找父节点并添加子节点
      const parent = findNode(state.schema, parentId);
      if (parent) {
        if (!parent.actions) parent.actions = [];
        parent.actions.push(node);
      }
    }),
    
    updateNode: (nodeId, updates) => set((state) => {
      const node = findNode(state.schema, nodeId);
      if (node) {
        Object.assign(node, updates);
      }
    }),
    
    deleteNode: (nodeId) => set((state) => {
      removeNode(state.schema, nodeId);
    }),
    
    moveNode: (nodeId, newParentId, index) => set((state) => {
      // 实现节点移动逻辑
    }),
  }))
);
```

### History 管理

```typescript
// model/history.ts
import { create } from 'zustand';
import type { FlowSchemaType } from '../types';

interface HistoryState {
  past: FlowSchemaType[];
  future: FlowSchemaType[];
  
  push: (schema: FlowSchemaType) => void;
  undo: () => FlowSchemaType | null;
  redo: () => FlowSchemaType | null;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  
  push: (schema) => set((state) => ({
    past: [...state.past, schema],
    future: []
  })),
  
  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return null;
    
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [previous, ...future]
    });
    return previous;
  },
  
  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return null;
    
    const next = future[0];
    set({
      past: [...past, next],
      future: future.slice(1)
    });
    return next;
  },
  
  clear: () => set({ past: [], future: [] })
}));
```

---

## 国际化

FlowSDK 支持 32 种语言。使用 i18next 进行国际化管理。

### 语言文件结构

```
lang/
├── zh_CN.json    # 简体中文
├── zh_TW.json    # 繁体中文
├── en.json       # 英文
├── ja.json       # 日文
├── ko.json       # 韩文
├── de.json       # 德文
├── fr.json       # 法文
├── es.json       # 西班牙文
└── ... (更多语言)
```

### 语言文件示例

```json
// lang/zh_CN.json
{
  "flow": {
    "designer": {
      "title": "流程设计器",
      "save": "保存",
      "publish": "发布",
      "undo": "撤销",
      "redo": "重做"
    },
    "nodes": {
      "event": "事件触发",
      "dataList": "查询数据",
      "dataInsert": "插入数据",
      "dataUpdate": "更新数据",
      "if": "条件判断",
      "condition": "条件分支"
    },
    "events": {
      "insert": "当创建数据时",
      "update": "当更新数据时",
      "timer": "定时执行"
    },
    "setter": {
      "title": "标题",
      "eventType": "事件类型",
      "table": "数据表",
      "view": "视图",
      "expression": "表达式"
    }
  }
}
```

### 使用国际化

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('flow.designer.title')}</h1>
      <button>{t('flow.designer.save')}</button>
    </div>
  );
};
```

---

## 最佳实践

### 1. Schema 设计原则

- 保持节点 ID 的唯一性 (使用 nanoid)
- 使用表达式绑定动态值，而非硬编码
- 合理组织条件分支，避免过深嵌套
- 为每个节点添加描述性的 title

### 2. 性能优化

- 使用 immer 进行不可变更新
- 对大型 Schema 使用虚拟化渲染
- 合理使用 React.memo 减少重渲染
- 批量更新时使用事务

### 3. 错误处理

- 验证 Schema 结构完整性
- 处理表达式解析错误
- 提供友好的错误提示
- 支持 Schema 回滚

### 4. 测试建议

- 单元测试节点组件
- 测试 Schema 操作 (CRUD)
- 测试表达式解析
- E2E 测试完整流程

---

## 相关文档

- [Platform Server README](../README.md) - 后端服务文档
- [API 路由参考](../README.md#api-路由) - 完整 API 列表
- [错误码参考](../README.md#错误码) - 错误处理指南
- [优化提案](../OPTIMIZATION_PROPOSAL.md) - 性能优化提案

## 相关包

- [@workspace/flow-designer](../../flow-designer) - Flow 设计器 (核心引擎 + React UI)
- [@workspace/flow-runtime](../../flow-runtime) - Flow 执行引擎
