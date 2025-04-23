// OpenAI configuration
import dotenv from 'dotenv';

dotenv.config();

export const OPENAI_CONFIG = {
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    maxTokens: 500,
    temperature: 0.3,
  };