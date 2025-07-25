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

import React, { useState, useMemo, useCallback } from 'react';
import { useThemeColors, Button, Loading } from '@apitable/components';
import { FieldType, IField } from '@apitable/core';
import { OpenAI } from 'openai';
import styles from './biography_panel.module.less';

interface IBiographyPanelProps {
  rows: any[];
  fieldMap: { [fieldId: string]: IField };
  visibleColumns: any[];
  getCellValue: (recordId: string, fieldId: string) => any;
  apiKey: string;
}

type Visit = {
  url: string;
  timestamp: string;
  domain?: string;
};

type SessionData = {
  start: string;
  end: string;
  urls: string[];
};

const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
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
    
    const isLargeGap = prevDate && 
      (currDate.getTime() - prevDate.getTime()) > gapInMinutes * 60 * 1000;

    if (!prev || isLargeGap) {
      if (current.length) sessions.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }

  if (current.length) sessions.push(current);
  return sessions;
};

export const BiographyPanel: React.FC<IBiographyPanelProps> = ({ 
  rows, 
  fieldMap, 
  visibleColumns, 
  getCellValue,
  apiKey 
}) => {
  const colors = useThemeColors();
  const [autobiography, setAutobiography] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  // Extract URL data from rows (same logic as rabbit_holes_panel)
  const visits = useMemo(() => {
    const urlField = Object.values(fieldMap).find(
      (field: IField) => field.type === FieldType.URL
    );
    
    if (!urlField) return [];
    
    const dateField = Object.values(fieldMap).find(
      (field: IField) => 
        field.type === FieldType.DateTime || 
        field.type === FieldType.CreatedTime ||
        (field.type === FieldType.Text && field.name.toLowerCase().includes('date'))
    );
    
    const extractedVisits: Visit[] = [];
    
    // Sample every 3rd row to reduce data size
    rows.forEach((row, index) => {
      // Skip rows that aren't every 3rd row
      if (index % 3 !== 0) return;
      const urlValue = getCellValue(row.recordId, urlField.id);
      const dateValue = dateField ? getCellValue(row.recordId, dateField.id) : null;
      
      let urlText: string | null = null;
      if (urlValue) {
        if (Array.isArray(urlValue) && urlValue.length > 0) {
          const segment = urlValue[0] as any;
          if (segment && segment.text) {
            urlText = segment.text;
          }
        } else if (typeof urlValue === 'string') {
          urlText = urlValue;
        }
      }
      
      let timestamp: string = new Date().toISOString();
      if (dateValue) {
        if (dateField?.type === FieldType.Text) {
          if (typeof dateValue === 'string') {
            timestamp = dateValue;
          } else if (Array.isArray(dateValue) && dateValue.length > 0) {
            const segment = dateValue[0] as any;
            if (segment && segment.text) {
              timestamp = segment.text;
            }
          }
        } else if (typeof dateValue === 'number') {
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

  // Convert visits to session data format
  const sessionData = useMemo(() => {
    const sessions = clusterIntoSessions(visits);
    
    return sessions.map(session => ({
      start: session[0].timestamp,
      end: session[session.length - 1].timestamp,
      urls: session.map(v => v.url),
    })) as SessionData[];
  }, [visits]);

  const generateAutobiography = useCallback(async () => {
    if (!apiKey) {
      setError('Please configure your OpenAI API key in settings');
      return;
    }

    if (sessionData.length === 0) {
      setError('No browsing history data found');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      const prompt = `You are a brilliant narrative ghostwriter trained in behavioral psychology, life storytelling, and internet culture.

You've been given a person's raw browsing history — just a list of URLs and timestamps over time. Your job is to write their **Internet Autobiography**: a multi-chapter narrative arc that captures the emotional, intellectual, and behavioral story told by their online activity.

Use only what you can infer from this data, but feel free to be creative, metaphorical, and emotionally resonant. You can speculate gently — just make it feel personal and meaningful.

## Instructions:
1. First, **identify natural chapters** in the user's life based on browsing patterns over time (topic shifts, frequency changes, spikes in a category, etc.). There should be 3–7 chapters.
2. For each chapter:
    - Give it a **title** (poetic, funny, cryptic, or literal — your call).
    - Write a short **narrative paragraph** describing that phase in the person's life — what they were interested in, what they might have been feeling, what changed.
    - Mention key domains, content types, or time patterns if meaningful.
3. Avoid just listing sites — synthesize them into **meaning**. This is part fiction, part psychological reflection, part tech memoir.
4. Your output should feel like a short story told by the internet itself.

Here is the person's browsing history:

${JSON.stringify(sessionData, null, 2)}

Now, write the Internet Autobiography.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'You are a creative writer specializing in digital memoirs and internet culture.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '';
      setAutobiography(content);
    } catch (err: any) {
      console.error('Error generating autobiography:', err);
      setError(err.message || 'Failed to generate autobiography');
    } finally {
      setIsGenerating(false);
    }
  }, [apiKey, sessionData]);

  const renderAutobiography = () => {
    if (!autobiography) return null;

    // Split content into chapters based on common patterns
    const chapters = autobiography.split(/^(Chapter \d+:|#{1,3} )/gm).filter(Boolean);
    
    return (
      <div className={styles.autobiographyContent}>
        {chapters.map((chapter, index) => {
          // Check if this is a chapter title
          const isTitle = chapter.match(/^(Chapter \d+:|#{1,3} )/);
          
          if (isTitle) {
            return (
              <h3 key={index} className={styles.chapterTitle}>
                {chapter.replace(/^(Chapter \d+:|#{1,3} )/, '')}
              </h3>
            );
          }
          
          // Regular paragraph
          return (
            <p key={index} className={styles.chapterContent}>
              {chapter.trim()}
            </p>
          );
        })}
      </div>
    );
  };

  if (!apiKey) {
    return (
      <div className={styles.emptyState}>
        <div style={{ textAlign: 'center', color: colors.textCommonTertiary }}>
          <h3>API Key Required</h3>
          <p>Please configure your OpenAI API key in the settings to generate your Internet Autobiography</p>
        </div>
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div style={{ textAlign: 'center', color: colors.textCommonTertiary }}>
          <h3>No browsing history found</h3>
          <p>Add a URL field to your datasheet to generate your Internet Autobiography</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.biographyPanel}>
      <div className={styles.header}>
        <div>
          <h3 style={{ color: colors.textCommonPrimary, margin: 0 }}>
            Your Internet Autobiography
          </h3>
          <p style={{ color: colors.textCommonTertiary, margin: '4px 0 0 0', fontSize: 14 }}>
            A narrative journey through your digital footprints
          </p>
        </div>
        <Button
          onClick={generateAutobiography}
          disabled={isGenerating}
          color="primary"
          size="small"
        >
          {isGenerating ? 'Generating...' : autobiography ? 'Regenerate' : 'Generate Biography'}
        </Button>
      </div>

      <div className={styles.content}>
        {isGenerating && (
          <div className={styles.loadingState}>
            <Loading />
            <p style={{ color: colors.textCommonTertiary, marginTop: 16 }}>
              Analyzing your digital journey...
            </p>
          </div>
        )}

        {error && (
          <div className={styles.errorState}>
            <p style={{ color: colors.textDangerDefault }}>{error}</p>
          </div>
        )}

        {!isGenerating && !error && autobiography && renderAutobiography()}

        {!isGenerating && !error && !autobiography && (
          <div className={styles.emptyState}>
            <div style={{ textAlign: 'center', color: colors.textCommonTertiary }}>
              <h3>Ready to tell your story?</h3>
              <p>Click "Generate Biography" to create your Internet Autobiography</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>
                Based on {visits.length} sampled entries (from {rows.length} total) across {sessionData.length} sessions
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 