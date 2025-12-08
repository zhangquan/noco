/**
 * Flow Render Component
 * 
 * Renders the flow schema as a visual tree.
 */

import React, { useCallback } from 'react';
import { Space, Divider, Typography, Empty } from 'antd';
import type { FlowSchemaType, FlowNodeType, FlowConditionNodeType, FlowNodeTypes } from '../types';
import { renderNode } from './component-map-logic';
import { AddNode } from '../components/plusNodes/AddNode';
import './FlowRender.scss';

const { Text } = Typography;

export interface FlowRenderProps {
  /** Flow schema to render */
  schema: FlowSchemaType | null;
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Whether in readonly mode */
  readonly?: boolean;
  /** Called when a node is selected */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Called when a node should be deleted */
  onNodeDelete?: (nodeId: string) => void;
  /** Called when a node should be duplicated */
  onNodeDuplicate?: (nodeId: string) => void;
  /** Called to add a new node */
  onNodeAdd?: (parentId: string, type: FlowNodeTypes, index?: number) => void;
}

export const FlowRender: React.FC<FlowRenderProps> = ({
  schema,
  selectedNodeId,
  readonly = false,
  onNodeSelect,
  onNodeDelete,
  onNodeDuplicate,
  onNodeAdd,
}) => {
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      onNodeSelect?.(nodeId);
    },
    [onNodeSelect]
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      onNodeDelete?.(nodeId);
    },
    [onNodeDelete]
  );

  const handleNodeDuplicate = useCallback(
    (nodeId: string) => {
      onNodeDuplicate?.(nodeId);
    },
    [onNodeDuplicate]
  );

  const handleAddNode = useCallback(
    (parentId: string, type: FlowNodeTypes, index?: number) => {
      onNodeAdd?.(parentId, type, index);
    },
    [onNodeAdd]
  );

  /**
   * Render a single action node
   */
  const renderActionNode = (
    node: FlowNodeType,
    parentId: string,
    index: number
  ): React.ReactNode => {
    return (
      <div key={node.id} className="flow-render__node-wrapper">
        {/* Connector line */}
        <div className="flow-render__connector" />
        
        {/* Node */}
        {renderNode(node, {
          selected: selectedNodeId === node.id,
          readonly,
          onClick: () => handleNodeClick(node.id),
          onDelete: () => handleNodeDelete(node.id),
          onDuplicate: () => handleNodeDuplicate(node.id),
          onEdit: () => handleNodeClick(node.id),
        })}

        {/* Nested content for special nodes */}
        {node.actionType === 'if' && node.conditions && (
          <div className="flow-render__conditions">
            {node.conditions.map((condition, condIndex) => 
              renderConditionBranch(
                condition,
                node.id,
                condIndex,
                condIndex === node.conditions!.length - 1
              )
            )}
          </div>
        )}

        {node.actionType === 'loop' && node.actions && (
          <div className="flow-render__loop-body">
            <div className="flow-render__loop-label">
              <Text type="secondary" style={{ fontSize: 11 }}>
                Loop Body
              </Text>
            </div>
            {renderActions(node.actions, node.id)}
            {!readonly && (
              <AddNode
                onSelect={(type) => handleAddNode(node.id, type)}
                disabled={readonly}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render a condition branch
   */
  const renderConditionBranch = (
    condition: FlowConditionNodeType,
    parentId: string,
    index: number,
    isLast: boolean
  ): React.ReactNode => {
    return (
      <div key={condition.id} className="flow-render__condition-branch">
        {/* Condition node */}
        {renderNode(condition, {
          selected: selectedNodeId === condition.id,
          readonly,
          onClick: () => handleNodeClick(condition.id),
          onDelete: () => handleNodeDelete(condition.id),
          onDuplicate: () => handleNodeDuplicate(condition.id),
          onEdit: () => handleNodeClick(condition.id),
          isDefault: isLast && !condition.props?.expression,
        })}

        {/* Actions within this condition */}
        <div className="flow-render__condition-actions">
          {condition.actions && renderActions(condition.actions, condition.id)}
          {!readonly && (
            <AddNode
              onSelect={(type) => handleAddNode(condition.id, type)}
              disabled={readonly}
              buttonStyle="text"
            />
          )}
        </div>
      </div>
    );
  };

  /**
   * Render a list of actions
   */
  const renderActions = (
    actions: FlowNodeType[],
    parentId: string
  ): React.ReactNode => {
    return (
      <div className="flow-render__actions">
        {actions.map((action, index) => renderActionNode(action, parentId, index))}
      </div>
    );
  };

  if (!schema) {
    return (
      <div className="flow-render flow-render--empty">
        <Empty description="No flow schema" />
      </div>
    );
  }

  return (
    <div className="flow-render">
      <div className="flow-render__container">
        {/* Root event node */}
        <div className="flow-render__root">
          {renderNode(schema as unknown as FlowNodeType, {
            selected: selectedNodeId === schema.id,
            readonly,
            onClick: () => handleNodeClick(schema.id),
            onEdit: () => handleNodeClick(schema.id),
          })}
        </div>

        {/* Main flow actions */}
        <div className="flow-render__main">
          {schema.actions && renderActions(schema.actions, schema.id)}
          
          {/* Add node button at the end */}
          {!readonly && (
            <div className="flow-render__add-wrapper">
              <div className="flow-render__connector" />
              <AddNode
                onSelect={(type) => handleAddNode(schema.id, type)}
                disabled={readonly}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlowRender;
