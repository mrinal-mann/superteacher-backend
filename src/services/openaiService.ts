import axios from 'axios';
import { OPENAI_CONFIG } from '../config/openai';
import { GradingResult, OpenAIResponse } from '../types';

class OpenAIService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = OPENAI_CONFIG.apiKey;
    this.model = OPENAI_CONFIG.model;
  }

  /**
   * Call OpenAI GPT-4 to grade a student's answer
   */
  async gradeAnswer(
    question: string,
    studentAnswer: string,
    instruction: string,
    maxMarks: number
  ): Promise<GradingResult> {
    try {
      const prompt = this.buildGradingPrompt(question, studentAnswer, instruction, maxMarks);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: OPENAI_CONFIG.maxTokens,
          temperature: OPENAI_CONFIG.temperature,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const result = response.data as OpenAIResponse;
      const content = result.choices[0].message.content;
      
      // Parse the JSON response
      const gradingResult = JSON.parse(content) as GradingResult;
      return gradingResult;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      throw new Error('Failed to process grading request');
    }
  }

  /**
   * Build the prompt for grading
   */
  private buildGradingPrompt(
    question: string,
    studentAnswer: string,
    instruction: string,
    maxMarks: number
  ): string {
    return `
You are an expert teacher grading an exam answer.

EXAM QUESTION:
${question}

STUDENT'S ANSWER:
${studentAnswer}

INSTRUCTION:
${instruction}
Maximum marks: ${maxMarks}

Please provide a fair assessment of this answer based on accuracy, completeness, and understanding of the concept.
Return ONLY a JSON response with the following format:
{
  "score": (a number from 0 to ${maxMarks}),
  "feedback": (a brief explanation of the grade),
  "mistakes": (an array of strings listing key mistakes or omissions)
}
`;
  }
}

export const openaiService = new OpenAIService();