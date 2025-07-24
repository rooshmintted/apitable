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
import { shallowEqual } from 'react-redux';
import { useThemeColors, IconButton, Modal, TextInput, Button } from '@apitable/components';
import { IReduxState, Selectors, Field, Strings, t } from '@apitable/core';
import { SettingOutlined } from '@apitable/icons';
import { useAppSelector } from 'pc/store/react-redux';
import { getStorage, setStorage, StorageName, StorageMethod, deleteStorageByKey } from 'pc/utils/storage';
import { URLTreemap } from './url_treemap';
import { AIChatInterface } from './ai_chat_interface';
import { InsightsPanel } from './insights_panel';
import styles from './style.module.less';

type TabType = 'chat' | 'dataViz' | 'insights';

export const DatasheetSidePanel: React.FC = () => {
  const colors = useThemeColors();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  
  // Load API key from localStorage on mount
  React.useEffect(() => {
    const storedKey = getStorage(StorageName.OpenAIApiKey);
    console.log('Loading API key from localStorage:', storedKey);
    if (storedKey) {
      setApiKey(storedKey);
      console.log('API key loaded and set:', storedKey);
    }
  }, []);
  
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

  // Helper function to get cell value
  const getCellValue = (recordId: string, fieldId: string) => {
    if (!state || !snapshot) return null;
    return Selectors.getCellValue(state, snapshot, recordId, fieldId);
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      console.log('Saving API key:', tempApiKey.trim());
      setStorage(StorageName.OpenAIApiKey, tempApiKey.trim(), StorageMethod.Set);
      setApiKey(tempApiKey.trim());
      console.log('API key saved and set:', tempApiKey.trim());
      setShowSettingsModal(false);
      setTempApiKey('');
    }
  };

  const handleDeleteApiKey = () => {
    console.log('Deleting API key from storage');
    deleteStorageByKey(StorageName.OpenAIApiKey);
    setApiKey('');
    setTempApiKey('');
    console.log('API key deleted');
  };

  return (
    <div className={styles.datasheetSidePanel} style={{ backgroundColor: colors.bgCommonDefault }}>
      <div className={styles.header}>
      </div>
              <div className={styles.content}>
          {firstRow ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                {/* Tab Navigation */}
                <div className={styles.tabNavigation}>
                  <div 
                    className={`${styles.tab} ${activeTab === 'chat' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('chat')}
                  >
                    Chat
                  </div>
                  <div 
                    className={`${styles.tab} ${activeTab === 'dataViz' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('dataViz')}
                  >
                    Data Viz
                  </div>
                  <div 
                    className={`${styles.tab} ${activeTab === 'insights' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('insights')}
                  >
                    Insights
                  </div>
                </div>
                
                {/* Settings button - only show on chat tab */}
                {activeTab === 'chat' && (
                  <IconButton
                    icon={SettingOutlined}
                    onClick={() => {
                      setTempApiKey(apiKey);
                      setShowSettingsModal(true);
                    }}
                    size="small"
                  />
                )}
              </div>
              
              {/* Tab Content */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {activeTab === 'chat' && (
                  <AIChatInterface 
                    rows={rows}
                    fieldMap={fieldMap}
                    visibleColumns={visibleColumns}
                    getCellValue={getCellValue}
                    apiKey={apiKey}
                  />
                )}
                
                {activeTab === 'dataViz' && (
                  <URLTreemap 
                    rows={rows}
                    fieldMap={fieldMap}
                    visibleColumns={visibleColumns}
                    getCellValue={getCellValue}
                  />
                )}
                
                {activeTab === 'insights' && (
                  <InsightsPanel 
                    rows={rows}
                    fieldMap={fieldMap}
                    visibleColumns={visibleColumns}
                    getCellValue={getCellValue}
                    apiKey={apiKey}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>No records available</div>
          )}
      </div>
      
      {/* Settings Modal */}
      <Modal
        title="AI Assistant Settings"
        visible={showSettingsModal}
        onCancel={() => {
          setShowSettingsModal(false);
          setTempApiKey(apiKey);
        }}
        footer={null}
        width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            OpenAI API Key
          </label>
          <TextInput
            value={tempApiKey}
            onChange={(e) => setTempApiKey(e.target.value)}
            placeholder="sk-..."
            type="text"
            style={{ marginBottom: 8 }}
          />
          <div style={{ fontSize: 12, color: colors.textCommonTertiary }}>
            Your API key is stored locally in your browser and never sent to our servers.
            Get your API key from{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
              OpenAI Platform
            </a>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <Button
            color="danger"
            variant="fill"
            onClick={handleDeleteApiKey}
            disabled={!apiKey}
          >
            Delete Key
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={() => {
                setShowSettingsModal(false);
                setTempApiKey(apiKey);
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onClick={handleSaveApiKey}
              disabled={!tempApiKey.trim() || tempApiKey === apiKey}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}; 