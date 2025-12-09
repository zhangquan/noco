# 组件逻辑与状态的可视化表达

> 如何在 VisionSchema 中表达 React 组件的逻辑和状态

## 1. 问题分析

一个完整的 React 组件包含多个维度：

```tsx
export const MyComponent: React.FC<Props> = ({ initialValue, onSave }) => {
  // ========== 状态 ==========
  const [count, setCount] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  
  // ========== 外部状态 ==========
  const user = useContext(UserContext);
  const theme = useStore((s) => s.theme);
  
  // ========== 副作用 ==========
  useEffect(() => {
    fetchData();
  }, []);
  
  // ========== 计算属性 ==========
  const doubleCount = useMemo(() => count * 2, [count]);
  
  // ========== 事件处理 ==========
  const handleClick = useCallback(() => {
    setCount(c => c + 1);
    onSave(count);
  }, [count, onSave]);
  
  // ========== 渲染 ==========
  return <div onClick={handleClick}>{doubleCount}</div>;
};
```

**核心问题**：如何在可视化 Schema 中表达这些非视觉元素？

---

## 2. 设计理念

### 2.1 分层模型

```
┌─────────────────────────────────────────────────────────────┐
│                     ComponentSchema                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Props      │  │    State     │  │   Computed   │       │
│  │   Layer      │  │    Layer     │  │    Layer     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Logic Layer                         │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │   │ Effects │  │Handlers │  │ Refs    │              │   │
│  │   └─────────┘  └─────────┘  └─────────┘              │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   View Layer                          │   │
│  │              (VisionSchema - JSX)                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心原则

| 原则 | 说明 |
|------|------|
| **声明式表达** | 将命令式逻辑转换为声明式描述 |
| **依赖追踪** | 明确数据流向和依赖关系 |
| **可视化友好** | 逻辑可在 UI 中直观展示 |
| **代码可逆** | 能够从 Schema 还原代码 |

---

## 3. Schema 结构设计

### 3.1 完整的 ComponentSchema

```typescript
interface ComponentSchema {
  // 组件元信息
  meta: ComponentMeta;
  
  // Props 定义
  props: PropsSchema;
  
  // 状态定义
  state: StateSchema;
  
  // 计算属性
  computed: ComputedSchema;
  
  // 副作用
  effects: EffectSchema[];
  
  // 事件处理器
  handlers: HandlerSchema[];
  
  // Refs
  refs: RefSchema[];
  
  // 视图层（JSX）
  view: VisionSchema;
  
  // 源码映射
  sourceMap: ComponentSourceMap;
}
```

---

## 4. Props 层表达

### 4.1 Props Schema

```typescript
interface PropsSchema {
  // Props 类型定义
  type: TypeDefinition;
  
  // 各个 prop 的详细信息
  properties: PropDefinition[];
  
  // 默认值
  defaults: Record<string, unknown>;
  
  // 解构信息
  destructure: DestructureInfo;
}

interface PropDefinition {
  name: string;
  type: TypeDefinition;
  required: boolean;
  default?: unknown;
  description?: string;  // 从 JSDoc 提取
  
  // 使用分析
  usage: {
    inState: boolean;      // 用于初始化状态
    inEffect: boolean;     // 用于副作用
    inComputed: boolean;   // 用于计算属性
    inHandler: boolean;    // 用于事件处理
    inView: boolean;       // 直接用于渲染
  };
}
```

### 4.2 示例

```tsx
// 输入
interface ButtonProps {
  /** 按钮文本 */
  label: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮大小 */
  size?: 'small' | 'medium' | 'large';
}

