/**
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as React from 'react';
import { ResponsiveTreeMap } from '@nivo/treemap';
import { useThemeColors } from '@apitable/components';
import { FieldType, ISegment } from '@apitable/core';
import styles from './style.module.less';

interface IURLTreemapProps {
  rows: any[];
  fieldMap: any;
  visibleColumns: any[];
  getCellValue: (recordId: string, fieldId: string) => any;
}

interface ITreemapData {
  name: string;
  children?: ITreemapData[];
  value?: number;
}

export const URLTreemap: React.FC<IURLTreemapProps> = ({ rows, fieldMap, visibleColumns, getCellValue }) => {
  const colors = useThemeColors();

  // Extract domain from URL (between first and second dot)
  const extractDomain = (url: string): string => {
    try {
      // Remove protocol if present
      const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
      const parts = urlWithoutProtocol.split('.');
      
      if (parts.length >= 2) {
        // Return the part between first and second dot (or just the first part if only two parts)
        return parts[0].replace('www', '').trim() || parts[1] || 'unknown';
      }
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  };

  // Process data to create treemap structure
  const processTreemapData = (): ITreemapData => {
    const domainCounts: { [key: string]: number } = {};

    // Find URL fields and count domains
    rows.forEach(row => {
      visibleColumns.forEach(col => {
        const field = fieldMap[col.fieldId];
        if (field && field.type === FieldType.URL) {
          const cellValue = getCellValue(row.recordId, col.fieldId);
          if (cellValue && Array.isArray(cellValue)) {
            cellValue.forEach((segment: ISegment) => {
              if (segment.text) {
                const domain = extractDomain(segment.text);
                domainCounts[domain] = (domainCounts[domain] || 0) + 1;
              }
            });
          }
        }
      });
    });

    // Convert to treemap format
    const children = Object.entries(domainCounts)
      .filter(([_, count]) => count > 0)
      .map(([domain, count]) => ({
        name: domain,
        value: count
      }));

    return {
      name: 'URLs',
      children: children.length > 0 ? children : [{ name: 'No URLs found', value: 1 }]
    };
  };

  const data = processTreemapData();

  return (
    <div className={styles.treemapContainer}>
      <h3 className={styles.sectionTitle}>URL Domain Distribution</h3>
      <div style={{ height: '400px', width: '100%' }}>
        <ResponsiveTreeMap
          data={data}
          identity="name"
          value="value"
          valueFormat=" >-.0f"
          margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
          labelSkipSize={12}
          labelTextColor={{
            from: 'color',
            modifiers: [['darker', 1.2]]
          }}
          parentLabelPosition="left"
          parentLabelTextColor={{
            from: 'color',
            modifiers: [['darker', 2]]
          }}
          borderColor={{
            from: 'color',
            modifiers: [['darker', 0.1]]
          }}
          theme={{
            background: colors.bgCommonDefault,
            text: {
              fill: colors.textCommonPrimary
            },
            tooltip: {
              container: {
                background: colors.bgCommonHigh,
                color: colors.textCommonPrimary,
                fontSize: 12,
                borderRadius: 4,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }
            }
          }}
          colors={{ scheme: 'nivo' }}
          animate={true}
          motionConfig="wobbly"
        />
      </div>
    </div>
  );
}; 