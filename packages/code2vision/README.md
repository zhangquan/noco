# @workspace/code2vision

> TSX 代码可视化展示与操作工具

将 React/TSX 代码转换为可视化界面，支持双向编辑和同步。

## 🎯 项目目标

```
┌─────────────┐                      ┌─────────────┐
│   TSX Code  │  ←── Code2Vision ──→ │   Vision    │
│  (Source)   │                      │  (Visual)   │
└─────────────┘                      └─────────────┘
```

- **Code → Vision**: 解析 TSX 代码，渲染为可视化组件树
- **Vision → Code**: 可视化操作（拖拽、缩放、编辑）同步回代码

## 📋 项目状态

⚠️ **规划阶段** - 请查看 [可行性研究报告](./FEASIBILITY_STUDY.md)

## 🔗 相关包

- [@workspace/flex-parser](../flex-parser) - 布局计算引擎（核心依赖）
- [@workspace/flow-designer](../flow-designer) - 流程设计器（架构参考）

## 📖 文档

- [可行性研究报告](./FEASIBILITY_STUDY.md) - 完整的技术方案和规划
- [TSX 转换技术分析](./TSX_TO_SCHEMA_ANALYSIS.md) - TSX → Schema 转换的深度技术分析

## License

MIT
