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

import React, { useState, useEffect } from 'react';
import { useThemeColors, Button, Loading } from '@apitable/components';
import { Field, FieldType } from '@apitable/core';
import styles from './insights_panel.module.less';

interface IInsightsPanelProps {
  rows: any[];
  fieldMap: any;
  visibleColumns: any[];
  getCellValue: (recordId: string, fieldId: string) => any;
  apiKey?: string;
}

interface InsightResponse {
  hogwartsHouse?: {
    house: string;
    reason: string;
  };
  spiritAnimal?: {
    animal: string;
    reason: string;
  };
  weight?: {
    estimate: string;
    reason: string;
  };
  ethnicity?: {
    estimate: string;
    reason: string;
  };
}

export const InsightsPanel: React.FC<IInsightsPanelProps> = ({ 
  rows, 
  fieldMap, 
  visibleColumns, 
  getCellValue,
  apiKey
}) => {
  const colors = useThemeColors();
  const [insights, setInsights] = useState<InsightResponse>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Prepare data context from visible rows
  const prepareDataContext = () => {
    const limit = Math.min(rows.length, 100);
    const relevantData: any[] = [];

    for (let i = 0; i < limit; i++) {
      const row = rows[i];
      const rowData: any = {};

      visibleColumns.forEach(col => {
        const field = fieldMap[col.fieldId];
        if (field) {
          const value = getCellValue(row.recordId, col.fieldId);
          const displayValue = Field.bindModel(field).cellValueToString(value);
          if (displayValue) {
            rowData[field.name] = displayValue;
          }
        }
      });

      if (Object.keys(rowData).length > 0) {
        relevantData.push(rowData);
      }
    }

    return relevantData;
  };

  const generateInsights = async () => {
    if (!apiKey) {
      setError('Please configure your OpenAI API key in the Chat tab settings.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dataContext = prepareDataContext();
      const contextString = JSON.stringify(dataContext, null, 2);

      // Make API call to OpenAI with structured output
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an insightful analyst who makes creative guesses about people based on their data. Try and support your guesses with data provided. '
            },
            {
              role: 'user',
              content: `Based on this data, analyze and provide insights about the person. Here's the data:\n\n${contextString}\n\nProvide your analysis in the following JSON format:
{
  "hogwartsHouse": {
    "house": "Gryffindor/Slytherin/Hufflepuff/Ravenclaw",
    "reason": "Brief explanation"
  },
  "spiritAnimal": {
    "animal": "Animal name",
    "reason": "Brief explanation"
  },
  "weight": {
    "estimate": "Weight range",
    "reason": "Brief explanation"
  },
  "ethnicity": {
    "estimate": "White/Asian/Hispanic/Other",
    "reason": "Brief explanation"
  }
}`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 100000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API request failed`);
      }

      const data = await response.json();
      const parsedInsights = JSON.parse(data.choices[0].message.content);
      setInsights(parsedInsights);
      setHasGenerated(true);
    } catch (err: any) {
      console.error('Error generating insights:', err);
      setError(err.message || 'Failed to generate insights');
    } finally {
      setIsLoading(false);
    }
  };

  const InsightCard = ({ title, value, reason, icon }: { title: string; value: string; reason: string; icon: string }) => (
    <div className={styles.insightCard}>
      <div className={styles.cardHeader}>
        <span className={styles.icon}>{icon}</span>
        <h4>{title}</h4>
      </div>
      <div className={styles.cardContent}>
        <div className={styles.value}>{value}</div>
        <div className={styles.reason}>{reason}</div>
      </div>
    </div>
  );

  return (
    <div className={styles.insightsPanel}>
      {!hasGenerated && !isLoading && (
        <div className={styles.welcomeState}>
          <h3>Discover Your Data Insights</h3>
          <p>Get AI-powered insights about the data in your spreadsheet</p>
          <Button
            color="primary"
            onClick={generateInsights}
            disabled={!apiKey}
          >
            Generate Insights
          </Button>
          {!apiKey && (
            <p className={styles.apiKeyWarning}>
              Configure your OpenAI API key in the Chat tab to use this feature
            </p>
          )}
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingState}>
          <Loading />
          <p>Analyzing your data...</p>
        </div>
      )}

      {error && (
        <div className={styles.errorState}>
          <p>{error}</p>
          <Button onClick={generateInsights}>Try Again</Button>
        </div>
      )}

      {hasGenerated && !isLoading && (
        <div className={styles.insightsGrid}>
          {insights.hogwartsHouse && (
            <InsightCard
              title="Hogwarts House"
              value={insights.hogwartsHouse.house}
              reason={insights.hogwartsHouse.reason}
              icon="🏰"
            />
          )}
          
          {insights.spiritAnimal && (
            <InsightCard
              title="Spirit Animal"
              value={insights.spiritAnimal.animal}
              reason={insights.spiritAnimal.reason}
              icon="🦊"
            />
          )}
          
          {insights.weight && (
            <InsightCard
              title="Weight Estimate"
              value={insights.weight.estimate}
              reason={insights.weight.reason}
              icon="⚖️"
            />
          )}
          
          {insights.ethnicity && (
            <InsightCard
              title="Ethnicity"
              value={insights.ethnicity.estimate}
              reason={insights.ethnicity.reason}
              icon="🌍"
            />
          )}

          <div className={styles.regenerateButton}>
            <Button
              variant="jelly"
              onClick={generateInsights}
            >
              Regenerate Insights
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}; 