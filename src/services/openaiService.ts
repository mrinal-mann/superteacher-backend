// Add these methods to your openaiService.ts file

import axios from "axios";
import { OPENAI_CONFIG } from "../config/openai";

/**
 * Generate a conversational response
 */
async generateConversation(
  systemPrompt: string,
  userMessage: string,
  history: { role: string; content: string }[] = []
): Promise<string> {  
  try {
    console.log(`Generating conversational response with model: ${this.model}`);
    
    // Prepare messages array with system prompt, history and user message
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage }
    ];
    
    // Call the API
    const response = await axios.post(
      this.apiEndpoint,
      {
        model: this.model,
        messages: messages,
        max_tokens: OPENAI_CONFIG.maxTokens,
        temperature: 0.7, // Higher for more natural conversation
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 60000, // 1 minute timeout
      }
    );
    
    console.log(`Received conversational response from AI API`);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating conversational response:", error);
    throw error;
  }
}

/**
 * Generate text with a specific prompt
 */
async generateText(
  prompt: string,
  temperature: number = 0.1
): Promise<string> {
  try {
    console.log(`Generating text with prompt: ${prompt.substring(0, 50)}...`);
    
    const response = await axios.post(
      this.apiEndpoint,
      {
        model: this.model,
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: OPENAI_CONFIG.maxTokens,
        temperature: temperature,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 60000,
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
}

/**
 * Analyze an image using GPT-4 Vision
 */
async analyzeImage(
  imageUrl: string,
  prompt: string = "Extract all text from this image exactly as it appears."
): Promise<string> {
  try {
    console.log(`Analyzing image with GPT-4 Vision: ${imageUrl}`);
    
    const response = await axios.post(
      this.apiEndpoint,
      {
        model: "gpt-4o", // GPT-4o supports vision
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: OPENAI_CONFIG.maxTokens,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 120000, // 2 minute timeout for image processing
      }
    );
    
    console.log(`Received image analysis from Vision API`);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
}