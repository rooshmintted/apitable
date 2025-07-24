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
import { ResponsiveVoronoi } from '@nivo/voronoi';
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

interface IVoronoiData {
  id: string;
  x: number;
  y: number;
  value: number;
}

export const URLTreemap: React.FC<IURLTreemapProps> = ({ rows, fieldMap, visibleColumns, getCellValue }) => {
  const colors = useThemeColors();
  const [activeView, setActiveView] = useState<'treemap' | 'calendar' | 'voronoi'>('treemap');

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

  // Extract date from various date field types
  const extractDate = (cellValue: any): Date | null => {
    try {
      if (!cellValue) return null;
      
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
      
      return null;
    } catch (e) {
      return null;
    }
  };

  // Process data for calendar view
  const processCalendarData = (): { calendarData: ICalendarData[], dateRange: { from: string, to: string } } => {
    const dateCounts: { [key: string]: number } = {};
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    // Find date fields and count occurrences per day
    rows.forEach(row => {
      visibleColumns.forEach(col => {
        const field = fieldMap[col.fieldId];
        if (field && (field.type === FieldType.DateTime || field.type === FieldType.CreatedTime || field.type === FieldType.LastModifiedTime)) {
          const cellValue = getCellValue(row.recordId, col.fieldId);
          const date = extractDate(cellValue);
          
          if (date) {
            const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            dateCounts[dayKey] = (dateCounts[dayKey] || 0) + 1;
            
            if (!minDate || date < minDate) minDate = date;
            if (!maxDate || date > maxDate) maxDate = date;
          }
        }
      });
    });

    // Convert to calendar format
    const calendarData = Object.entries(dateCounts).map(([day, value]) => ({
      day,
      value
    }));

    // Set date range (default to last year if no data)
    const from = minDate ? minDate.toISOString().split('T')[0] : 
                 new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split('T')[0];
    const to = maxDate ? maxDate.toISOString().split('T')[0] : 
               new Date().toISOString().split('T')[0];

    return { calendarData, dateRange: { from, to } };
  };

  // Process data for active hours (24-hour breakdown)
  const processActiveHoursData = (): IActiveHoursData[] => {
    const hourCounts: { [key: number]: number } = {};

    // Initialize all 24 hours
    for (let i = 0; i < 24; i++) {
      hourCounts[i] = 0;
    }

    // Count activities by hour
    rows.forEach(row => {
      visibleColumns.forEach(col => {
        const field = fieldMap[col.fieldId];
        if (field && (field.type === FieldType.DateTime || field.type === FieldType.CreatedTime || field.type === FieldType.LastModifiedTime)) {
          const cellValue = getCellValue(row.recordId, col.fieldId);
          const date = extractDate(cellValue);
          
          if (date) {
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

  // Process data for Voronoi diagram
  const processVoronoiData = (): IVoronoiData[] => {
    const activeHours = processActiveHoursData();
    const { calendarData } = processCalendarData();
    
    // Create Voronoi data points combining calendar and hourly data
    const voronoiData: IVoronoiData[] = [];
    
    // Add hourly activity points
    activeHours.forEach((hourData, index) => {
      if (hourData.count > 0) {
        voronoiData.push({
          id: `hour-${hourData.hour}`,
          x: (hourData.hour / 24) * 300, // Scale to chart width
          y: 100 + (hourData.count * 10), // Scale based on count
          value: hourData.count
        });
      }
    });
    
    // Add daily activity points
    calendarData.forEach((dayData, index) => {
      const date = new Date(dayData.day);
      const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
      
      voronoiData.push({
        id: `day-${dayData.day}`,
        x: (dayOfYear / 365) * 300, // Scale across year
        y: 200 + (dayData.value * 5), // Scale based on value
        value: dayData.value
      });
    });

    return voronoiData;
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
  const { calendarData, dateRange } = processCalendarData();
  const activeHoursData = processActiveHoursData();
  const voronoiData = processVoronoiData();

  return (
    <div className={styles.treemapContainer}>
      {/* View Toggle */}
      <div style={{ display: 'flex', marginBottom: 16, gap: 8 }}>
        <button
          onClick={() => setActiveView('treemap')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeView === 'treemap' ? colors.primaryColor : 'transparent',
            color: activeView === 'treemap' ? 'white' : colors.textCommonPrimary,
            border: `1px solid ${colors.primaryColor}`,
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          URL Domain Distribution
        </button>
        <button
          onClick={() => setActiveView('calendar')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeView === 'calendar' ? colors.primaryColor : 'transparent',
            color: activeView === 'calendar' ? 'white' : colors.textCommonPrimary,
            border: `1px solid ${colors.primaryColor}`,
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Calendar View
        </button>
        <button
          onClick={() => setActiveView('voronoi')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeView === 'voronoi' ? colors.primaryColor : 'transparent',
            color: activeView === 'voronoi' ? 'white' : colors.textCommonPrimary,
            border: `1px solid ${colors.primaryColor}`,
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Voronoi View
        </button>
      </div>

      {activeView === 'treemap' ? (
        <>
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
        </>
      ) : activeView === 'calendar' ? (
        <>
          <h3 className={styles.sectionTitle}>Browsing Activity Calendar</h3>
          <div style={{ height: '300px', width: '100%', marginBottom: 24 }}>
            <ResponsiveCalendar
              data={calendarData}
              from={dateRange.from}
              to={dateRange.to}
              emptyColor={colors.bgCommonLower}
              colors={['#61cdbb', '#97e3d5', '#e8c1a0', '#f47560']}
              margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
              yearSpacing={40}
              monthBorderColor={colors.borderCommonDefault}
              dayBorderWidth={2}
              dayBorderColor={colors.borderCommonDefault}
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
            />
          </div>

          <h3 className={styles.sectionTitle}>Active Hours (24h)</h3>
          <div style={{ height: '200px', width: '100%' }}>
            <div style={{ 
              display: 'flex', 
              height: '100%', 
              alignItems: 'end', 
              justifyContent: 'space-between',
              padding: '0 8px'
            }}>
              {activeHoursData.map((hourData) => (
                <div
                  key={hourData.hour}
                  style={{
                    width: 'calc(100% / 24 - 2px)',
                    height: `${Math.max(4, (hourData.count / Math.max(...activeHoursData.map(h => h.count))) * 100)}%`,
                    backgroundColor: hourData.count > 0 ? colors.primaryColor : colors.bgCommonLower,
                    borderRadius: '2px 2px 0 0',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                  title={`${hourData.hour}:00 - ${hourData.count} activities`}
                >
                  {hourData.hour % 6 === 0 && (
                    <span style={{
                      position: 'absolute',
                      bottom: -20,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 10,
                      color: colors.textCommonTertiary
                    }}>
                      {hourData.hour}h
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <h3 className={styles.sectionTitle}>Activity Patterns (Voronoi)</h3>
          <div style={{ height: '400px', width: '100%' }}>
            <ResponsiveVoronoi
              data={voronoiData}
              xDomain={[0, 300]}
              yDomain={[0, 400]}
              cellComponent={({ cell, borderWidth, borderColor }) => (
                <polygon
                  points={cell.points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill={colors.primaryColor}
                  fillOpacity={0.3}
                  stroke={borderColor}
                  strokeWidth={borderWidth}
                />
              )}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              enableLinks
              linkLineWidth={1}
              linkLineColor={colors.borderCommonDefault}
              enableSites
              siteSize={6}
              siteColor={colors.primaryColor}
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
            />
          </div>
        </>
      )}
    </div>
  );
}; 