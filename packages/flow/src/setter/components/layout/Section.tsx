/**
 * Section Layout Component
 */

import React from 'react';
import { Collapse, Typography } from 'antd';

const { Panel } = Collapse;
const { Text } = Typography;

export interface SectionProps {
  /** Section title */
  title: string;
  /** Description */
  description?: string;
  /** Whether expanded by default */
  defaultExpanded?: boolean;
  /** Children */
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  defaultExpanded = true,
  children,
}) => {
  return (
    <Collapse
      defaultActiveKey={defaultExpanded ? ['1'] : []}
      ghost
      style={{ marginBottom: 16 }}
    >
      <Panel
        key="1"
        header={
          <div>
            <Text strong>{title}</Text>
            {description && (
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                {description}
              </Text>
            )}
          </div>
        }
      >
        {children}
      </Panel>
    </Collapse>
  );
};

export default Section;
