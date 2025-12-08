/**
 * IfNode Component
 * Conditional branch node
 * @module components/nodes/IfNode
 */

import React, { useMemo, useCallback } from 'react';
import { BranchesOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import { useFlowSchemaStore } from '../../states/flowSchemaStore';
import type { FlowNodeType, FlowConditionNodeType, ConditionNodeProps } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface IfNodeComponentProps extends Omit<BaseNodeProps, 'node' | 'color' | 'icon'> {
  node: FlowNodeType;
  /** Render function for condition branches */
  renderBranch?: (branch: FlowConditionNodeType, index: number) => React.ReactNode;
  /** Whether to show add branch button */
  showAddBranch?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const IfNode: React.FC<IfNodeComponentProps> = ({
  node,
  renderBranch,
  showAddBranch = true,
  ...props
}) => {
  const addConditionBranch = useFlowSchemaStore((state) => state.addConditionBranch);
  const mode = useFlowSchemaStore((state) => state.mode);
  
  const conditions = node.conditions || [];
  const isReadOnly = mode === 'readonly' || mode === 'preview';

  // Handle add branch
  const handleAddBranch = useCallback(() => {
    addConditionBranch(node.id, {
      props: { title: `条件 ${conditions.length}` },
    });
  }, [node.id, conditions.length, addConditionBranch]);

  // Content
  const content = useMemo(() => {
    return (
      <div className="if-node-branches">
        <div style={{ color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>
          {conditions.length} 个分支
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {conditions.map((branch, index) => {
            const branchProps = branch.props as ConditionNodeProps | undefined;
            const isDefault = index === conditions.length - 1;
            return (
              <span
                key={branch.id}
                style={{
                  padding: '2px 8px',
                  background: isDefault ? '#f5f5f5' : '#e6f4ff',
                  borderRadius: 4,
                  fontSize: 12,
                  color: isDefault ? 'rgba(0,0,0,0.45)' : '#1677ff',
                }}
              >
                {branchProps?.title || (isDefault ? '默认' : `条件 ${index + 1}`)}
              </span>
            );
          })}
        </div>
      </div>
    );
  }, [conditions]);

  // Actions
  const actions = useMemo(() => {
    if (!showAddBranch || isReadOnly) return null;
    return (
      <Tooltip title="添加条件分支">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleAddBranch();
          }}
        />
      </Tooltip>
    );
  }, [showAddBranch, isReadOnly, handleAddBranch]);

  return (
    <BaseNode
      node={node}
      color="orange"
      icon={<BranchesOutlined />}
      typeLabel="条件"
      actions={actions}
      {...props}
    >
      {content}
    </BaseNode>
  );
};

export default IfNode;
