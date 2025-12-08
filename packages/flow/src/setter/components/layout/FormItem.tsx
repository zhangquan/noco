/**
 * Form Item Layout Component
 */

import React from 'react';
import { Form, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

export interface FormItemProps {
  /** Field label */
  label: string;
  /** Help text */
  help?: string;
  /** Whether required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Children */
  children: React.ReactNode;
}

export const FormItem: React.FC<FormItemProps> = ({
  label,
  help,
  required,
  error,
  children,
}) => {
  return (
    <Form.Item
      label={
        <span>
          {label}
          {required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
          {help && (
            <Tooltip title={help}>
              <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
            </Tooltip>
          )}
        </span>
      }
      validateStatus={error ? 'error' : undefined}
      help={error}
      style={{ marginBottom: 16 }}
    >
      {children}
    </Form.Item>
  );
};

export default FormItem;
