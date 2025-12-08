/**
 * BaseNode Component
 * Base component for all flow nodes
 * @module components/nodes/BaseNode
 */

import React, { useCallback, useMemo } from 'react';
import { useFlowSchemaStore } from '../../../states/flowSchemaStore';
import type { FlowNodeType, FlowNodeTypes } from '../../../types';
import './styles.scss';

// ============================================================================
// Types
// ============================================================================

export interface BaseNodeProps {
  /** The node to render */
  node: FlowNodeType;
  /** Whether the node is selected */
  selected?: boolean;
  /** Whether the node is disabled */
  disabled?: boolean;
  /** Depth level in the tree */
  depth?: number;
  /** Parent node ID */
  parentId?: string;
  /** Node title */
  title?: string;
  /** Node icon */
  icon?: React.ReactNode;
  /** Node type label */
  typeLabel?: string;
  /** Node color theme */
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray';
  /** Click handler */
  onClick?: (nodeId: string) => void;
  /** Double click handler */
  onDoubleClick?: (nodeId: string) => void;
  /** Context menu handler */
  onContextMenu?: (nodeId: string, event: React.MouseEvent) => void;
  /** Whether to show actions menu */
  showActions?: boolean;
  /** Custom actions */
  actions?: React.ReactNode;
  /** Children content */
  children?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const BaseNode: React.FC<BaseNodeProps> = ({
  node,
  selected = false,
  disabled = false,
  depth = 0,
  parentId,
  title,
  icon,
  typeLabel,
  color = 'blue',
  onClick,
  onDoubleClick,
  onContextMenu,
  showActions = true,
  actions,
  children,
  footer,
  className,
}) => {
  // State
  const selectNode = useFlowSchemaStore((state) => state.selectNode);
  const setHoveredNode = useFlowSchemaStore((state) => state.setHoveredNode);
  const hoveredNodeId = useFlowSchemaStore((state) => state.hoveredNodeId);
  const mode = useFlowSchemaStore((state) => state.mode);

  const isHovered = hoveredNodeId === node.id;
  const isReadOnly = mode === 'readonly' || mode === 'preview';

  // Handlers
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      
      if (onClick) {
        onClick(node.id);
      } else {
        selectNode(node.id);
      }
    },
    [node.id, disabled, onClick, selectNode]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      onDoubleClick?.(node.id);
    },
    [node.id, disabled, onDoubleClick]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isReadOnly) return;
      onContextMenu?.(node.id, e);
    },
    [node.id, disabled, isReadOnly, onContextMenu]
  );

  const handleMouseEnter = useCallback(() => {
    setHoveredNode(node.id);
  }, [node.id, setHoveredNode]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  // Display title
  const displayTitle = useMemo(() => {
    return title || (node.props as { title?: string })?.title || getDefaultTitle(node.actionType);
  }, [title, node.props, node.actionType]);

  // CSS classes
  const nodeClasses = useMemo(() => {
    const classes = ['flow-node', `flow-node--${color}`];
    if (selected) classes.push('flow-node--selected');
    if (disabled) classes.push('flow-node--disabled');
    if (isHovered) classes.push('flow-node--hovered');
    if (node.disabled) classes.push('flow-node--node-disabled');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [color, selected, disabled, isHovered, node.disabled, className]);

  return (
    <div
      className={nodeClasses}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-node-id={node.id}
      data-node-type={node.actionType}
      data-depth={depth}
      role="button"
      tabIndex={0}
      aria-selected={selected}
      aria-disabled={disabled}
    >
      {/* Header */}
      <div className="flow-node__header">
        {icon && <span className="flow-node__icon">{icon}</span>}
        <span className="flow-node__title">{displayTitle}</span>
        {typeLabel && <span className="flow-node__type">{typeLabel}</span>}
        {showActions && !isReadOnly && (isHovered || selected) && (
          <div className="flow-node__actions">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      {children && <div className="flow-node__content">{children}</div>}

      {/* Footer */}
      {footer && <div className="flow-node__footer">{footer}</div>}

      {/* Selection indicator */}
      {selected && <div className="flow-node__selection-ring" />}
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default title for node type
 */
function getDefaultTitle(actionType: FlowNodeTypes): string {
  const titles: Record<string, string> = {
    event: '事件触发',
    dataInsert: '插入数据',
    dataList: '查询数据',
    dataUpdate: '更新数据',
    dataDelete: '删除数据',
    if: '条件判断',
    condition: '条件分支',
    loop: '循环',
    var: '变量',
    fn: '函数',
    http: 'HTTP 请求',
    delay: '延时',
    end: '结束',
  };
  return titles[actionType] || actionType;
}

export default BaseNode;
