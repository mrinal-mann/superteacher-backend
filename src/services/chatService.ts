import { ConversationStep, GradingResult } from '../types';
import { sessionStore } from '../utils/sessionStore';
import { ocrService } from './ocrService';
import { openaiService } from './openaiService';

class ChatService {
  /**
   * Process a text message from the teacher
   */
  async processTextMessage(userId: string, message: string): Promise<string> {
    const session = sessionStore.getSession(userId);

    // Handle message based on the current conversation step
    switch (session.step) {
      case ConversationStep.WAITING_FOR_QUESTION:
        return this.handleQuestionInput(userId, message);
      
      case ConversationStep.WAITING_FOR_ANSWER:
        // The teacher should upload an image, not send text
        return "Please upload an image of the student's answer.";
      
      case ConversationStep.WAITING_FOR_INSTRUCTION:
        return this.handleInstructionInput(userId, message);
      
      case ConversationStep.COMPLETE:
        // Start a new grading session
        sessionStore.resetSession(userId);
        return "Starting a new grading session. Please send me the question you'd like to grade.";
      
      default:
        return "I'm sorry, something went wrong. Let's start over. Please send me the question you'd like to grade.";
    }
  }

  /**
   * Process an uploaded image
   */
  async processImageUpload(userId: string, imagePath: string): Promise<string> {
    const session = sessionStore.getSession(userId);

    // Check if we're expecting an answer image
    if (session.step !== ConversationStep.WAITING_FOR_ANSWER) {
      return "I'm not expecting an image at this point. Please follow the conversation flow.";
    }

    try {
      // Extract text from the image
      const ocrText = await ocrService.extractTextFromImage(imagePath);
      
      // Update session with the extracted text
      sessionStore.updateSession(userId, {
        studentAnswer: ocrText,
        step: ConversationStep.WAITING_FOR_INSTRUCTION
      });

      return "Thanks! What would you like me to do? (e.g., 'Grade it for 6 marks', 'Give feedback')";
    } catch (error) {
      console.error('Error processing image:', error);
      return "Sorry, I couldn't process the image. Please try uploading it again.";
    }
  }

  /**
   * Handle the question input from the teacher
   */
  private handleQuestionInput(userId: string, question: string): string {
    // Update session with the question
    sessionStore.updateSession(userId, {
      question,
      step: ConversationStep.WAITING_FOR_ANSWER
    });

    return "Got it. Now upload the student's answer sheet image.";
  }

  /**
   * Handle the instruction input from the teacher
   */
  private async handleInstructionInput(userId: string, instruction: string): Promise<string> {
    const session = sessionStore.getSession(userId);

    // Check if we have all the required data
    if (!session.question || !session.studentAnswer) {
      return "I'm missing some information. Let's start over. Please send me the question you'd like to grade.";
    }

    // Extract marks from the instruction (e.g., "Grade it for 6 marks")
    const marksMatch = instruction.match(/(\d+)\s*marks/i);
    const marks = marksMatch ? parseInt(marksMatch[1], 10) : 10; // Default to 10 if not specified

    // Update session with the marks
    sessionStore.updateSession(userId, { marks });

    try {
      // Call OpenAI to grade the answer
      const gradingResult = await openaiService.gradeAnswer(
        session.question,
        session.studentAnswer,
        instruction,
        marks
      );

      // Format the response in a conversational way
      const response = this.formatGradingResponse(gradingResult, marks);

      // Mark the conversation as complete
      sessionStore.updateSession(userId, { step: ConversationStep.COMPLETE });

      return response;
    } catch (error) {
      console.error('Error grading answer:', error);
      return "Sorry, I couldn't process the grading request. Please try again.";
    }
  }

  /**
   * Format the grading result into a conversational response
   */
  private formatGradingResponse(result: GradingResult, maxMarks: number): string {
    const mistakesText = result.mistakes.length > 0 
      ? `❌ Mistakes:\n${result.mistakes.map(m => `- ${m}`).join('\n')}`
      : '';

    return `
✅ Score: ${result.score}/${maxMarks}
📝 Feedback: ${result.feedback}
${mistakesText}

Do you want to grade another answer? If so, please send me the new question.
    `.trim();
  }
}

export const chatService = new ChatService();