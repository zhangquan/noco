/**
 * FlowRender Component
 * Main component for rendering the flow diagram
 * @module render/FlowRender
 */

import React, { useCallback, useMemo } from 'react';
import { useFlowSchemaStore } from '../states/flowSchemaStore';
import { AddNode } from '../components/plusNodes';
import { getNodeComponent, renderNode } from './component-map-logic';
import type {
  FlowSchemaType,
  FlowNodeType,
  FlowConditionNodeType,
  NodeRendererProps,
} from '../types';
import './FlowRender.scss';

// ============================================================================
// Types
// ============================================================================

export interface FlowRenderProps {
  /** Schema to render (if not using store) */
  schema?: FlowSchemaType | null;
  /** Selected node ID */
  selectedNodeId?: string | null;
  /** Click handler */
  onNodeClick?: (nodeId: string) => void;
  /** Double click handler */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Context menu handler */
  onNodeContextMenu?: (nodeId: string, event: React.MouseEvent) => void;
  /** Whether to show add buttons */
  showAddButtons?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Custom node renderer */
  customRenderer?: (props: NodeRendererProps) => React.ReactNode;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const FlowRender: React.FC<FlowRenderProps> = ({
  schema: propSchema,
  selectedNodeId: propSelectedNodeId,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  showAddButtons = true,
  readOnly = false,
  customRenderer,
  className,
}) => {
  // Get schema from store or props
  const storeSchema = useFlowSchemaStore((state) => state.schema);
  const storeSelectedNodeId = useFlowSchemaStore((state) => state.selectedNodeId);
  const selectNode = useFlowSchemaStore((state) => state.selectNode);
  const mode = useFlowSchemaStore((state) => state.mode);

  const schema = propSchema ?? storeSchema;
  const selectedNodeId = propSelectedNodeId ?? storeSelectedNodeId;
  const isReadOnly = readOnly || mode === 'readonly' || mode === 'preview';

  // Handle node click
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (onNodeClick) {
        onNodeClick(nodeId);
      } else {
        selectNode(nodeId);
      }
    },
    [onNodeClick, selectNode]
  );

  // Render a single node
  const renderFlowNode = useCallback(
    (node: FlowNodeType, depth: number = 0, parentId?: string) => {
      const isSelected = selectedNodeId === node.id;

      const nodeProps: NodeRendererProps = {
        node,
        selected: isSelected,
        disabled: node.disabled,
        depth,
        parentId,
        onClick: handleNodeClick,
        onDoubleClick: onNodeDoubleClick,
      };

      // Use custom renderer if provided
      if (customRenderer) {
        return customRenderer(nodeProps);
      }

      return renderNode(nodeProps);
    },
    [selectedNodeId, handleNodeClick, onNodeDoubleClick, customRenderer]
  );

  // Render actions list
  const renderActions = useCallback(
    (actions: FlowNodeType[], parentId: string, depth: number = 0) => {
      return (
        <div className="flow-render__actions">
          {actions.map((action, index) => (
            <div key={action.id} className="flow-render__action-item">
              {/* Connector line */}
              {index > 0 && <div className="flow-render__connector" />}

              {/* Node */}
              <div className="flow-render__node-wrapper">
                {renderFlowNode(action, depth, parentId)}
              </div>

              {/* Render IF conditions */}
              {action.actionType === 'if' && action.conditions && (
                <div className="flow-render__conditions">
                  {action.conditions.map((condition, condIndex) => (
                    <div key={condition.id} className="flow-render__condition-branch">
                      {/* Condition node */}
                      <div className="flow-render__condition-header">
                        {renderFlowNode(
                          condition as unknown as FlowNodeType,
                          depth + 1,
                          action.id
                        )}
                      </div>

                      {/* Condition actions */}
                      {condition.actions && condition.actions.length > 0 && (
                        <div className="flow-render__condition-actions">
                          {renderActions(condition.actions, condition.id, depth + 2)}
                        </div>
                      )}

                      {/* Add button inside condition */}
                      {showAddButtons && !isReadOnly && (
                        <div className="flow-render__add-wrapper">
                          <AddNode
                            parentId={condition.id}
                            size="small"
                            iconOnly
                            tooltip="添加节点"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Render LOOP children */}
              {action.actionType === 'loop' && action.actions && action.actions.length > 0 && (
                <div className="flow-render__loop-body">
                  {renderActions(action.actions, action.id, depth + 1)}
                </div>
              )}

              {/* Add button after node (for non-container nodes) */}
              {showAddButtons &&
                !isReadOnly &&
                action.actionType !== 'if' &&
                action.actionType !== 'loop' &&
                index === actions.length - 1 && (
                  <div className="flow-render__add-wrapper">
                    <AddNode
                      parentId={parentId}
                      size="small"
                      iconOnly
                      tooltip="添加节点"
                    />
                  </div>
                )}
            </div>
          ))}

          {/* Add button when no actions */}
          {actions.length === 0 && showAddButtons && !isReadOnly && (
            <div className="flow-render__add-wrapper flow-render__add-wrapper--empty">
              <AddNode
                parentId={parentId}
                size="small"
                iconOnly
                tooltip="添加节点"
              />
            </div>
          )}
        </div>
      );
    },
    [renderFlowNode, showAddButtons, isReadOnly]
  );

  // Empty state
  if (!schema) {
    return (
      <div className={`flow-render flow-render--empty ${className || ''}`}>
        <div className="flow-render__empty-state">
          <p>暂无流程数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flow-render ${className || ''}`}>
      <div className="flow-render__container">
        {/* Root event node */}
        <div className="flow-render__root">
          {renderFlowNode(schema as unknown as FlowNodeType, 0)}
        </div>

        {/* Root actions */}
        {schema.actions && (
          <div className="flow-render__root-actions">
            {renderActions(schema.actions, schema.id, 1)}
          </div>
        )}

        {/* Add button for root */}
        {showAddButtons && !isReadOnly && (!schema.actions || schema.actions.length === 0) && (
          <div className="flow-render__add-wrapper flow-render__add-wrapper--root">
            <AddNode
              parentId={schema.id}
              size="default"
              iconOnly={false}
              tooltip="添加第一个节点"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowRender;
