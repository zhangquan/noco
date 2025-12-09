# Flex Parser 优化方案

> 本文档分析 `flex-parser` 当前实现的问题，并提出优化方案以提升转换准确率。

## 目录

1. [当前架构分析](#当前架构分析)
2. [问题诊断](#问题诊断)
3. [优化方案](#优化方案)
4. [优先级建议](#优先级建议)

---

## 当前架构分析

### 核心处理流程

```
输入: NodeSchema (绝对定位坐标)
  ↓
layoutParser → processNode (递归处理每个节点)
  ↓
classifyChildren (分类: normal/absolute/hidden/slot)
  ↓
determineLayoutType (判断布局类型: row/column/mix)
  ↓
splitToRow / splitToColumn (分组切分)
  ↓
analyzeSplit (决策最优方向)
  ↓
generateFlexStyle (生成 Flex 样式)
  ↓
输出: NodeSchema (Flex 布局结构)
```

### 核心算法

1. **贪婪累积切分算法** (`split.ts`)
   - 按边缘坐标排序 (bottom 或 right)
   - 逐个累积元素到当前组
   - 动态容差判断切分点

2. **布局方向决策** (`checkLayout.ts`)
   - 三因素评估: 组数量、对齐分数、边距距离
   - 硬编码阈值比较

3. **对齐检测** (`checkLayout.ts`)
   - 计算边距差异判断对齐方式
   - 百分比容差 + 最小值下限

---

## 问题诊断

### 问题1: 切分算法的局限性

#### 1.1 贪婪算法产生次优切分

**现状**:
```typescript
// split.ts:165-224
for (let i = 0; i < prepared.length; i++) {
  // 更新当前组的边界
  if (current.frame.bottom! > currentGroupBottom) {
    currentGroupBottom = current.frame.bottom!;
  }
  // 检查是否可以在此处切分
  if (gap >= tolerance) {
    // 切分...
  }
}
```

**问题**:
- 单向遍历，无法回溯
- 无法处理需要"跳跃"分组的复杂布局
- 对于网格布局可能产生错误的行/列划分

**示例问题场景**:
```
┌───┐ ┌───┐ ┌───┐
│ A │ │ B │ │ C │
└───┘ └───┘ └───┘
┌───┐     ┌─────┐
│ D │     │  E  │
└───┘     └─────┘
```
当前算法可能无法正确识别 D 和 E 应该在同一行。

#### 1.2 动态容差计算过于简化

**现状**:
```typescript
// 行切分容差
const dynamicTolerance = -Math.min(currentHeight, remainingHeight) / 5;
const tolerance = Math.min(dynamicTolerance, ROW_MARGIN_DIS);

// 列切分容差
const dynamicTolerance = -Math.min(currentWidth, remainingWidth) / 4;
const tolerance = Math.min(dynamicTolerance, COLUMN_MARGIN_DIS);
```

**问题**:
- 固定除数 (4/5) 不能适应不同设计模式
- 未考虑整体布局上下文
- 基础容差 `ROW_MARGIN_DIS = -1` 过于宽松

#### 1.3 单次切分限制

**问题**:
- 仅进行一次行切分和一次列切分尝试
- 无法尝试不同的切分策略
- 缺少回溯或多方案比较机制

---

### 问题2: 布局方向决策问题

#### 2.1 决策因素权重固定

**现状**:
```typescript
// checkLayout.ts:626-664
if (rowGroups > colGroups + 1) {
  return { direction: 'column', result: rowSplit };
}
// ...
if (rowAlign < colAlign - 5) {
  return { direction: 'column', result: rowSplit };
}
// ...
if (rowMargin > colMargin + 5) {
  return { direction: 'column', result: rowSplit };
}
```

**问题**:
- 阈值硬编码 (如 `+1`, `-5`, `+5`)
- 未考虑设计意图或视觉语义
- 决策顺序影响结果，但顺序设计缺乏理论依据

#### 2.2 Grid 布局检测未被使用

**现状**:
```typescript
// detectGridPattern 存在但未在主流程中调用
export function detectGridPattern(children: NodeSchema[]): {
  isGrid: boolean;
  columns: number;
  rows: number;
}
```

**问题**:
- 网格布局被强制转换为嵌套 Flex
- 输出更复杂且语义不清
- 未利用 CSS Grid 的优势

#### 2.3 循环元素方向判断反直觉

**现状**:
```typescript
// checkLayout.ts:109-119
const loopChild = children.find(hasLoop);
if (loopChild) {
  const loopFrame = getNodeFrame(loopChild);
  if (loopFrame) {
    const isWide = loopFrame.width > loopFrame.height;
    return {
      layoutType: isWide ? 'column' : 'row', // 宽的返回 column?
      // ...
    };
  }
}
```

**问题**:
- 宽元素返回 `column` 方向，逻辑可能颠倒
- 未考虑循环内容的实际排列方式
- 单个元素的宽高比不能代表循环后的布局

---

### 问题3: 对齐检测问题

#### 3.1 容差计算不合理

**现状**:
```typescript
// checkLayout.ts:191-192
const horizontalTolerance = Math.max(5, parent.width * 0.05);
const verticalTolerance = Math.max(5, parent.height * 0.05);
```

**问题**:
- 小容器中 5px 可能过大
- 大容器中 5% 可能不够
- 未考虑元素数量和分布

#### 3.2 Space-between 检测过于严格

**现状**:
```typescript
// checkLayout.ts:202-210
if (children.length > 2) {
  const allGapsEqual = columnSplit.gaps.every(g => Math.abs(g - avgGap) < 10);
  if (allGapsEqual && leftMargin < horizontalTolerance && rightMargin < horizontalTolerance) {
    alignHorizontal = 'space-between';
  }
}
```

**问题**:
- 10px 硬编码容差
- 只处理 `children.length > 2` 的情况
- 未考虑近似相等的间距

---

### 问题4: 重叠检测问题

#### 4.1 两阶段重叠检测逻辑混乱

**现状**:
```typescript
// checkLayout.ts:54-79
if (childFrame && framesOverlap(childFrame, otherFrame, -5)) {
  hasOverlap = true;
  // ...
}
if (hasOverlap) {
  if (otherFrame && framesOverlap(childFrame, otherFrame, -10)) {
    significantOverlap = true;
  }
  if (significantOverlap) {
    absolute.push(child);
  }
}
```

**问题**:
- 魔法数字 (-5, -10) 缺乏解释
- 两次检测的目的不清晰
- 轻微重叠的元素分类可能不准确

#### 4.2 O(n²) 复杂度

**问题**:
- 对于每个子元素检查所有其他元素
- 大量元素时性能下降
- 可使用空间索引优化

---

### 问题5: Gap 计算问题

#### 5.1 使用最小正值不够准确

**现状**:
```typescript
// checkLayout.ts:259-270
export function calculateOptimalGap(gaps: number[]): number {
  const positiveGaps = gaps.filter(g => g > 0);
  if (positiveGaps.length === 0) return 0;
  const minGap = Math.min(...positiveGaps);
  return Math.round(minGap);
}
```

**问题**:
- 最小值可能是异常值
- 应考虑间距分布和方差
- 不同元素间的间距应有不同权重

#### 5.2 非均匀间距处理不足

**问题**:
- 只生成统一的 `gap` 属性
- 对于不均匀间距，应使用 `margin`
- 未检测间距模式 (如渐变间距)

---

### 问题6: 样式生成问题

#### 6.1 固定像素尺寸

**现状**:
```typescript
// style.ts:220-231
if (!widthGrow) {
  style.width = frame.width;
} else {
  Object.assign(style, generateWidthStyle(widthGrow, frame));
}
```

**问题**:
- 未考虑响应式设计
- 所有尺寸转为固定像素
- 应检测是否应使用百分比或弹性单位

#### 6.2 缺少比例/百分比支持

**问题**:
- 设计稿中的比例关系丢失
- `1:2:1` 这样的布局无法表达
- 应推断并保留比例关系

---

### 问题7: 递归处理问题

#### 7.1 上下文丢失

**现状**:
```typescript
// calculateLayout.ts:80-98
const processedGroups = layoutResult.groups.map(group => {
  if (group.length === 1) {
    return processNode(group[0], { ... });
  } else {
    return group.map(child => processNode(child, { ... }));
  }
});
result.children = processedGroups.flat();
```

**问题**:
- 多元素组被 flatten 后失去分组信息
- 可能需要的包装元素未被创建
- 层级结构可能被破坏

#### 7.2 缺少跨层优化

**问题**:
- 每层独立处理
- 未利用父子关系优化决策
- 可能产生冗余嵌套

---

### 问题8: 缺失功能

#### 8.1 无 CSS Grid 支持
- 网格布局只能用嵌套 Flex 表示
- 复杂度增加，语义性下降

#### 8.2 无旋转/变形处理
- 旋转元素的边界框计算不正确

#### 8.3 无文本特殊处理
- 文本内容有不同的布局特性

#### 8.4 无约束分析
- 设计工具的约束信息 (top, bottom, left, right) 未被利用

---

## 优化方案

### 方案1: 多策略切分与评估

**目标**: 解决贪婪算法的局限性

**实现思路**:
```typescript
interface SplitStrategy {
  name: string;
  execute: (nodes: NodeSchema[]) => SplitResult;
  score: (result: SplitResult, context: LayoutContext) => number;
}

function multiStrategySplit(nodes: NodeSchema[]): SplitResult {
  const strategies: SplitStrategy[] = [
    new GreedySplitStrategy(),      // 当前算法
    new ClusteringSplitStrategy(),   // 基于聚类的切分
    new GridAlignedSplitStrategy(),  // 网格对齐切分
    new CenterLineSplitStrategy(),   // 中心线切分
  ];
  
  const results = strategies.map(s => ({
    result: s.execute(nodes),
    score: s.score(result, context)
  }));
  
  return results.sort((a, b) => b.score - a.score)[0].result;
}
```

**新增切分策略**:

1. **聚类切分策略**
   - 使用 K-means 或层次聚类
   - 基于元素位置和尺寸聚类
   - 适合非规则布局

2. **网格对齐切分策略**
   - 检测元素的网格对齐模式
   - 按网格线切分
   - 适合规整设计

3. **中心线切分策略**
   - 使用元素中心线而非边缘
   - 减少边缘不对齐的影响
   - 适合中心对齐设计

**评分函数设计**:
```typescript
function calculateSplitScore(result: SplitResult, context: LayoutContext): number {
  let score = 0;
  
  // 1. 组均衡性 (各组元素数量相近)
  const sizes = result.groups.map(g => g.length);
  const variance = calculateVariance(sizes);
  score += 100 / (1 + variance);
  
  // 2. 间距一致性
  const gapVariance = calculateVariance(result.gaps);
  score += 50 / (1 + gapVariance);
  
  // 3. 对齐质量
  score += 50 * (1 - result.minAlignDis / 100);
  
  // 4. 边界清晰度 (最小间距)
  score += result.minMarginDis?.distance || 0;
  
  return score;
}
```

---

### 方案2: 自适应容差计算

**目标**: 替换硬编码容差，提升适应性

**实现思路**:
```typescript
interface ToleranceFactors {
  elementSize: number;     // 元素尺寸因子
  elementCount: number;    // 元素数量因子  
  layoutDensity: number;   // 布局密度因子
  uniformity: number;      // 均匀度因子
}

function calculateAdaptiveTolerance(
  nodes: NodeSchema[],
  direction: 'row' | 'column',
  context: LayoutContext
): number {
  const factors = analyzeLayoutFactors(nodes);
  
  // 基础容差 = 平均元素尺寸的比例
  const avgSize = direction === 'row' 
    ? calculateAverageHeight(nodes)
    : calculateAverageWidth(nodes);
  let baseTolerance = avgSize * 0.1;
  
  // 根据元素数量调整 (多元素时更严格)
  baseTolerance *= Math.pow(0.9, nodes.length - 2);
  
  // 根据布局密度调整 (密集时更宽松)
  const density = calculateLayoutDensity(nodes, context.parentFrame);
  if (density > 0.7) {
    baseTolerance *= 1.5;
  }
  
  // 根据均匀度调整 (规整时更严格)
  if (factors.uniformity > 0.8) {
    baseTolerance *= 0.5;
  }
  
  return Math.max(1, Math.min(baseTolerance, avgSize * 0.25));
}
```

---

### 方案3: Grid 布局支持

**目标**: 识别并生成 CSS Grid 布局

**实现思路**:
```typescript
interface GridAnalysis {
  isGrid: boolean;
  columns: number;
  rows: number;
  columnWidths: number[];
  rowHeights: number[];
  gaps: { row: number; column: number };
  cells: Map<string, NodeSchema>; // "row-col" -> node
}

function analyzeGridLayout(children: NodeSchema[]): GridAnalysis | null {
  // 1. 提取唯一的 X/Y 位置 (带容差)
  const xPositions = extractUniquePositions(children, 'x');
  const yPositions = extractUniquePositions(children, 'y');
  
  if (xPositions.length < 2 || yPositions.length < 2) {
    return null;
  }
  
  // 2. 验证网格覆盖率
  const expectedCells = xPositions.length * yPositions.length;
  const actualCells = children.length;
  const coverage = actualCells / expectedCells;
  
  // 允许不完整网格 (>=50% 覆盖率)
  if (coverage < 0.5) {
    return null;
  }
  
  // 3. 分析列宽和行高
  const columnWidths = analyzeColumnWidths(children, xPositions);
  const rowHeights = analyzeRowHeights(children, yPositions);
  
  // 4. 分析间距
  const gaps = analyzeGridGaps(children, xPositions, yPositions);
  
  return {
    isGrid: true,
    columns: xPositions.length,
    rows: yPositions.length,
    columnWidths,
    rowHeights,
    gaps,
    cells: mapCellsToNodes(children, xPositions, yPositions)
  };
}

function generateGridStyle(analysis: GridAnalysis): StyleProps {
  const style: StyleProps = {
    display: 'grid',
  };
  
  // 生成 grid-template-columns
  const templateColumns = analysis.columnWidths.map(w => {
    // 检测是否使用 fr 单位
    const avgWidth = average(analysis.columnWidths);
    if (Math.abs(w - avgWidth) < 5) {
      return '1fr';
    }
    return `${w}px`;
  }).join(' ');
  
  style.gridTemplateColumns = templateColumns;
  
  // 生成 grid-template-rows
  const templateRows = analysis.rowHeights.map(h => {
    const avgHeight = average(analysis.rowHeights);
    if (Math.abs(h - avgHeight) < 5) {
      return '1fr';
    }
    return `${h}px`;
  }).join(' ');
  
  style.gridTemplateRows = templateRows;
  
  // 间距
  if (analysis.gaps.row > 0 || analysis.gaps.column > 0) {
    style.gap = `${analysis.gaps.row}px ${analysis.gaps.column}px`;
  }
  
  return style;
}
```

---

### 方案4: 语义对齐识别

**目标**: 更准确地识别设计意图中的对齐方式

**实现思路**:
```typescript
interface AlignmentAnalysis {
  horizontal: {
    type: 'left' | 'center' | 'right' | 'justify' | 'space-between' | 'space-around' | 'space-evenly';
    confidence: number;
  };
  vertical: {
    type: 'top' | 'middle' | 'bottom' | 'stretch' | 'baseline';
    confidence: number;
  };
}

function analyzeAlignment(
  parentFrame: Frame,
  children: NodeSchema[]
): AlignmentAnalysis {
  const frames = children.map(c => getNodeFrame(c)).filter(Boolean);
  const boundingFrame = getBoundingFrame(frames);
  
  // 计算各种对齐的匹配度
  const horizontalScores = {
    left: calculateLeftAlignScore(parentFrame, frames),
    center: calculateCenterAlignScore(parentFrame, boundingFrame),
    right: calculateRightAlignScore(parentFrame, frames),
    justify: calculateJustifyScore(parentFrame, frames),
    'space-between': calculateSpaceBetweenScore(parentFrame, frames),
    'space-around': calculateSpaceAroundScore(parentFrame, frames),
    'space-evenly': calculateSpaceEvenlyScore(parentFrame, frames),
  };
  
  // 选择得分最高的对齐方式
  const [hType, hScore] = Object.entries(horizontalScores)
    .sort(([, a], [, b]) => b - a)[0];
  
  // ... vertical 类似处理
  
  return {
    horizontal: { type: hType, confidence: hScore },
    vertical: { type: vType, confidence: vScore }
  };
}

function calculateSpaceBetweenScore(parent: Frame, frames: Frame[]): number {
  if (frames.length < 2) return 0;
  
  // 按位置排序
  const sorted = [...frames].sort((a, b) => a.left - b.left);
  
  // 计算间距
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].left - sorted[i - 1].right!);
  }
  
  // 计算间距方差
  const avgGap = average(gaps);
  const variance = calculateVariance(gaps);
  const coeffVar = variance / avgGap; // 变异系数
  
  // 检查首尾边距是否很小
  const leftMargin = sorted[0].left - parent.left;
  const rightMargin = parent.right! - sorted[sorted.length - 1].right!;
  const marginScore = 1 - (leftMargin + rightMargin) / parent.width;
  
  // 综合评分: 间距均匀 + 首尾贴边
  return (1 - coeffVar) * 0.6 + marginScore * 0.4;
}

function calculateSpaceEvenlyScore(parent: Frame, frames: Frame[]): number {
  if (frames.length < 2) return 0;
  
  const sorted = [...frames].sort((a, b) => a.left - b.left);
  
  // space-evenly: 所有间距相等，包括边距
  const leftMargin = sorted[0].left - parent.left;
  const rightMargin = parent.right! - sorted[sorted.length - 1].right!;
  
  const allGaps = [leftMargin, rightMargin];
  for (let i = 1; i < sorted.length; i++) {
    allGaps.push(sorted[i].left - sorted[i - 1].right!);
  }
  
  const avgGap = average(allGaps);
  const variance = calculateVariance(allGaps);
  
  return 1 - (variance / avgGap);
}
```

---

### 方案5: 智能尺寸推断

**目标**: 推断最合适的尺寸表示方式

**实现思路**:
```typescript
type SizeType = 'fixed' | 'percentage' | 'flex' | 'auto' | 'fit-content';

interface SizeAnalysis {
  width: { type: SizeType; value: string | number };
  height: { type: SizeType; value: string | number };
}

function analyzeSizing(
  node: NodeSchema,
  siblings: NodeSchema[],
  parentFrame: Frame
): SizeAnalysis {
  const frame = getNodeFrame(node);
  if (!frame) {
    return { width: { type: 'auto', value: 'auto' }, height: { type: 'auto', value: 'auto' } };
  }
  
  // 分析宽度
  const widthAnalysis = analyzeWidthType(frame, siblings, parentFrame);
  
  // 分析高度
  const heightAnalysis = analyzeHeightType(frame, siblings, parentFrame);
  
  return { width: widthAnalysis, height: heightAnalysis };
}

function analyzeWidthType(
  frame: Frame,
  siblings: NodeSchema[],
  parentFrame: Frame
): { type: SizeType; value: string | number } {
  const siblingFrames = siblings.map(s => getNodeFrame(s)).filter(Boolean);
  
  // 1. 检查是否填满父容器 (±5px)
  if (Math.abs(frame.width - parentFrame.width) < 5) {
    return { type: 'percentage', value: '100%' };
  }
  
  // 2. 检查是否是父容器的整数比例
  const ratio = frame.width / parentFrame.width;
  const nearestFraction = findNearestFraction(ratio);
  if (nearestFraction && Math.abs(ratio - nearestFraction.decimal) < 0.02) {
    return { type: 'percentage', value: `${nearestFraction.percentage}%` };
  }
  
  // 3. 检查与兄弟元素的比例关系
  if (siblingFrames.length > 0) {
    const widths = [frame.width, ...siblingFrames.map(f => f!.width)];
    const ratios = findCommonRatios(widths);
    if (ratios.isValid) {
      return { type: 'flex', value: ratios.values[0] };
    }
  }
  
  // 4. 检查内容适配
  if (node.componentName === 'Text' || node.children?.length === 0) {
    return { type: 'fit-content', value: 'fit-content' };
  }
  
  // 5. 默认固定尺寸
  return { type: 'fixed', value: frame.width };
}

function findCommonRatios(values: number[]): { isValid: boolean; values: number[] } {
  // 尝试找到简单整数比例 (1:1, 1:2, 2:3 等)
  const min = Math.min(...values);
  const normalized = values.map(v => v / min);
  
  // 四舍五入到最近的 0.5
  const rounded = normalized.map(n => Math.round(n * 2) / 2);
  
  // 检查是否与原值接近
  const isValid = normalized.every((n, i) => Math.abs(n - rounded[i]) < 0.1);
  
  return { isValid, values: rounded };
}
```

---

### 方案6: 约束感知布局分析

**目标**: 利用设计工具中的约束信息

**实现思路**:
```typescript
interface Constraints {
  horizontal: 'left' | 'right' | 'left-right' | 'center' | 'scale';
  vertical: 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';
}

function inferConstraints(
  childFrame: Frame,
  parentFrame: Frame
): Constraints {
  const leftDist = childFrame.left - parentFrame.left;
  const rightDist = parentFrame.right! - childFrame.right!;
  const topDist = childFrame.top - parentFrame.top;
  const bottomDist = parentFrame.bottom! - childFrame.bottom!;
  
  // 水平约束推断
  let horizontal: Constraints['horizontal'];
  const hTolerance = parentFrame.width * 0.05;
  
  if (leftDist < hTolerance && rightDist < hTolerance) {
    horizontal = 'left-right'; // 两边拉伸
  } else if (Math.abs(leftDist - rightDist) < hTolerance) {
    horizontal = 'center'; // 居中
  } else if (leftDist < rightDist * 0.5) {
    horizontal = 'left'; // 左对齐
  } else if (rightDist < leftDist * 0.5) {
    horizontal = 'right'; // 右对齐
  } else {
    horizontal = 'scale'; // 比例缩放
  }
  
  // ... vertical 类似处理
  
  return { horizontal, vertical };
}

function applyConstraintStyles(
  constraints: Constraints,
  frame: Frame,
  parentFrame: Frame
): StyleProps {
  const style: StyleProps = {};
  
  switch (constraints.horizontal) {
    case 'left':
      style.marginRight = 'auto';
      break;
    case 'right':
      style.marginLeft = 'auto';
      break;
    case 'center':
      style.marginLeft = 'auto';
      style.marginRight = 'auto';
      break;
    case 'left-right':
      style.width = '100%';
      break;
    case 'scale':
      style.width = `${(frame.width / parentFrame.width) * 100}%`;
      break;
  }
  
  // ... vertical 类似处理
  
  return style;
}
```

---

### 方案7: 增量处理与缓存优化

**目标**: 提升处理性能，支持增量更新

**实现思路**:
```typescript
class LayoutCache {
  private cache = new Map<string, CachedResult>();
  
  getCacheKey(node: NodeSchema): string {
    // 基于节点结构和位置生成 hash
    return hash({
      frame: node.frame,
      childFrames: node.children?.map(c => c.frame),
      xLayout: node['x-layout'],
    });
  }
  
  get(node: NodeSchema): CachedResult | undefined {
    return this.cache.get(this.getCacheKey(node));
  }
  
  set(node: NodeSchema, result: CachedResult): void {
    this.cache.set(this.getCacheKey(node), result);
  }
}

// 使用 R-Tree 优化重叠检测
class SpatialIndex {
  private tree: RBush<IndexedFrame>;
  
  constructor(nodes: NodeSchema[]) {
    this.tree = new RBush();
    nodes.forEach((node, index) => {
      const frame = getNodeFrame(node);
      if (frame) {
        this.tree.insert({
          minX: frame.left,
          minY: frame.top,
          maxX: frame.right!,
          maxY: frame.bottom!,
          index
        });
      }
    });
  }
  
  findOverlapping(frame: Frame, tolerance: number = 0): number[] {
    return this.tree.search({
      minX: frame.left - tolerance,
      minY: frame.top - tolerance,
      maxX: frame.right! + tolerance,
      maxY: frame.bottom! + tolerance
    }).map(r => r.index);
  }
}
```

---

### 方案8: 后处理优化

**目标**: 简化生成的布局结构

**实现思路**:
```typescript
function optimizeGeneratedLayout(schema: NodeSchema): NodeSchema {
  return pipe(
    schema,
    removeUnnecessaryWrappers,
    mergeNestedFlexContainers,
    simplifyStyles,
    removeRedundantValues
  );
}

function removeUnnecessaryWrappers(schema: NodeSchema): NodeSchema {
  // 移除只有一个子元素的纯布局容器
  return mapTree(schema, node => {
    if (
      node.children?.length === 1 &&
      isPureLayoutContainer(node) &&
      !hasSignificantStyle(node)
    ) {
      // 将样式合并到子元素
      const child = node.children[0];
      child.props = mergeStyles(node.props, child.props);
      return child;
    }
    return node;
  });
}

function mergeNestedFlexContainers(schema: NodeSchema): NodeSchema {
  // 合并同方向的嵌套 Flex 容器
  return mapTree(schema, node => {
    if (node.layoutType && node.children?.length === 1) {
      const child = node.children[0];
      if (child.layoutType === node.layoutType) {
        // 合并父子容器
        return {
          ...node,
          children: child.children,
          props: mergeStyles(node.props, child.props)
        };
      }
    }
    return node;
  });
}

function simplifyStyles(schema: NodeSchema): NodeSchema {
  return mapTree(schema, node => {
    if (node.props?.style) {
      const style = node.props.style;
      
      // 合并 padding
      if (style.paddingTop === style.paddingRight &&
          style.paddingRight === style.paddingBottom &&
          style.paddingBottom === style.paddingLeft) {
        style.padding = style.paddingTop;
        delete style.paddingTop;
        delete style.paddingRight;
        delete style.paddingBottom;
        delete style.paddingLeft;
      }
      
      // 移除默认值
      if (style.flexDirection === 'row') delete style.flexDirection;
      if (style.justifyContent === 'flex-start') delete style.justifyContent;
      if (style.alignItems === 'stretch') delete style.alignItems;
    }
    return node;
  });
}
```

---

## 优先级建议

### P0 - 核心算法改进 (影响准确率最大)

| 优化项 | 预期收益 | 复杂度 | 建议 |
|-------|---------|--------|------|
| 多策略切分与评估 | ⭐⭐⭐⭐⭐ | 高 | 首选实施 |
| 自适应容差计算 | ⭐⭐⭐⭐ | 中 | 优先实施 |
| 语义对齐识别 | ⭐⭐⭐⭐ | 中 | 优先实施 |

### P1 - 功能增强 (提升表达能力)

| 优化项 | 预期收益 | 复杂度 | 建议 |
|-------|---------|--------|------|
| Grid 布局支持 | ⭐⭐⭐⭐ | 高 | 规整布局场景必需 |
| 智能尺寸推断 | ⭐⭐⭐ | 中 | 响应式支持必需 |
| 约束感知布局 | ⭐⭐⭐ | 中 | 设计工具集成时必需 |

### P2 - 性能与质量 (提升可用性)

| 优化项 | 预期收益 | 复杂度 | 建议 |
|-------|---------|--------|------|
| 增量处理与缓存 | ⭐⭐⭐ | 中 | 大规模使用时实施 |
| 后处理优化 | ⭐⭐ | 低 | 可快速实施 |

---

## 验证指标

建议建立以下测试集和指标来评估优化效果:

### 测试用例分类

1. **基础布局** (30%)
   - 单行/单列布局
   - 均匀间距布局
   - 简单嵌套布局

2. **复杂布局** (40%)
   - 网格布局
   - 混合方向布局
   - 非规则布局

3. **边界情况** (30%)
   - 重叠元素
   - 极端间距
   - 单元素/空容器

### 评估指标

```typescript
interface EvaluationMetrics {
  // 布局准确率: 布局类型判断正确的节点比例
  layoutAccuracy: number;
  
  // 对齐准确率: 对齐方式判断正确的比例
  alignmentAccuracy: number;
  
  // 视觉还原度: 渲染结果与原始设计的像素差异
  visualFidelity: number;
  
  // 代码质量: 生成代码的复杂度评分
  codeQuality: number;
  
  // 处理速度: 每秒处理的节点数
  processingSpeed: number;
}
```

---

## 附录: 关键代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| 主入口 | `calculateLayout.ts` | `layoutParser`: 237-255 |
| 节点处理 | `calculateLayout.ts` | `processNode`: 41-228 |
| 子元素分类 | `checkLayout.ts` | `classifyChildren`: 23-86 |
| 布局类型判断 | `checkLayout.ts` | `determineLayoutType`: 91-156 |
| 行切分 | `split.ts` | `splitToRow`: 165-258 |
| 列切分 | `split.ts` | `splitToColumn`: 272-365 |
| 切分分析 | `split.ts` | `analyzeSplit`: 616-679 |
| 对齐检测 | `checkLayout.ts` | `detectAlignment`: 161-232 |
| Flex 样式生成 | `style.ts` | `generateFlexStyle`: 164-234 |
| 子元素样式生成 | `style.ts` | `generateChildStyle`: 239-307 |
