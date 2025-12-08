/**
 * FlowDesigner Component
 * Main flow designer component
 * @module designer
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { Layout, Button, Tooltip, Space, Dropdown, Menu, message } from 'antd';
import {
  SaveOutlined,
  CloudUploadOutlined,
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { FlowRender } from './render';
import { SetterPanel } from './setter';
import { useFlowSchemaStore } from './states/flowSchemaStore';
import { useHistoryStore } from './states/historyStore';
import { initFlowI18n, useTranslation } from './lang';
import type { FlowSchemaType, DesignerConfig, FlowType } from './types';
import './index.css';

const { Header, Content, Sider } = Layout;

// ============================================================================
// Types
// ============================================================================

export interface FlowDesignerProps {
  /** Initial schema */
  initialSchema?: FlowSchemaType | null;
  /** Flow data */
  flow?: FlowType;
  /** Available tables for data operations */
  tables?: Array<{ id: string; title: string }>;
  /** Designer configuration */
  config?: DesignerConfig;
  /** Save handler */
  onSave?: (schema: FlowSchemaType) => Promise<void>;
  /** Publish handler */
  onPublish?: (schema: FlowSchemaType) => Promise<void>;
  /** Change handler */
  onChange?: (schema: FlowSchemaType) => void;
  /** Language */
  language?: 'zh_CN' | 'en';
  /** Show header toolbar */
  showHeader?: boolean;
  /** Show setter panel */
  showSetter?: boolean;
  /** Header height */
  headerHeight?: number;
  /** Setter width */
  setterWidth?: number;
  /** Additional class name */
  className?: string;
  /** Style */
  style?: React.CSSProperties;
}

// ============================================================================
// Component
// ============================================================================

