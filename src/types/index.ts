// Define the conversation steps
export enum ConversationStep {
    WAITING_FOR_QUESTION = 'waiting_for_question',
    WAITING_FOR_ANSWER = 'waiting_for_answer',
    WAITING_FOR_INSTRUCTION = 'waiting_for_instruction',
    COMPLETE = 'complete'
  }
  
  // Session data structure
  export interface SessionData {
    userId: string;
    question: string | null;
    studentAnswer: string | null;
    marks: number | null;
    step: ConversationStep;
  }
  
  // Chat request structure
  export interface ChatRequest {
    message: string;
    userId: string;
  }
  
  // Grading result from OpenAI
  export interface GradingResult {
    score: number;
    feedback: string;
    mistakes: string[];
  }
  
  // OpenAI response structure
  export interface OpenAIResponse {
    choices: {
      message: {
        content: string;
      };
    }[];
  }