const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  disabled = false,
  size = 'medium' 
}) => { ... }
```

```json
// Props Schema
{
  "type": { "kind": "interface", "name": "ButtonProps" },
  "properties": [
    {
      "name": "label",
      "type": { "kind": "primitive", "name": "string" },
      "required": true,
      "description": "按钮文本",
      "usage": { "inView": true }
    },
    {
      "name": "onClick",
      "type": { "kind": "function", "params": [], "return": "void" },
      "required": false,
      "description": "点击回调",
      "usage": { "inHandler": true }
    },
    {
      "name": "disabled",
      "type": { "kind": "primitive", "name": "boolean" },
      "required": false,
      "default": false,
      "description": "是否禁用",
      "usage": { "inView": true }
    },
    {
      "name": "size",
      "type": { "kind": "union", "members": ["'small'", "'medium'", "'large'"] },
      "required": false,
      "default": "'medium'",
      "description": "按钮大小",
      "usage": { "inView": true }
    }
  ],
  "defaults": {
    "disabled": false,
    "size": "medium"
  }
}
```

### 4.3 可视化表现

```
┌─────────────────────────────────────────┐
│ Props                                    │
├─────────────────────────────────────────┤
│ ● label: string (required)              │
│   └─ 用于: View                          │
│                                          │
│ ○ onClick?: () => void                  │
│   └─ 用于: Handler                       │
│                                          │
│ ○ disabled?: boolean = false            │
│   └─ 用于: View                          │
│                                          │
│ ○ size?: 'small'|'medium'|'large'       │
│   └─ 默认: 'medium'                      │
│   └─ 用于: View                          │
└─────────────────────────────────────────┘
```

---

## 5. State 层表达

### 5.1 State Schema

```typescript
interface StateSchema {
  // 状态变量列表
  variables: StateVariable[];
  
  // 状态之间的依赖关系
  dependencies: StateDependency[];
}

interface StateVariable {
  id: string;
  name: string;
  
  // Hook 类型
  hook: 'useState' | 'useReducer' | 'useContext' | 'useStore' | 'custom';
  
  // 值类型
  type: TypeDefinition;
  
  // 初始值
  initialValue: {
    type: 'literal' | 'prop' | 'expression' | 'function';
    value: unknown;
    expression?: string;
    dependencies?: string[];  // 依赖的 props 或其他变量
  };
  
  // Setter 函数名（如 setCount）
  setter?: string;
  
  // 更新方式
  updates: StateUpdate[];
  
  // 源码位置
  sourceLocation: SourceLocation;
}

interface StateUpdate {
  // 在哪里更新
  location: 'handler' | 'effect' | 'callback';
  locationId: string;
  
  // 更新表达式
  expression: string;
  
  // 更新类型
  type: 'direct' | 'functional';  // setCount(5) vs setCount(c => c + 1)
}
```

### 5.2 示例

```tsx
// 输入
const [count, setCount] = useState(0);
const [user, setUser] = useState<User | null>(null);
const [isLoading, setIsLoading] = useState(false);
const theme = useContext(ThemeContext);
const settings = useStore((s) => s.settings);
```

```json
// State Schema
{
  "variables": [
    {
      "id": "state_count",
      "name": "count",
      "hook": "useState",
      "type": { "kind": "primitive", "name": "number" },
      "initialValue": { "type": "literal", "value": 0 },
      "setter": "setCount",
      "updates": [
        {
          "location": "handler",
          "locationId": "handler_handleIncrement",
          "expression": "setCount(c => c + 1)",
          "type": "functional"
        }
      ]
    },
    {
      "id": "state_user",
      "name": "user",
      "hook": "useState",
      "type": { "kind": "union", "members": ["User", "null"] },
      "initialValue": { "type": "literal", "value": null },
      "setter": "setUser",
      "updates": [
        {
          "location": "effect",
          "locationId": "effect_fetchUser",
          "expression": "setUser(data)",
          "type": "direct"
        }
      ]
    },
    {
      "id": "state_isLoading",
      "name": "isLoading",
      "hook": "useState",
      "type": { "kind": "primitive", "name": "boolean" },
      "initialValue": { "type": "literal", "value": false },
      "setter": "setIsLoading"
    },
    {
      "id": "context_theme",
      "name": "theme",
      "hook": "useContext",
      "type": { "kind": "reference", "name": "Theme" },
      "initialValue": { 
        "type": "expression", 
        "expression": "useContext(ThemeContext)" 
      }
    },
    {
      "id": "store_settings",
      "name": "settings",
      "hook": "useStore",
      "type": { "kind": "reference", "name": "Settings" },
      "initialValue": { 
        "type": "expression", 
        "expression": "useStore((s) => s.settings)",
        "dependencies": ["store"]
      }
    }
  ]
}
```

### 5.3 可视化表现

```
┌─────────────────────────────────────────────────────────────┐
│ State                                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── useState ───────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  count: number = 0                                      │ │
│  │  ├─ setter: setCount                                    │ │
│  │  └─ 更新于: handleIncrement (c => c + 1)                │ │
│  │                                                         │ │
│  │  user: User | null = null                               │ │
│  │  ├─ setter: setUser                                     │ │
│  │  └─ 更新于: fetchUser effect                            │ │
│  │                                                         │ │
│  │  isLoading: boolean = false                             │ │
│  │  └─ setter: setIsLoading                                │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── useContext ─────────────────────────────────────────┐ │
│  │  theme ← ThemeContext                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── useStore ───────────────────────────────────────────┐ │
│  │  settings ← store.settings                              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Computed 层表达

