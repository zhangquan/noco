/**
 * Flow Designer Component
 * 
 * Main component for visual flow editing.
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { Layout, Button, Space, Tooltip, Divider, Typography } from 'antd';
import {
  SaveOutlined,
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import type { FlowDesignerProps, FlowSchemaType, FlowNodeTypes, FlowNodeProps } from './types';
import { useFlowSchemaStore } from './states/flowSchemaStore';
import { FlowRender } from './render/FlowRender';
import { SetterPanel } from './setter';
import { createDefaultSchema, getNode } from './model/logic-model';
import { useSchemaUpload } from './states/useSchemaUpload';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

export const FlowDesigner: React.FC<FlowDesignerProps> = ({
  schema: initialSchema,
  flowId,
  readonly = false,
  tables = [],
  views = {},
  fields = {},
  customNodes = [],
  locale = 'en',
  onSchemaChange,
  onNodeSelect,
  onSave,
  onPublish,
}) => {
  // Get store state and actions
  const {
    schema,
    selectedNodeId,
    zoom,
    setSchema,
    resetSchema,
    selectNode,
    addNode,
    updateNodeProps,
    removeNode,
    duplicateNode,
    undo,
    redo,
    canUndo,
    canRedo,
    setZoom,
    setReadonly,
  } = useFlowSchemaStore();

  // Schema upload/download
  const { downloadAsFile, importFromFile } = useSchemaUpload({
    onImport: (imported) => setSchema(imported),
  });

  // Initialize schema
  useEffect(() => {
    if (initialSchema) {
      setSchema(initialSchema);
    } else if (!schema) {
      resetSchema();
    }
  }, [initialSchema]);

  // Set readonly mode
  useEffect(() => {
    setReadonly(readonly);
  }, [readonly, setReadonly]);

  // Emit schema changes
  useEffect(() => {
    if (schema) {
      onSchemaChange?.(schema);
    }
  }, [schema, onSchemaChange]);

  // Emit node selection
  useEffect(() => {
    onNodeSelect?.(selectedNodeId);
  }, [selectedNodeId, onNodeSelect]);

  // Get selected node
  const selectedNode = useMemo(() => {
    if (!schema || !selectedNodeId) return null;
    return getNode(schema, selectedNodeId);
  }, [schema, selectedNodeId]);

  // Handlers
  const handleSave = useCallback(async () => {
    if (schema && onSave) {
      await onSave(schema);
    }
  }, [schema, onSave]);

  const handlePublish = useCallback(async () => {
    if (schema && onPublish) {
      await onPublish(schema);
    }
  }, [schema, onPublish]);

  const handleNodeSelect = useCallback(
    (nodeId: string | null) => {
      selectNode(nodeId);
    },
    [selectNode]
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      removeNode(nodeId);
    },
    [removeNode]
  );

  const handleNodeDuplicate = useCallback(
    (nodeId: string) => {
      duplicateNode(nodeId);
    },
    [duplicateNode]
  );

  const handleNodeAdd = useCallback(
    (parentId: string, type: FlowNodeTypes, index?: number) => {
      const newNodeId = addNode(parentId, type, undefined, index);
      selectNode(newNodeId);
    },
    [addNode, selectNode]
  );

  const handlePropsChange = useCallback(
    (nodeId: string, props: Partial<FlowNodeProps>) => {
      updateNodeProps(nodeId, props);
    },
    [updateNodeProps]
  );

  const handleZoomIn = useCallback(() => {
    setZoom(zoom + 0.1);
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(zoom - 0.1);
  }, [zoom, setZoom]);

  const handleDownload = useCallback(() => {
    if (schema) {
      downloadAsFile(schema, `flow-${flowId || 'new'}.json`);
    }
  }, [schema, flowId, downloadAsFile]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await importFromFile(file);
      }
    };
    input.click();
  }, [importFromFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readonly) return;

      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
      
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // Delete/Backspace: Delete selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        // Only if not in an input
        if (document.activeElement?.tagName !== 'INPUT' &&
            document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleNodeDelete(selectedNodeId);
        }
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        selectNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readonly, undo, redo, handleSave, selectedNodeId, handleNodeDelete, selectNode]);

  return (
    <Layout className="flow-designer" style={{ height: '100%', minHeight: 500 }}>
      {/* Header Toolbar */}
      <Header
        style={{
          background: '#fff',
          padding: '0 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
        }}
      >
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            Flow Designer
          </Title>
        </Space>

        <Space split={<Divider type="vertical" />}>
          {/* Undo/Redo */}
          <Space>
            <Tooltip title="Undo (Ctrl+Z)">
              <Button
                icon={<UndoOutlined />}
                onClick={undo}
                disabled={readonly || !canUndo()}
              />
            </Tooltip>
            <Tooltip title="Redo (Ctrl+Shift+Z)">
              <Button
                icon={<RedoOutlined />}
                onClick={redo}
                disabled={readonly || !canRedo()}
              />
            </Tooltip>
          </Space>

          {/* Zoom */}
          <Space>
            <Tooltip title="Zoom Out">
              <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
            </Tooltip>
            <span style={{ minWidth: 40, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <Tooltip title="Zoom In">
              <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
            </Tooltip>
          </Space>

          {/* Import/Export */}
          <Space>
            <Tooltip title="Import">
              <Button icon={<CloudUploadOutlined />} onClick={handleImport} disabled={readonly} />
            </Tooltip>
            <Tooltip title="Export">
              <Button icon={<DownloadOutlined />} onClick={handleDownload} />
            </Tooltip>
          </Space>

          {/* Actions */}
          <Space>
            {onSave && (
              <Tooltip title="Save (Ctrl+S)">
                <Button
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  disabled={readonly}
                >
                  Save
                </Button>
              </Tooltip>
            )}
            {onPublish && (
              <Tooltip title="Publish">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handlePublish}
                  disabled={readonly}
                >
                  Publish
                </Button>
              </Tooltip>
            )}
          </Space>
        </Space>
      </Header>

      <Layout>
        {/* Main Canvas */}
        <Content
          style={{
            background: '#fafafa',
            overflow: 'auto',
            position: 'relative',
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s',
            }}
          >
            <FlowRender
              schema={schema}
              selectedNodeId={selectedNodeId}
              readonly={readonly}
              onNodeSelect={handleNodeSelect}
              onNodeDelete={handleNodeDelete}
              onNodeDuplicate={handleNodeDuplicate}
              onNodeAdd={handleNodeAdd}
            />
          </div>
        </Content>

        {/* Property Panel */}
        <Sider
          width={320}
          theme="light"
          style={{
            borderLeft: '1px solid #f0f0f0',
            overflow: 'auto',
          }}
        >
          <SetterPanel
            node={selectedNode as any}
            onChange={handlePropsChange}
            readonly={readonly}
            context={{ tables, views, fields }}
          />
        </Sider>
      </Layout>
    </Layout>
  );
};

export default FlowDesigner;
