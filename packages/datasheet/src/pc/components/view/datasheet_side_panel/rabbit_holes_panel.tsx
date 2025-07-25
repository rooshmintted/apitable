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

import React, { useMemo, useState, useEffect } from 'react';
import Tree from 'react-d3-tree';
import { useThemeColors, FloatUiTooltip as Tooltip } from '@apitable/components';
import { FieldType, IField } from '@apitable/core';
import styles from './rabbit_holes_panel.module.less';

interface IRabbitHolesPanelProps {
  rows: any[];
  fieldMap: { [fieldId: string]: IField };
  visibleColumns: any[];
  getCellValue: (recordId: string, fieldId: string) => any;
}

type Visit = {
  url: string;
  timestamp: string;
  domain?: string;
  favicon?: string;
};

type SessionTreeNode = {
  name: string;
  attributes?: {
    url: string;
    domain: string;
    favicon?: string;
    timestamp?: string;
  };
  children?: SessionTreeNode[];
};

type BrowsingSession = {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  domainCount: number;
  nodeCount: number;
  tree: SessionTreeNode;
};

const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
};

const getFaviconUrl = (domain: string): string => {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
};

const clusterIntoSessions = (visits: Visit[], gapInMinutes = 30): Visit[][] => {
  const sessions: Visit[][] = [];
  let current: Visit[] = [];

  const sortedVisits = [...visits].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 0; i < sortedVisits.length; i++) {
    const curr = sortedVisits[i];
    const prev = sortedVisits[i - 1];
    
    const currDate = new Date(curr.timestamp);
    const prevDate = prev ? new Date(prev.timestamp) : null;
    
    // Check if it's a new session (first visit, different day, or gap > 30 minutes)
    const isDifferentDay = prevDate && (
      currDate.getDate() !== prevDate.getDate() ||
      currDate.getMonth() !== prevDate.getMonth() ||
      currDate.getFullYear() !== prevDate.getFullYear()
    );
    
    const isLargeGap = prevDate && 
      (currDate.getTime() - prevDate.getTime()) > gapInMinutes * 60 * 1000;

    if (!prev || isDifferentDay || isLargeGap) {
      if (current.length) sessions.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }

  if (current.length) sessions.push(current);
  return sessions;
};

const buildSessionTree = (session: Visit[]): SessionTreeNode => {
  if (session.length === 0) {
    return { name: 'Empty session' };
  }

  const root: SessionTreeNode = {
    name: session[0].domain || getDomainFromUrl(session[0].url),
    attributes: {
      url: session[0].url,
      domain: session[0].domain || getDomainFromUrl(session[0].url),
      favicon: session[0].favicon || getFaviconUrl(session[0].domain || getDomainFromUrl(session[0].url)),
      timestamp: session[0].timestamp,
    },
    children: [],
  };

  let current = root;
  for (let i = 1; i < session.length; i++) {
    const domain = session[i].domain || getDomainFromUrl(session[i].url);
    const node: SessionTreeNode = {
      name: domain,
      attributes: {
        url: session[i].url,
        domain: domain,
        favicon: session[i].favicon || getFaviconUrl(domain),
        timestamp: session[i].timestamp,
      },
      children: [],
    };
    
    if (!current.children) current.children = [];
    current.children.push(node);
    current = node;
  }

  return root;
};

const calculateSessionMetrics = (session: Visit[]): Omit<BrowsingSession, 'id' | 'tree'> => {
  const startTime = new Date(session[0].timestamp);
  const endTime = new Date(session[session.length - 1].timestamp);
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // in minutes
  
  const uniqueDomains = new Set(
    session.map(v => v.domain || getDomainFromUrl(v.url))
  );
  
  return {
    startTime,
    endTime,
    duration,
    domainCount: uniqueDomains.size,
    nodeCount: session.length,
  };
};

const getDomainColor = (domain: string): string => {
  const colorMap: { [key: string]: string } = {
    'reddit.com': '#FF4500',
    'youtube.com': '#FF0000',
    'wikipedia.org': '#636363',
    'github.com': '#333333',
    'twitter.com': '#1DA1F2',
    'x.com': '#000000',
    'facebook.com': '#1877F2',
    'google.com': '#4285F4',
    'stackoverflow.com': '#F48024',
  };
  
  return colorMap[domain] || '#888888';
};