### 6.1 Computed Schema

```typescript
interface ComputedSchema {
  variables: ComputedVariable[];
}

interface ComputedVariable {
  id: string;
  name: string;
  
  // Hook 类型
  hook: 'useMemo' | 'useCallback' | 'derived';
  
  // 返回类型
  type: TypeDefinition;
  
  // 计算表达式/函数体
  computation: {
    expression: string;
    body?: string;  // 多行函数体
  };
  
  // 依赖项
  dependencies: Dependency[];
  
  // 是否是回调函数
  isCallback: boolean;
  
  sourceLocation: SourceLocation;
}

interface Dependency {
  name: string;
  source: 'prop' | 'state' | 'computed' | 'external';
  sourceId?: string;
}
```

### 6.2 示例

```tsx
// 输入
const doubleCount = useMemo(() => count * 2, [count]);

const formattedDate = useMemo(() => {
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN').format(date);
}, [date]);

const handleSubmit = useCallback(async () => {
  setIsLoading(true);
  await saveData(formData);
  setIsLoading(false);
}, [formData, saveData]);
```

```json
// Computed Schema
{
  "variables": [
    {
      "id": "computed_doubleCount",
      "name": "doubleCount",
      "hook": "useMemo",
      "type": { "kind": "primitive", "name": "number" },
      "computation": {
        "expression": "count * 2"
      },
      "dependencies": [
        { "name": "count", "source": "state", "sourceId": "state_count" }
      ],
      "isCallback": false
    },
    {
      "id": "computed_formattedDate",
      "name": "formattedDate",
      "hook": "useMemo",
      "type": { "kind": "primitive", "name": "string" },
      "computation": {
        "body": "if (!date) return '';\nreturn new Intl.DateTimeFormat('zh-CN').format(date);"
      },
      "dependencies": [
        { "name": "date", "source": "prop" }
      ],
      "isCallback": false
    },
    {
      "id": "computed_handleSubmit",
      "name": "handleSubmit",
      "hook": "useCallback",
      "type": { "kind": "function", "async": true, "return": "void" },
      "computation": {
        "body": "setIsLoading(true);\nawait saveData(formData);\nsetIsLoading(false);"
      },
      "dependencies": [
        { "name": "formData", "source": "state" },
        { "name": "saveData", "source": "prop" }
      ],
      "isCallback": true
    }
  ]
}
```

### 6.3 可视化表现

```
┌─────────────────────────────────────────────────────────────┐
│ Computed                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── useMemo ────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  doubleCount: number                                    │ │
│  │  ├─ 计算: count * 2                                     │ │
│  │  └─ 依赖: [count]                                       │ │
│  │         └── state.count                                 │ │
│  │                                                         │ │
│  │  formattedDate: string                                  │ │
│  │  ├─ 计算: (多行函数)                                    │ │
│  │  └─ 依赖: [date]                                        │ │
│  │         └── props.date                                  │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── useCallback ────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  handleSubmit: async () => void                         │ │
│  │  ├─ 操作:                                               │ │
│  │  │   1. setIsLoading(true)                              │ │
│  │  │   2. await saveData(formData)                        │ │
│  │  │   3. setIsLoading(false)                             │ │
│  │  └─ 依赖: [formData, saveData]                          │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Effect 层表达

### 7.1 Effect Schema

```typescript
interface EffectSchema {
  id: string;
  name?: string;  // 从注释或推断
  
