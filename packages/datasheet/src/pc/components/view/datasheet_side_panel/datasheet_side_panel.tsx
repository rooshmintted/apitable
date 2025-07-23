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
import { shallowEqual } from 'react-redux';
import { useThemeColors } from '@apitable/components';
import { IReduxState, Selectors, Field } from '@apitable/core';
import { useAppSelector } from 'pc/store/react-redux';
import styles from './style.module.less';

export const DatasheetSidePanel: React.FC = () => {
  const colors = useThemeColors();
  
  // Get datasheet data from Redux state
  const { rows, fieldMap, currentView, snapshot, datasheetId, state } = useAppSelector((state: IReduxState) => {
    const datasheetId = state.pageParams.datasheetId;
    if (!datasheetId) return { rows: [], fieldMap: {}, currentView: null, snapshot: null, datasheetId: null, state: null };
    
    const datasheet = Selectors.getDatasheet(state, datasheetId);
    const currentView = Selectors.getCurrentView(state)!;
    const fieldMap = Selectors.getFieldMap(state, datasheetId)!;
    
    return {
      rows: Selectors.getVisibleRows(state),
      fieldMap,
      currentView,
      snapshot: datasheet?.snapshot || null,
      datasheetId,
      state,
    };
  }, shallowEqual);

  // Get first row data
  const firstRow = rows[0];
  const visibleColumns = currentView?.columns?.filter(col => !col.hidden) || [];

  return (
    <div className={styles.datasheetSidePanel} style={{ backgroundColor: colors.bgCommonDefault }}>
      <div className={styles.header}>
        <h2>Hello World</h2>
      </div>
      <div className={styles.content}>
        {firstRow ? (
          <div className={styles.firstRowData}>
            <h3 className={styles.sectionTitle}>First Row Data</h3>
            <div className={styles.dataList}>
              {visibleColumns.map((col) => {
                const field = fieldMap[col.fieldId];
                if (!field) return null;
                
                // Use Selectors.getCellValue directly
                const cellValue = state && snapshot ? Selectors.getCellValue(
                  state,
                  snapshot,
                  firstRow.recordId,
                  col.fieldId
                ) : null;
                
                // Use Field.bindModel to get the field instance with cellValueToString method
                const displayValue = Field.bindModel(field).cellValueToString(cellValue);
                
                return (
                  <div key={col.fieldId} className={styles.dataItem}>
                    <div className={styles.fieldName}>{field.name}:</div>
                    <div className={styles.fieldValue}>{displayValue || '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>No records available</div>
        )}
      </div>
    </div>
  );
}; 