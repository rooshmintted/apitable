# AI Chat Interface Setup

This AI chat interface uses the OpenAI API to provide intelligent assistance for analyzing your spreadsheet data.

## Configuration

To use the AI chat feature, you need to configure your OpenAI API key:

1. Create a `.env` file in the `packages/datasheet` directory if it doesn't exist
2. Add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
3. Restart the development server for the changes to take effect

Note: The `.env` file should be in the `packages/datasheet` directory, not the root directory.

## Getting an API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to [API Keys](https://platform.openai.com/api-keys)
4. Create a new API key
5. Copy the key and add it to your `.env` file

## Features

- Real-time chat interface with the AI assistant
- Context-aware responses based on visible spreadsheet data
- Automatic extraction of date and URL fields for better context
- Support for analyzing up to 500 rows of data
- Streaming responses for better user experience
- Ability to cancel ongoing requests

## Usage

1. Open the datasheet side panel
2. Navigate to the AI Assistant section
3. Type your question about the data
4. Press Enter or click Send to get a response

The AI assistant has access to:
- Date fields from your spreadsheet
- URL fields from your spreadsheet
- Basic structure and content of visible rows

## Security Note

Never commit your `.env` file to version control. Make sure it's listed in your `.gitignore` file. 