  // Hook 类型
  hook: 'useEffect' | 'useLayoutEffect' | 'useInsertionEffect';
  
  // 效果描述
  description?: string;
  
  // 依赖项
  dependencies: {
    type: 'array' | 'none' | 'empty';  // [deps] | 无 | []
    items: Dependency[];
  };
  
  // 效果体
  effect: {
    // 主要操作
    operations: EffectOperation[];
    
    // 原始代码
    body: string;
  };
  
  // 清理函数
  cleanup?: {
    operations: EffectOperation[];
    body: string;
  };
  
  // 执行时机
  timing: {
    onMount: boolean;      // [] 依赖
    onUpdate: boolean;     // 有依赖项
    onEveryRender: boolean; // 无依赖数组
  };
  
  sourceLocation: SourceLocation;
}

interface EffectOperation {
  type: 'setState' | 'apiCall' | 'subscription' | 'domOperation' | 'log' | 'other';
  target?: string;
  description: string;
  async: boolean;
}
```

### 7.2 示例

```tsx
// 输入
useEffect(() => {
  // 获取用户数据
  const fetchUser = async () => {
    setIsLoading(true);
    const data = await api.getUser(userId);
    setUser(data);
    setIsLoading(false);
  };
  fetchUser();
}, [userId]);

useEffect(() => {
  // 订阅事件
  const handler = (e) => setPosition(e);
  window.addEventListener('mousemove', handler);
  
  return () => {
    window.removeEventListener('mousemove', handler);
  };
}, []);
```

```json
// Effect Schema
[
  {
    "id": "effect_fetchUser",
    "name": "获取用户数据",
    "hook": "useEffect",
    "dependencies": {
      "type": "array",
      "items": [
        { "name": "userId", "source": "prop" }
      ]
    },
    "effect": {
      "operations": [
        { "type": "setState", "target": "isLoading", "description": "setIsLoading(true)", "async": false },
        { "type": "apiCall", "description": "api.getUser(userId)", "async": true },
        { "type": "setState", "target": "user", "description": "setUser(data)", "async": false },
        { "type": "setState", "target": "isLoading", "description": "setIsLoading(false)", "async": false }
      ],
      "body": "const fetchUser = async () => { ... }"
    },
    "timing": {
      "onMount": true,
      "onUpdate": true,
      "onEveryRender": false
    }
  },
  {
    "id": "effect_mouseMove",
    "name": "订阅事件",
    "hook": "useEffect",
    "dependencies": {
      "type": "empty",
      "items": []
    },
    "effect": {
      "operations": [
        { "type": "subscription", "description": "window.addEventListener('mousemove', handler)", "async": false }
      ],
      "body": "const handler = (e) => setPosition(e); ..."
    },
    "cleanup": {
      "operations": [
        { "type": "subscription", "description": "window.removeEventListener('mousemove', handler)", "async": false }
      ],
      "body": "window.removeEventListener('mousemove', handler);"
    },
    "timing": {
      "onMount": true,
      "onUpdate": false,
      "onEveryRender": false
    }
  }
]
```

### 7.3 可视化表现

```
┌─────────────────────────────────────────────────────────────┐
│ Effects                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── useEffect: 获取用户数据 ────────────────────────────┐ │
│  │  ⏱ 执行时机: Mount + Update                            │ │
│  │                                                         │ │
│  │  📥 依赖: [userId]                                      │ │
│  │         └── props.userId                                │ │
│  │                                                         │ │
│  │  ▶ 操作流程:                                            │ │
│  │    ┌─────────────────────────────────────────────────┐ │ │
│  │    │ 1. setIsLoading(true)     → state.isLoading     │ │ │
│  │    │ 2. await api.getUser()    ← API 调用            │ │ │
│  │    │ 3. setUser(data)          → state.user          │ │ │
│  │    │ 4. setIsLoading(false)    → state.isLoading     │ │ │
│  │    └─────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─── useEffect: 订阅事件 ─────────────────────────────────┐ │
│  │  ⏱ 执行时机: Mount only                                │ │
│  │                                                         │ │
│  │  📥 依赖: [] (空数组)                                   │ │
│  │                                                         │ │
│  │  ▶ 操作:                                                │ │
│  │    └── 订阅 window.mousemove                           │ │
│  │                                                         │ │
│  │  🧹 清理:                                               │ │
│  │    └── 取消订阅 window.mousemove                       │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Handler 层表达

