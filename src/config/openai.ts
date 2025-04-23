// OpenAI configuration
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY || "your-api-key";

// Use gpt-3.5-turbo as it's more widely available
export const OPENAI_CONFIG = {
  apiKey,
  model: "gpt-3.5-turbo",
  maxTokens: 500,
  temperature: 0.3,
};
