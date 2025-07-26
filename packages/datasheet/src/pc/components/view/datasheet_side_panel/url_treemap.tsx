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
import { useState } from 'react';
import { ResponsiveTreeMap } from '@nivo/treemap';
import { ResponsiveCalendar } from '@nivo/calendar';
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

interface ICalendarData {
  day: string;
  value: number;
}

interface IActiveHoursData {
  hour: number;
  count: number;
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

  // Extract date from various date field types and text fields with date patterns
  const extractDate = (cellValue: any, field: any): Date | null => {
    try {
      if (!cellValue) return null;
      
      // Handle text fields with date patterns like "2025-07-23 00:32:03"
      if (field && field.type === FieldType.Text) {
        let dateString = '';
        
        if (typeof cellValue === 'string') {
          dateString = cellValue;
        } else if (Array.isArray(cellValue) && cellValue.length > 0) {
          const segment = cellValue[0] as ISegment;
          if (segment && segment.text) {
            dateString = segment.text;
          }
        }
        
        // Check if the string matches date patterns
        if (dateString) {
          // Pattern for "YYYY-MM-DD HH:mm:ss" or similar
          const datePattern = /(\d{4})-(\d{2})-(\d{2})\s*(\d{2})?:?(\d{2})?:?(\d{2})?/;
          const match = dateString.match(datePattern);
          
          if (match) {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
      }
      
      // Handle date field types
      if (field && (field.type === FieldType.DateTime || field.type === FieldType.CreatedTime || field.type === FieldType.LastModifiedTime)) {
        // Handle different date field formats
        if (typeof cellValue === 'number') {
          // Unix timestamp
          return new Date(cellValue);
        }
        
        if (typeof cellValue === 'string') {
          const date = new Date(cellValue);
          return isNaN(date.getTime()) ? null : date;
        }
        
        if (Array.isArray(cellValue) && cellValue.length > 0) {
          // Handle segment-based date fields
          const segment = cellValue[0] as ISegment;
          if (segment && segment.text) {
            const date = new Date(segment.text);
            return isNaN(date.getTime()) ? null : date;
          }
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  };

  // Process data for calendar view - only 2025 data
  const processCalendarData = (): ICalendarData[] => {
    const dateCounts: { [key: string]: number } = {};
    const targetYear = 2025; // Target only 2025

    // Find date fields and count occurrences per day
    rows.forEach(row => {
      visibleColumns.forEach(col => {
        const field = fieldMap[col.fieldId];
        if (field) {
          const cellValue = getCellValue(row.recordId, col.fieldId);
          const date = extractDate(cellValue, field);
          
          // Strictly filter for 2025 dates only
          if (date && date.getFullYear() === targetYear) {
            const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            if (dayKey.startsWith('2025-')) {
              dateCounts[dayKey] = (dateCounts[dayKey] || 0) + 1;
            }
          }
        }
      });
    });

    // Convert to calendar format
    return Object.entries(dateCounts)
      .map(([day, value]) => ({
        day,
        value
      }));
  };

  // Process data for active hours (24-hour breakdown)
  const processActiveHoursData = (): IActiveHoursData[] => {
    const hourCounts: { [key: number]: number } = {};
    const targetYear = 2025; // Fixed to 2025

    // Initialize all 24 hours
    for (let i = 0; i < 24; i++) {
      hourCounts[i] = 0;
    }

    // Count activities by hour
    rows.forEach(row => {
      visibleColumns.forEach(col => {
        const field = fieldMap[col.fieldId];
        if (field) {
          const cellValue = getCellValue(row.recordId, col.fieldId);
          const date = extractDate(cellValue, field);
          
          if (date && date.getFullYear() === targetYear) {
            const hour = date.getHours();
            hourCounts[hour]++;
          }
        }
      });
    });

    return Object.entries(hourCounts).map(([hour, count]) => ({
      hour: parseInt(hour),
      count
    }));
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
  const calendarData = processCalendarData();
  const activeHoursData = processActiveHoursData();

  // Calculate max value for scaling
  const maxCalendarValue = Math.max(...calendarData.map(d => d.value), 1);
  const maxHourValue = Math.max(...activeHoursData.map(h => h.count), 1);

  return (
    <div className={styles.treemapContainer}>
      {/* URL Domain Distribution */}
      <h3 className={styles.sectionTitle}>URL Domain Distribution</h3>
      <div style={{ height: '350px', width: '100%', marginBottom: 32 }}>
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

      {/* Calendar View - Always shown for 2025 */}
      <h3 className={styles.sectionTitle}>Activity Calendar (2025)</h3>
      <div style={{ height: '180px', width: '100%', marginBottom: 24 }}>
        {calendarData.length > 0 ? (
          <ResponsiveCalendar
            data={calendarData}
            from="2025-01-02" // This prop ensures the calendar starts in 2025
            to="2025-12-31"   // This prop ensures the calendar ends in 2025
            emptyColor={colors.bgCommonLower}
            colors={[
              colors.bgCommonLower,
              '#d4e4f7',
              '#9ecae1',
              '#6baed6',
              '#3182bd'
            ]}
            minValue={0}
            maxValue={maxCalendarValue}
            margin={{ top: 20, right: 20, bottom: 10, left: 20 }}
            yearSpacing={40}
            monthBorderColor={colors.borderCommonDefault}
            dayBorderWidth={2}
            dayBorderColor={colors.bgCommonDefault}
            monthLegendPosition="before"
            monthLegendOffset={10}
            yearLegend={(year) => year}
            yearLegendPosition="after"
            yearLegendOffset={10}
            legends={[
              {
                anchor: 'bottom-right',
                direction: 'row',
                translateY: 36,
                itemCount: 4,
                itemWidth: 42,
                itemHeight: 36,
                itemsSpacing: 14,
                itemDirection: 'right-to-left'
              }
            ]}
            theme={{
              background: colors.bgCommonDefault,
              textColor: colors.textCommonPrimary,
              fontSize: 11,
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
          />
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: colors.textCommonTertiary
          }}>
            No date data found for 2025
          </div>
        )}
      </div>

      {/* Active Hours */}
      <h3 className={styles.sectionTitle}>Active Hours (24h)</h3>
      <div style={{ height: '150px', width: '100%', paddingBottom: 20 }}>
        <div style={{ 
          display: 'flex', 
          height: '100%', 
          alignItems: 'end', 
          justifyContent: 'space-between',
          padding: '0 8px',
          gap: '2px'
        }}>
          {activeHoursData.map((hourData) => {
            const heightPercent = maxHourValue > 0 ? (hourData.count / maxHourValue) * 100 : 0;
            return (
              <div
                key={hourData.hour}
                style={{
                  flex: 1,
                  height: `${Math.max(2, heightPercent)}%`,
                  backgroundColor: hourData.count > 0 ? colors.primaryColor : colors.bgCommonLower,
                  borderRadius: '2px 2px 0 0',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title={`${hourData.hour}:00 - ${hourData.count} activities`}
              >
                {hourData.count > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 9,
                    color: colors.textCommonTertiary,
                    whiteSpace: 'nowrap'
                  }}>
                    {hourData.count}
                  </span>
                )}
                {hourData.hour % 3 === 0 && (
                  <span style={{
                    position: 'absolute',
                    bottom: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    color: colors.textCommonTertiary
                  }}>
                    {hourData.hour}h
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};