### 8.1 Handler Schema

```typescript
interface HandlerSchema {
  id: string;
  name: string;
  
  // 函数签名
  signature: {
    params: ParamDefinition[];
    returnType: TypeDefinition;
    async: boolean;
  };
  
  // 函数体分析
  body: {
    // 操作序列
    operations: HandlerOperation[];
    
    // 条件分支
    branches?: ConditionalBranch[];
    
    // 原始代码
    code: string;
  };
  
  // 依赖项（useCallback）
  dependencies?: Dependency[];
  
  // 在 JSX 中的绑定位置
  bindings: EventBinding[];
  
  sourceLocation: SourceLocation;
}

interface HandlerOperation {
  type: 'setState' | 'propCall' | 'apiCall' | 'navigate' | 'log' | 'return' | 'other';
  target?: string;
  expression: string;
  condition?: string;  // 如果在条件块中
}

interface EventBinding {
  nodeId: string;        // 绑定到哪个 JSX 节点
  eventName: string;     // onClick, onChange 等
  nodePath: string[];    // 节点路径
}
```

### 8.2 示例

```tsx
// 输入
const handleSubmit = useCallback(async (e: FormEvent) => {
  e.preventDefault();
  
  if (!isValid) {
    setError('表单无效');
    return;
  }
  
  setIsLoading(true);
  try {
    await api.submit(formData);
    onSuccess?.();
    navigate('/success');
  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
}, [isValid, formData, onSuccess, navigate]);
```

```json
// Handler Schema
{
  "id": "handler_handleSubmit",
  "name": "handleSubmit",
  "signature": {
    "params": [{ "name": "e", "type": "FormEvent" }],
    "returnType": { "kind": "primitive", "name": "void" },
    "async": true
  },
  "body": {
    "operations": [
      { "type": "other", "expression": "e.preventDefault()" }
    ],
    "branches": [
      {
        "condition": "!isValid",
        "operations": [
          { "type": "setState", "target": "error", "expression": "setError('表单无效')" },
          { "type": "return" }
        ]
      },
      {
        "condition": "else",
        "operations": [
          { "type": "setState", "target": "isLoading", "expression": "setIsLoading(true)" },
          {
            "type": "try",
            "tryOperations": [
              { "type": "apiCall", "expression": "await api.submit(formData)" },
              { "type": "propCall", "target": "onSuccess", "expression": "onSuccess?.()" },
              { "type": "navigate", "expression": "navigate('/success')" }
            ],
            "catchOperations": [
              { "type": "setState", "target": "error", "expression": "setError(err.message)" }
            ],
            "finallyOperations": [
              { "type": "setState", "target": "isLoading", "expression": "setIsLoading(false)" }
            ]
          }
        ]
      }
    ]
  },
  "dependencies": [
    { "name": "isValid", "source": "computed" },
    { "name": "formData", "source": "state" },
    { "name": "onSuccess", "source": "prop" },
    { "name": "navigate", "source": "external" }
  ],
  "bindings": [
    { "nodeId": "form_001", "eventName": "onSubmit", "nodePath": ["form"] }
  ]
}
```

### 8.3 可视化表现 - 流程图模式