export const RabbitHolesPanel: React.FC<IRabbitHolesPanelProps> = ({ 
  rows, 
  fieldMap, 
  visibleColumns, 
  getCellValue 
}) => {
  const colors = useThemeColors();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [treeTranslate, setTreeTranslate] = useState({ x: 0, y: 0 });
  const treeContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Center the tree when component mounts or container size changes
    if (treeContainerRef.current) {
      const dimensions = treeContainerRef.current.getBoundingClientRect();
      setTreeTranslate({
        x: dimensions.width / 2,
        y: 50, // Start near the top
      });
    }
  }, [selectedSession]);

  // Extract URL data from rows
  const visits = useMemo(() => {
    const urlField = Object.values(fieldMap).find(
      (field: IField) => field.type === FieldType.URL
    );
    
    if (!urlField) return [];
    
    // Find date field - could be DateTime, CreatedTime, or Text field with date pattern
    const dateField = Object.values(fieldMap).find(
      (field: IField) => 
        field.type === FieldType.DateTime || 
        field.type === FieldType.CreatedTime ||
        (field.type === FieldType.Text && field.name.toLowerCase().includes('date'))
    );
    
    const extractedVisits: Visit[] = [];
    
    rows.forEach(row => {
      const urlValue = getCellValue(row.recordId, urlField.id);
      const dateValue = dateField ? getCellValue(row.recordId, dateField.id) : null;
      
      // Extract URL from cell value
      let urlText: string | null = null;
      if (urlValue) {
        if (Array.isArray(urlValue) && urlValue.length > 0) {
          // Handle segment-based URL fields
          const segment = urlValue[0] as any;
          if (segment && segment.text) {
            urlText = segment.text;
          }
        } else if (typeof urlValue === 'string') {
          urlText = urlValue;
        }
      }
      
      // Extract date from cell value
      let timestamp: string = new Date().toISOString();
      if (dateValue) {
        if (dateField?.type === FieldType.Text) {
          // Handle text field with date pattern
          if (typeof dateValue === 'string') {
            timestamp = dateValue;
          } else if (Array.isArray(dateValue) && dateValue.length > 0) {
            const segment = dateValue[0] as any;
            if (segment && segment.text) {
              timestamp = segment.text;
            }
          }
        } else if (typeof dateValue === 'number') {
          // Unix timestamp
          timestamp = new Date(dateValue).toISOString();
        } else if (typeof dateValue === 'string') {
          timestamp = dateValue;
        }
      }
      
      if (urlText) {
        extractedVisits.push({
          url: urlText,
          timestamp: timestamp,
          domain: getDomainFromUrl(urlText),
        });
      }
    });
    
    return extractedVisits;
  }, [rows, fieldMap, getCellValue]);

  // Cluster visits into sessions and build trees
  const sessions = useMemo(() => {
    const sessionClusters = clusterIntoSessions(visits);
    
    return sessionClusters
      .filter(session => session.length > 1) // Only show sessions with multiple visits
      .map((session, index) => {
        const metrics = calculateSessionMetrics(session);
        const tree = buildSessionTree(session);
        
        return {
          id: `session-${index}`,
          ...metrics,
          tree,
        } as BrowsingSession;
      })
      .filter(session => session.domainCount > 1 || session.duration > 30) // Filter for interesting sessions
      .sort((a, b) => b.nodeCount - a.nodeCount); // Sort by complexity
  }, [visits]);

  const selectedSessionData = useMemo(() => {
    return sessions.find(s => s.id === selectedSession);
  }, [sessions, selectedSession]);

  // Custom node rendering
  const renderCustomNode = ({ nodeDatum }: any) => {
    const domain = nodeDatum.attributes?.domain || nodeDatum.name;
    const favicon = nodeDatum.attributes?.favicon;
    const color = getDomainColor(domain);
    
    return (
      <g>
        <circle r="20" fill={color} opacity={0.2} />
        <circle r="18" fill={colors.bgCommonDefault} stroke={color} strokeWidth="2" />
        {favicon && (
          <image
            href={favicon}
            x="-10"
            y="-10"
            width="20"
            height="20"
          />
        )}
        <Tooltip content={
          <div style={{ maxWidth: 300 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{domain}</div>
            {nodeDatum.attributes?.url && (
              <div style={{ fontSize: 12, wordBreak: 'break-all' }}>
                {nodeDatum.attributes.url}
              </div>
            )}
            {nodeDatum.attributes?.timestamp && (
              <div style={{ fontSize: 11, marginTop: 4, color: colors.textCommonTertiary }}>
                {new Date(nodeDatum.attributes.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        }>
          <text 
            y="35" 
            textAnchor="middle" 
            style={{ fontSize: 12, fill: colors.textCommonPrimary }}
          >
            {domain.length > 15 ? domain.substring(0, 13) + '...' : domain}
          </text>
        </Tooltip>
      </g>
    );
  };

  if (visits.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div style={{ textAlign: 'center', color: colors.textCommonTertiary }}>
          <h3>No URL data found</h3>
          <p>Add a URL field to your datasheet to visualize browsing sessions</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.rabbitHolesPanel}>
      <div className={styles.sessionList}>
        <h3 style={{ color: colors.textCommonPrimary }}>
          Browsing Sessions ({sessions.length})
        </h3>
        {sessions.length === 0 ? (
          <div style={{ color: colors.textCommonTertiary, textAlign: 'center', padding: 20 }}>
            No multi-domain sessions found. Add more browsing data to see rabbit holes!
          </div>
        ) : (
          <div className={styles.sessionCards}>
            {sessions.map(session => (
              <div
                key={session.id}
                className={`${styles.sessionCard} ${selectedSession === session.id ? styles.selected : ''}`}
                onClick={() => setSelectedSession(session.id)}
                style={{
                  backgroundColor: selectedSession === session.id 
                    ? colors.bgBrandLightDefault 
                    : colors.bgCommonLower,
                  borderColor: selectedSession === session.id 
                    ? colors.borderBrandDefault 
                    : colors.borderCommonDefault,
                }}
              >
                <div className={styles.sessionHeader}>
                  <div className={styles.sessionTime}>
                    <span>{session.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={styles.sessionDate}>
                      {session.startTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <span className={styles.sessionDuration}>
                    {Math.round(session.duration)} min
                  </span>
                </div>
                <div className={styles.sessionStats}>
                  <span>{session.nodeCount} pages</span>
                  <span>•</span>
                  <span>{session.domainCount} domains</span>
                </div>
                <div className={styles.sessionPreview}>
                  {(() => {
                    // Get the actual session visits
                    const sessionClusters = clusterIntoSessions(visits);
                    const sessionIndex = parseInt(session.id.split('-')[1]);
                    const sessionVisits = sessionClusters[sessionIndex] || [];
                    
                    // Get unique domains from this session
                    const uniqueDomains = Array.from(new Set(
                      sessionVisits
                        .slice(0, 4)
                        .map(v => v.domain || getDomainFromUrl(v.url))
                    ));
                    
                    return uniqueDomains.map((domain, i) => (
                      <span 
                        key={i} 
                        className={styles.domainChip}
                        style={{ 
                          backgroundColor: getDomainColor(domain) + '20',
                          color: getDomainColor(domain),
                        }}
                      >
                        {domain}
                      </span>
                    ));
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

              {selectedSession ? (
          selectedSessionData ? (
            <div className={styles.treeVisualization} ref={treeContainerRef}>
              <h3 style={{ color: colors.textCommonPrimary }}>
                Session Journey
              </h3>
            <div className={styles.treeContainer}>
              <Tree 
                data={selectedSessionData.tree}
                orientation="vertical"
                pathFunc="step"
                nodeSize={{ x: 200, y: 100 }}
                separation={{ siblings: 1, nonSiblings: 2 }}
                translate={treeTranslate}
                renderCustomNodeElement={renderCustomNode}
                pathClassFunc={() => styles.treePath}
                zoom={0.8}
                scaleExtent={{ min: 0.5, max: 2 }}
                enableLegacyTransitions
              />
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div style={{ textAlign: 'center', color: colors.textCommonTertiary }}>
              Session not found
            </div>
          </div>
        )
      ) : (
        <div className={styles.emptyState}>
          <div style={{ textAlign: 'center', color: colors.textCommonTertiary }}>
            <h3>Select a Session</h3>
            <p>Click on a browsing session to visualize the journey</p>
          </div>
        </div>
      )}
    </div>
  );
}; 