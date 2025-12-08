/**
 * ConditionNode Component
 * Condition branch node (child of IF node)
 * @module components/nodes/ConditionNode
 */

import React, { useMemo } from 'react';
import { CheckCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, FlowConditionNodeType, ConditionNodeProps, ExpressionType } from '../../types';
import { isExpression } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ConditionNodeComponentProps extends Omit<BaseNodeProps, 'node' | 'color' | 'icon'> {
  node: FlowNodeType | FlowConditionNodeType;
  /** Whether this is the default (else) branch */
  isDefault?: boolean;
  /** Branch index */
  branchIndex?: number;
}

// ============================================================================
// Component
// ============================================================================

export const ConditionNode: React.FC<ConditionNodeComponentProps> = ({
  node,
  isDefault = false,
  branchIndex,
  ...props
}) => {
  const conditionProps = node.props as ConditionNodeProps | undefined;
  const expression = conditionProps?.expression;

  // Format expression for display
  const expressionDisplay = useMemo(() => {
    if (!expression) return null;
    
    if (isExpression(expression)) {
      return expression.label || expression.value;
    }
    
    return String(expression);
  }, [expression]);

  // Content
  const content = useMemo(() => {
    if (isDefault) {
      return (
        <div style={{ color: 'rgba(0,0,0,0.45)', fontStyle: 'italic' }}>
          当其他条件都不满足时执行
        </div>
      );
    }

    if (expressionDisplay) {
      return (
        <div>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>条件:</span>
          <code
            style={{
              display: 'block',
              marginTop: 4,
              padding: '4px 8px',
              background: '#f5f5f5',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            {expressionDisplay}
          </code>
        </div>
      );
    }

    return (
      <div style={{ color: 'rgba(0,0,0,0.45)' }}>
        <QuestionCircleOutlined style={{ marginRight: 4 }} />
        未设置条件
      </div>
    );
  }, [isDefault, expressionDisplay]);

  // Title
  const title = useMemo(() => {
    if (conditionProps?.title) return conditionProps.title;
    if (isDefault) return '默认分支';
    if (branchIndex !== undefined) return `条件 ${branchIndex + 1}`;
    return '条件分支';
  }, [conditionProps?.title, isDefault, branchIndex]);

  return (
    <BaseNode
      node={node as FlowNodeType}
      color={isDefault ? 'gray' : 'orange'}
      icon={<CheckCircleOutlined />}
      title={title}
      typeLabel={isDefault ? '默认' : '条件'}
      {...props}
    >
      {content}
    </BaseNode>
  );
};

export default ConditionNode;