```
┌─────────────────────────────────────────────────────────────┐
│ Handler: handleSubmit                                        │
│ async (e: FormEvent) => void                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐                                       │
│   │ e.preventDefault │                                       │
│   └────────┬────────┘                                       │
│            │                                                 │
│            ▼                                                 │
│   ┌─────────────────┐                                       │
│   │   !isValid ?    │                                       │
│   └────────┬────────┘                                       │
│      ┌─────┴─────┐                                          │
│      │ Yes       │ No                                       │
│      ▼           ▼                                          │
│  ┌────────┐  ┌──────────────────────────────────┐          │
│  │setError│  │ setIsLoading(true)               │          │
│  │ return │  │          │                        │          │
│  └────────┘  │          ▼                        │          │
│              │  ┌── try ────────────────────┐   │          │
│              │  │ api.submit(formData)      │   │          │
│              │  │ onSuccess?.()             │   │          │
│              │  │ navigate('/success')      │   │          │
│              │  └───────────┬───────────────┘   │          │
│              │        catch │ finally           │          │
│              │              ▼                    │          │
│              │  ┌─────────────────────────────┐ │          │
│              │  │ setError() │ setIsLoading() │ │          │
│              │  └─────────────────────────────┘ │          │
│              └──────────────────────────────────┘          │
│                                                              │
│ 📎 绑定于: form.onSubmit                                    │
│ 📥 依赖: [isValid, formData, onSuccess, navigate]           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. 数据流可视化

### 9.1 依赖关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Flow Graph                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Props                    State                   Computed          │
│   ─────                    ─────                   ────────          │
│   ┌─────────┐             ┌─────────┐             ┌──────────┐      │
│   │ userId  │────────────►│  user   │             │formattedU│      │
│   └─────────┘      │      └─────────┘────────────►│   ser    │      │
│                    │                              └──────────┘      │
│   ┌─────────┐      │      ┌─────────┐                   │           │
│   │ onSave  │──────┼─────►│isLoading│                   │           │
│   └─────────┘      │      └─────────┘                   │           │
│                    │            ▲                       │           │
│                    │            │                       ▼           │
│                    │      ┌─────┴─────┐          ┌──────────┐      │
│                    │      │  Effects  │          │   View   │      │
│                    │      │fetchUser()│          │  (JSX)   │      │
│                    │      └───────────┘          └──────────┘      │
│                    │                                    ▲           │
│                    │      ┌───────────┐                 │           │
│                    └─────►│ Handlers  │─────────────────┘           │
│                           │handleSave │                             │
│                           └───────────┘                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

图例:
  ───► 数据流向
  ● Props: 外部输入
  ◉ State: 内部状态
  ◎ Computed: 计算属性
  ▷ Handler: 事件处理
  ☐ View: 视图渲染
```

### 9.2 状态更新追踪

```
┌─────────────────────────────────────────────────────────────────────┐
│                    State Update Tracking                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  State: isLoading                                                   │
│  ───────────────                                                    │
│                                                                      │
│  初始值: false                                                      │
│                                                                      │
│  更新来源:                                                          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Effect: fetchUser                                         │   │
│  │    ├─ setIsLoading(true)   @ effect开始                      │   │
│  │    └─ setIsLoading(false)  @ effect结束                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 2. Handler: handleSubmit                                     │   │
│  │    ├─ setIsLoading(true)   @ 提交开始                        │   │
│  │    └─ setIsLoading(false)  @ finally块                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  使用位置:                                                          │
│  ├─ View: <Button disabled={isLoading} />                          │
│  └─ View: {isLoading && <Spinner />}                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. 完整组件 Schema 示例

### 10.1 示例组件

```tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { api } from './api';

