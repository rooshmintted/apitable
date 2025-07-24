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
  sex?: {
    estimate: string;
    reason: string;
  };
  philosopher?: {
    philosopher: string;
    reason: string;
  };
  artStyle?: {
    style: string;
    reason: string;
  };
  cognitiveStyle?: {
    style: string;
    reason: string;
  };
  productivityChronotype?: {
    type: string;
    reason: string;
  };
  intellectualArchetype?: {
    archetype: string;
    reason: string;
  };
  curiosityCompass?: {
    mode: string;
    reason: string;
  };
  problemSolvingMode?: {
    mode: string;
    reason: string;
  };
  gameStyleAnalogy?: {
    style: string;
    reason: string;
  };
  spendingPersona?: {
    persona: string;
    reason: string;
  };
  internetAlignment?: {
    alignment: string;
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

      // Debug: Log API key for debugging
      console.log('Insights Panel - API Key:', apiKey);
      
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
              content: 'You are an insightful analyst who makes creative guesses about people based on their browsing history and web data. IMPORTANT: In your reasoning, always cite specific examples from the browsing data provided to support your insights. Reference actual websites, tools, or patterns you observe in their digital behavior.'
            },
            {
              role: 'user',
              content: `Based on this browsing history data, analyze and provide insights about this person's digital personality. Here's the data:\n\n${contextString}\n\nProvide your analysis in the following JSON format, making sure to cite specific examples from their browsing data in each reason:

{
  "hogwartsHouse": {
    "house": "Gryffindor/Slytherin/Hufflepuff/Ravenclaw",
    "reason": "Brief explanation citing specific browsing examples"
  },
  "spiritAnimal": {
    "animal": "Animal name",
    "reason": "Brief explanation citing specific browsing examples"
  },
  "sex": {
    "estimate": "Male/Female",
    "reason": "Brief explanation citing gender-related browsing patterns or interests"
  },
  "philosopher": {
    "philosopher": "Philosopher name (e.g., Socrates, Nietzsche, Confucius, etc.)",
    "reason": "Brief explanation citing philosophical or intellectual browsing patterns"
  },
  "artStyle": {
    "style": "Art movement/style (e.g., Impressionism, Modernism, Street Art, etc.)",
    "reason": "Brief explanation citing aesthetic preferences or creative browsing patterns"
  },
  "cognitiveStyle": {
    "style": "Strategic Synthesizer/Pattern Recognizer/Systems Thinker/Creative Connector, etc",
    "reason": "Brief explanation citing specific websites or tools they use"
  },
  "productivityChronotype": {
    "type": "Midnight Tactician/Dawn Warrior/Afternoon Optimizer/Evening Explorer, etc",
    "reason": "Brief explanation citing timestamp patterns or productivity tools"
  },
  "intellectualArchetype": {
    "archetype": "Digital Librarian/Knowledge Curator/Information Hunter/Research Savant, etc",
    "reason": "Brief explanation citing documentation sites, forums, or learning patterns"
  },
  "curiosityCompass": {
    "mode": "Explorer Mode: On/Deep Dive Specialist/Breadth Seeker/Focused Researcher, etc",
    "reason": "Brief explanation citing topic diversity or depth patterns"
  },
  "problemSolvingMode": {
    "mode": "Stack Overflow Sorcerer/GitHub Archaeologist/Community Wisdom Seeker/Original Thinker, etc",
    "reason": "Brief explanation citing help-seeking or solution-finding patterns"
  },
  "gameStyleAnalogy": {
    "style": "4X Strategist/Puzzle Master/Action Optimizer/Simulation Enthusiast, etc",
    "reason": "Brief explanation citing analytical or strategic browsing patterns"
  },
  "spendingPersona": {
    "persona": "Value Hacker/Deal Hunter/Research Shopper/Impulse Controller, etc",
    "reason": "Brief explanation citing shopping research or financial tool usage"
  },
  "internetAlignment": {
    "alignment": "Chaotic Neutral/Lawful Researcher/Neutral Explorer/Digital Nomad, etc",
    "reason": "Brief explanation citing browsing diversity and platform usage patterns"
  }
}`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 16384
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
          
          {insights.sex && (
            <InsightCard
              title="Sex"
              value={insights.sex.estimate}
              reason={insights.sex.reason}
              icon="👤"
            />
          )}

          {insights.philosopher && (
            <InsightCard
              title="Philosopher Match"
              value={insights.philosopher.philosopher}
              reason={insights.philosopher.reason}
              icon="🤔"
            />
          )}

          {insights.artStyle && (
            <InsightCard
              title="Art Style"
              value={insights.artStyle.style}
              reason={insights.artStyle.reason}
              icon="🎨"
            />
          )}

          {insights.cognitiveStyle && (
            <InsightCard
              title="Cognitive Style"
              value={insights.cognitiveStyle.style}
              reason={insights.cognitiveStyle.reason}
              icon="🧠"
            />
          )}

          {insights.productivityChronotype && (
            <InsightCard
              title="Productivity Chronotype"
              value={insights.productivityChronotype.type}
              reason={insights.productivityChronotype.reason}
              icon="⏰"
            />
          )}

          {insights.intellectualArchetype && (
            <InsightCard
              title="Intellectual Archetype"
              value={insights.intellectualArchetype.archetype}
              reason={insights.intellectualArchetype.reason}
              icon="📚"
            />
          )}

          {insights.curiosityCompass && (
            <InsightCard
              title="Curiosity Compass"
              value={insights.curiosityCompass.mode}
              reason={insights.curiosityCompass.reason}
              icon="🧭"
            />
          )}

          {insights.problemSolvingMode && (
            <InsightCard
              title="Problem-Solving Mode"
              value={insights.problemSolvingMode.mode}
              reason={insights.problemSolvingMode.reason}
              icon="🛠️"
            />
          )}

          {insights.gameStyleAnalogy && (
            <InsightCard
              title="Game Style Analogy"
              value={insights.gameStyleAnalogy.style}
              reason={insights.gameStyleAnalogy.reason}
              icon="🎮"
            />
          )}

          {insights.spendingPersona && (
            <InsightCard
              title="Spending Persona"
              value={insights.spendingPersona.persona}
              reason={insights.spendingPersona.reason}
              icon="💸"
            />
          )}

          {insights.internetAlignment && (
            <InsightCard
              title="Internet Alignment"
              value={insights.internetAlignment.alignment}
              reason={insights.internetAlignment.reason}
              icon="🌐"
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