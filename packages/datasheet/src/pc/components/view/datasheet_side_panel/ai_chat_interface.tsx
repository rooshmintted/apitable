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
  originalInput?: string; // For user messages, store the original input without context
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
  const apiKey = propsApiKey;
  
  // Debug: Log API key status (remove in production)
  console.log('OpenAI API Key configured:', !!apiKey);

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
      setError('OpenAI API key is not configured. Please click the settings button above to add your API key.');
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
        content: inputText + contextString,
        originalInput: inputText // Store original user input for display
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
          'Authorization': `Bearer ${apiKey}`
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

  const handleQuestionClick = (question: string) => {
    setInputText(question);
    // Optionally auto-submit the question
    // handleSubmit();
  };

  const suggestedQuestions = [
    "What time am I most productive?",
    "What are my biggest time-wasting websites and how much time do I spend on them?",
    "When do I browse the most questionable content? 👀",
    "Am I a night owl or early bird based on my browsing patterns?",
    "What's my procrastination-to-productivity ratio and which sites are my biggest distractions?"
  ];

  // Filter to show only user and assistant messages (not system)
  const displayMessages = messages.filter(msg => msg.role !== 'system');

  return (
    <div className={styles.aiChatInterface}>
      <div className={styles.explanatoryText}>
        <p>💡 <strong>Discover insights about your browsing habits!</strong></p>
        <p>Ask questions about your internet history to uncover patterns, productivity insights, and interesting trends in your digital behavior.</p>
      </div>
      
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
        {displayMessages.map((message, index) => {
          // For user messages, show original input; for assistant messages, show full content
          const displayContent = message.role === 'user' && message.originalInput ? message.originalInput : message.content;
          
          return (
            <div 
              key={index} 
              className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}
            >
              <div className={styles.messageHeader}>
                {message.role === 'user' ? 'You' : 'AI Assistant'}
              </div>
              <div className={styles.messageContent}>
                {displayContent.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < displayContent.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })}
        
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

      <div className={styles.suggestedQuestions}>
        <h4>Popular questions to get you started:</h4>
        <div className={styles.questionButtons}>
          {suggestedQuestions.map((question, index) => (
            <Button
              key={index}
              onClick={() => handleQuestionClick(question)}
              variant="jelly"
              size="small"
              className={styles.questionButton}
              disabled={isLoading || !apiKey}
            >
              {question}
            </Button>
          ))}
        </div>
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