interface UserCardProps {
  userId: string;
  onSave?: (user: User) => void;
  editable?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({
  userId,
  onSave,
  editable = false,
}) => {
  const navigate = useNavigate();
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      const data = await api.getUser(userId);
      setUser(data);
      setIsLoading(false);
    };
    fetchUser();
  }, [userId]);
  
  const displayName = useMemo(() => {
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`;
  }, [user]);
  
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);
  
  const handleSave = useCallback(async () => {
    if (!user) return;
    await api.updateUser(user);
    onSave?.(user);
    setIsEditing(false);
  }, [user, onSave]);
  
  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }
  
  return (
    <div className="user-card">
      <h2>{displayName}</h2>
      {editable && !isEditing && (
        <button onClick={handleEdit}>Edit</button>
      )}
      {isEditing && (
        <button onClick={handleSave}>Save</button>
      )}
    </div>
  );
};
```

### 10.2 完整 ComponentSchema

```json
{
  "meta": {
    "name": "UserCard",
    "displayName": "用户卡片",
    "filePath": "./UserCard.tsx",
    "exports": ["UserCard"],
    "defaultExport": false
  },
  
  "props": {
    "type": { "kind": "interface", "name": "UserCardProps" },
    "properties": [
      {
        "name": "userId",
        "type": { "kind": "primitive", "name": "string" },
        "required": true,
        "usage": { "inEffect": true }
      },
      {
        "name": "onSave",
        "type": { "kind": "function" },
        "required": false,
        "usage": { "inHandler": true }
      },
      {
        "name": "editable",
        "type": { "kind": "primitive", "name": "boolean" },
        "required": false,
        "default": false,
        "usage": { "inView": true }
      }
    ]
  },
  
  "state": {
    "variables": [
      {
        "id": "state_user",
        "name": "user",
        "hook": "useState",
        "type": { "kind": "union", "members": ["User", "null"] },
        "initialValue": { "type": "literal", "value": null },
        "setter": "setUser"
      },
      {
        "id": "state_isLoading",
        "name": "isLoading",
        "hook": "useState",
        "type": { "kind": "primitive", "name": "boolean" },
        "initialValue": { "type": "literal", "value": false },
        "setter": "setIsLoading"
      },
      {
        "id": "state_isEditing",
        "name": "isEditing",
        "hook": "useState",
        "type": { "kind": "primitive", "name": "boolean" },
        "initialValue": { "type": "literal", "value": false },
        "setter": "setIsEditing"
      },
      {
        "id": "hook_navigate",
        "name": "navigate",
        "hook": "custom",
        "type": { "kind": "function" },
        "initialValue": { "type": "expression", "expression": "useNavigate()" }
      }
    ]
  },
  
  "computed": {
    "variables": [
      {
        "id": "computed_displayName",
        "name": "displayName",
        "hook": "useMemo",
        "type": { "kind": "primitive", "name": "string" },
        "computation": {
          "body": "if (!user) return '';\nreturn `${user.firstName} ${user.lastName}`;"
        },
        "dependencies": [
          { "name": "user", "source": "state", "sourceId": "state_user" }
        ]
      }
    ]
  },
  
  "effects": [
    {
      "id": "effect_fetchUser",
      "name": "获取用户数据",
      "hook": "useEffect",
      "dependencies": {
        "type": "array",
        "items": [{ "name": "userId", "source": "prop" }]
      },
      "effect": {
        "operations": [
          { "type": "setState", "target": "isLoading", "expression": "setIsLoading(true)" },
          { "type": "apiCall", "expression": "api.getUser(userId)", "async": true },
          { "type": "setState", "target": "user", "expression": "setUser(data)" },
          { "type": "setState", "target": "isLoading", "expression": "setIsLoading(false)" }
        ]
      },
      "timing": { "onMount": true, "onUpdate": true }
    }
  ],
  
  "handlers": [
    {
      "id": "handler_handleEdit",
      "name": "handleEdit",
      "signature": { "params": [], "returnType": "void", "async": false },
      "body": {
        "operations": [
          { "type": "setState", "target": "isEditing", "expression": "setIsEditing(true)" }
        ]
      },
      "dependencies": [],
      "bindings": [{ "nodeId": "button_edit", "eventName": "onClick" }]
    },
    {
      "id": "handler_handleSave",
      "name": "handleSave",
      "signature": { "params": [], "returnType": "void", "async": true },
      "body": {
        "operations": [
          { "type": "return", "condition": "!user" },
          { "type": "apiCall", "expression": "api.updateUser(user)", "async": true },
          { "type": "propCall", "target": "onSave", "expression": "onSave?.(user)" },
          { "type": "setState", "target": "isEditing", "expression": "setIsEditing(false)" }
        ]
      },
      "dependencies": [
        { "name": "user", "source": "state" },
        { "name": "onSave", "source": "prop" }
      ],
      "bindings": [{ "nodeId": "button_save", "eventName": "onClick" }]
    }
  ],
  
  "view": {
    "earlyReturns": [
      {
        "condition": "isLoading",
        "return": {
          "componentName": "div",
          "props": { "className": "loading" },
          "children": [{ "componentName": "Text", "props": { "content": "Loading..." } }]
        }
      }
    ],
    "main": {
      "componentName": "div",
      "id": "div_root",
      "props": { "className": "user-card" },
      "children": [
        {
          "componentName": "h2",
          "id": "h2_title",
          "children": [
            {
              "componentName": "$Expression",
              "expression": { "$expr": "displayName", "$source": "computed" }
            }
          ]
        },
        {
          "componentName": "$Conditional",
          "id": "cond_editBtn",
          "condition": { "expression": "editable && !isEditing" },
          "children": [
            {
              "componentName": "button",
              "id": "button_edit",
              "props": { "onClick": { "$handler": "handleEdit" } },
              "children": [{ "componentName": "Text", "props": { "content": "Edit" } }]
            }
          ]
        },
        {
          "componentName": "$Conditional",
          "id": "cond_saveBtn",
          "condition": { "expression": "isEditing" },
          "children": [
            {
              "componentName": "button",
              "id": "button_save",
              "props": { "onClick": { "$handler": "handleSave" } },
              "children": [{ "componentName": "Text", "props": { "content": "Save" } }]
            }
          ]
        }
      ]
    }
  }
}
```

---

## 11. 可视化编辑面板设计

### 11.1 整体布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Code2Vision - UserCard.tsx                                              │
├───────────┬─────────────────────────────────────────────┬───────────────┤
│           │                                             │               │
│  Structure│              Visual Canvas                  │   Inspector   │
│           │                                             │               │
│  ┌──────┐ │   ┌─────────────────────────────────────┐  │  ┌─────────┐  │
│  │Props │ │   │                                     │  │  │ Props   │  │
│  ├──────┤ │   │         [Visual Preview]            │  │  ├─────────┤  │
│  │State │ │   │                                     │  │  │ State   │  │
│  ├──────┤ │   │   ┌─────────────────────────────┐   │  │  ├─────────┤  │
│  │Compute│ │   │   │  div.user-card             │   │  │  │ Computed│  │
│  ├──────┤ │   │   │  ├─ h2: {displayName}       │   │  │  ├─────────┤  │
│  │Effect│ │   │   │  ├─ ? editable && !isEdit   │   │  │  │ Effects │  │
│  ├──────┤ │   │   │  │  └─ button[Edit]         │   │  │  ├─────────┤  │
│  │Handler│ │   │   │  └─ ? isEditing            │   │  │  │ Handlers│  │
│  ├──────┤ │   │   │     └─ button[Save]         │   │  │  └─────────┘  │
│  │View  │ │   │   └─────────────────────────────┘   │  │               │
│  └──────┘ │   │                                     │  │               │
│           │   └─────────────────────────────────────┘  │               │
│           │                                             │               │
└───────────┴─────────────────────────────────────────────┴───────────────┘
```

### 11.2 逻辑面板交互

**State 面板**:
- 显示所有状态变量
- 可修改初始值
- 显示状态更新来源
- 添加/删除状态

**Effects 面板**:
- 流程图展示副作用
- 编辑依赖项
- 编辑操作序列

**Handlers 面板**:
- 流程图展示处理逻辑
- 编辑条件分支
- 拖拽调整操作顺序

---

## 12. 总结

### 12.1 核心设计要点

| 要点 | 说明 |
|------|------|
| **分层模型** | Props → State → Computed → Effects → Handlers → View |
| **声明式描述** | 将命令式逻辑转换为声明式 Schema |
| **依赖追踪** | 明确数据流向，支持可视化展示 |
| **操作序列化** | 函数体分解为操作序列 |
| **双向绑定** | Schema ↔ 代码的双向转换 |

### 12.2 可视化能力

1. **结构视图**: 组件各层的树形结构
2. **数据流图**: Props/State/Computed 的依赖关系
3. **流程图**: Effects/Handlers 的执行流程
4. **状态追踪**: 状态更新的来源和使用位置

### 12.3 编辑能力

1. **Props 编辑**: 修改类型、默认值
2. **State 编辑**: 添加/修改状态变量
3. **Effect 编辑**: 可视化编辑副作用流程
4. **Handler 编辑**: 拖拽编辑事件处理流程
5. **View 编辑**: 可视化编辑 JSX 结构