export const FlowDesigner: React.FC<FlowDesignerProps> = ({
  initialSchema,
  flow,
  tables = [],
  config,
  onSave,
  onPublish,
  onChange,
  language = 'zh_CN',
  showHeader = true,
  showSetter = true,
  headerHeight = 48,
  setterWidth = 320,
  className,
  style,
}) => {
  // Initialize i18n
  useEffect(() => {
    initFlowI18n(language);
  }, [language]);

  const { t } = useTranslation();

  // Store state
  const schema = useFlowSchemaStore((state) => state.schema);
  const setSchema = useFlowSchemaStore((state) => state.setSchema);
  const isDirty = useFlowSchemaStore((state) => state.isDirty);
  const markClean = useFlowSchemaStore((state) => state.markClean);
  const selectedNodeId = useFlowSchemaStore((state) => state.selectedNodeId);
  const zoom = useFlowSchemaStore((state) => state.zoom);
  const setZoom = useFlowSchemaStore((state) => state.setZoom);
  const setConfig = useFlowSchemaStore((state) => state.setConfig);
  const mode = useFlowSchemaStore((state) => state.mode);

  // History store
  const push = useHistoryStore((state) => state.push);
  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);

  // Initialize schema
  useEffect(() => {
    if (initialSchema) {
      setSchema(initialSchema);
      push(initialSchema, 'Initial schema');
    }
  }, [initialSchema, setSchema, push]);

  // Apply config
  useEffect(() => {
    if (config) {
      setConfig(config);
    }
  }, [config, setConfig]);

  // Notify parent of changes
  useEffect(() => {
    if (schema && onChange) {
      onChange(schema);
    }
  }, [schema, onChange]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!schema || !onSave) return;
    
    try {
      await onSave(schema);
      markClean();
      message.success(t('flow.messages.saveSuccess'));
    } catch (error) {
      message.error(t('flow.messages.saveFailed'));
      console.error('Save failed:', error);
    }
  }, [schema, onSave, markClean, t]);

  // Handle publish
  const handlePublish = useCallback(async () => {
    if (!schema || !onPublish) return;
    
    try {
      await onPublish(schema);
      message.success(t('flow.messages.publishSuccess'));
    } catch (error) {
      message.error(t('flow.messages.publishFailed'));
      console.error('Publish failed:', error);
    }
  }, [schema, onPublish, t]);

  // Handle undo
  const handleUndo = useCallback(() => {
    const previousSchema = undo();
    if (previousSchema) {
      setSchema(previousSchema);
    }
  }, [undo, setSchema]);

  // Handle redo
  const handleRedo = useCallback(() => {
    const nextSchema = redo();
    if (nextSchema) {
      setSchema(nextSchema);
    }
  }, [redo, setSchema]);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setZoom(zoom + 0.1);
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(zoom - 0.1);
  }, [zoom, setZoom]);

  const handleFitView = useCallback(() => {
    setZoom(1);
  }, [setZoom]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleUndo, handleRedo]);

  // Title
  const title = useMemo(() => {
    return flow?.title || (schema?.props as { title?: string })?.title || t('flow.designer.title');
  }, [flow, schema, t]);

  return (
    <Layout className={`flow-designer ${className || ''}`} style={style}>
      {/* Header */}
      {showHeader && (
        <Header
          className="flow-designer__header"
          style={{ height: headerHeight, lineHeight: `${headerHeight}px` }}
        >
          <div className="flow-designer__header-left">
            <span className="flow-designer__title">{title}</span>
            {isDirty && <span className="flow-designer__dirty-indicator">●</span>}
          </div>

          <div className="flow-designer__header-center">
            <Space>
              <Tooltip title={`${t('flow.designer.undo')} (Ctrl+Z)`}>
                <Button
                  type="text"
                  icon={<UndoOutlined />}
                  disabled={!canUndo()}
                  onClick={handleUndo}
                />
              </Tooltip>
              <Tooltip title={`${t('flow.designer.redo')} (Ctrl+Shift+Z)`}>
                <Button
                  type="text"
                  icon={<RedoOutlined />}
                  disabled={!canRedo()}
                  onClick={handleRedo}
                />
              </Tooltip>
              <div className="flow-designer__divider" />
              <Tooltip title={t('flow.designer.zoomOut')}>
                <Button
                  type="text"
                  icon={<ZoomOutOutlined />}
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.25}
                />
              </Tooltip>
              <span className="flow-designer__zoom-level">{Math.round(zoom * 100)}%</span>
              <Tooltip title={t('flow.designer.zoomIn')}>
                <Button
                  type="text"
                  icon={<ZoomInOutlined />}
                  onClick={handleZoomIn}
                  disabled={zoom >= 2}
                />
              </Tooltip>
              <Tooltip title={t('flow.designer.fitView')}>
                <Button
                  type="text"
                  icon={<ExpandOutlined />}
                  onClick={handleFitView}
                />
              </Tooltip>
            </Space>
          </div>

          <div className="flow-designer__header-right">
            <Space>
              {onSave && (
                <Button
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  disabled={!isDirty}
                >
                  {t('flow.designer.save')}
                </Button>
              )}
              {onPublish && (
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  onClick={handlePublish}
                >
                  {t('flow.designer.publish')}
                </Button>
              )}
            </Space>
          </div>
        </Header>
      )}

      {/* Main content */}
      <Layout>
        {/* Canvas */}
        <Content className="flow-designer__content">
          <div
            className="flow-designer__canvas"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center top' }}
          >
            <FlowRender
              showAddButtons={mode === 'edit'}
              readOnly={mode !== 'edit'}
            />
          </div>
        </Content>

        {/* Setter panel */}
        {showSetter && (
          <Sider
            width={setterWidth}
            className="flow-designer__sider"
            theme="light"
          >
            <SetterPanel
              node={null}
              onChange={() => {}}
              onPropsChange={() => {}}
              tables={tables}
            />
          </Sider>
        )}
      </Layout>
    </Layout>
  );
};

export default FlowDesigner;
