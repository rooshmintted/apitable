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

import React, { useState, useRef } from 'react';
import { useThemeColors, Button, TextInput, FloatUiTooltip as Tooltip } from '@apitable/components';
import { Field, FieldType } from '@apitable/core';
import { getEnvVars } from '../../../../get_env';
import styles from './ai_chat_interface.module.less';

interface IAIChatInterfaceProps {
  rows: any[];
  fieldMap: any;
  visibleColumns: any[];
  getCellValue: (recordId: string, fieldId: string) => any;
  apiKey?: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const AIChatInterface: React.FC<IAIChatInterfaceProps> = ({ 
  rows, 
  fieldMap, 
  visibleColumns, 
  getCellValue,
  apiKey: propsApiKey
}) => {
  const colors = useThemeColors();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'You are a helpful assistant analyzing spreadsheet data. You have access to date and URL information from the visible rows.'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get API key from props or environment
  const envApiKey = getEnvVars().OPENAI_API_KEY;
  const apiKey = propsApiKey || envApiKey;
  
  // Debug: Log API key status (remove in production)
  console.log('OpenAI API Key configured:', !!apiKey, 'Source:', propsApiKey ? 'UI Settings' : envApiKey ? '.env file' : 'Not configured');

  // Prepare data context from visible rows
  const prepareDataContext = () => {
    const limit = Math.min(rows.length, 500);
    const relevantData: any[] = [];

    // Find date and URL columns
    const dateColumns = visibleColumns.filter(col => {
      const field = fieldMap[col.fieldId];
      return field && (field.type === FieldType.DateTime || field.name.toLowerCase().includes('date'));
    });

    const urlColumns = visibleColumns.filter(col => {
      const field = fieldMap[col.fieldId];
      return field && (field.type === FieldType.URL || field.name.toLowerCase().includes('url'));
    });

    // Extract data from first 500 rows
    for (let i = 0; i < limit; i++) {
      const row = rows[i];
      const rowData: any = { row: i + 1 };

      // Add date fields
      dateColumns.forEach(col => {
        const field = fieldMap[col.fieldId];
        const value = getCellValue(row.recordId, col.fieldId);
        const displayValue = Field.bindModel(field).cellValueToString(value);
        if (displayValue) {
          rowData[field.name] = displayValue;
        }
      });

      // Add URL fields
      urlColumns.forEach(col => {
        const field = fieldMap[col.fieldId];
        const value = getCellValue(row.recordId, col.fieldId);
        const displayValue = Field.bindModel(field).cellValueToString(value);
        if (displayValue) {
          rowData[field.name] = displayValue;
        }
      });

      if (Object.keys(rowData).length > 1) {
        relevantData.push(rowData);
      }
    }

    return relevantData;
  };

  const handleSubmit = async () => {
    if (!inputText.trim() || isLoading) return;

    if (!apiKey) {
      setError('OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env file.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      // Prepare context data
      const dataContext = prepareDataContext();
      const contextString = dataContext.length > 0 
        ? `\n\nContext data (dates and URLs from the spreadsheet):\n${JSON.stringify(dataContext, null, 2)}`
        : '';

      // Create the new user message with context
      const userMessage: Message = {
        role: 'user',
        content: inputText + contextString
      };

      // Update messages with user message
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // Debug: Log the request payload
      const requestPayload = {
        model: 'gpt-4o-mini',
        messages: updatedMessages,
        max_completion_tokens: 100000,
        stream: false
      };
      console.log('OpenAI API Request:', requestPayload);

      // Make API call to OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer`
        },
                  body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: updatedMessages,
            max_completion_tokens: 16384,
            stream: false
          }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('OpenAI API Response:', data);
      
      if (data.choices && data.choices.length > 0) {
        const assistantContent = data.choices[0].message.content;
        console.log('Assistant Response:', assistantContent);
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: assistantContent
        };
        const newMessages = [...updatedMessages, assistantMessage];
        console.log('Updated messages array:', newMessages);
        setMessages(newMessages);
        console.log('Messages state should be updated now');
      } else {
        console.error('No choices in response:', data);
        throw new Error('No response generated');
      }

      // Clear input after successful submission
      setInputText('');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request was cancelled');
      } else {
        console.error('OpenAI API error:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate response');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // Filter to show only user and assistant messages (not system)
  const displayMessages = messages.filter(msg => msg.role !== 'system');
  console.log('Current messages state:', messages);
  console.log('Display messages:', displayMessages);

  return (
    <div className={styles.aiChatInterface}>
      <h3 className={styles.sectionTitle}>AI Assistant</h3>
      
      {!apiKey && (
        <div className={styles.warningMessage}>
          <strong>Configuration Required:</strong> Please configure your OpenAI API key using the settings button above.
        </div>
      )}
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      <div className={styles.chatContainer}>
        {displayMessages.map((message, index) => (
          <div 
            key={index} 
            className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}
          >
            <div className={styles.messageHeader}>
              {message.role === 'user' ? 'You' : 'AI Assistant'}
            </div>
            <div className={styles.messageContent}>
              {message.content.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < message.content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className={styles.loadingMessage}>
            <div className={styles.spinner} />
            <span>AI is thinking...</span>
            <Button
              onClick={handleCancelRequest}
              size="small"
              variant="fill"
              className={styles.cancelButton}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className={styles.inputContainer}>
        <TextInput
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={!apiKey ? "Configure API key to enable chat..." : "Ask a question about your data..."}
          disabled={isLoading || !apiKey}
          className={styles.textInput}
        />
        <Tooltip
          content={
            !apiKey ? "OpenAI API key not configured" : 
            !inputText.trim() ? "Please enter a message" : 
            ""
          }
          placement="top"
        >
          <span>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !inputText.trim() || !apiKey}
              loading={isLoading}
              color="primary"
              className={styles.submitButton}
            >
              Send
            </Button>
          </span>
        </Tooltip>
      </div>
    </div>
  );
}; 