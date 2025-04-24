import { ConversationStep, GradingResult, SessionData } from "../types";
import { sessionStore } from "../utils/sessionStore";
import { ocrService } from "./ocrService";
import { openaiService } from "./openaiService";

class ChatService {
  /**
   * Get the current session for a user ID
   */
  getSession(userId: string): SessionData {
    return sessionStore.getSession(userId);
  }

  /**
   * Initialize session if needed or prepare it for image upload
   */
  initializeSessionIfNeeded(userId: string): SessionData {
    const session = sessionStore.getSession(userId);

    // If the session is not in WAITING_FOR_ANSWER state, initialize it with a dummy question
    if (session.step !== ConversationStep.WAITING_FOR_ANSWER) {
      console.log("Initializing session for image upload");
      return sessionStore.updateSession(userId, {
        question: "Auto-generated question for image upload",
        step: ConversationStep.WAITING_FOR_ANSWER,
      });
    }

    return session;
  }

  /**
   * Process a text message from the teacher
   */
  async processTextMessage(userId: string, message: string): Promise<string> {
    const session = sessionStore.getSession(userId);
    console.log(
      `Processing message for user ${userId}, current step: ${session.step}`
    );

    // Special case: If the session is COMPLETE and the user sends any message,
    // treat it as starting a new session with that message as the question
    if (session.step === ConversationStep.COMPLETE) {
      console.log(
        `Transitioning from COMPLETE to a new session with question: "${message}"`
      );

      // Reset the session first
      sessionStore.resetSession(userId);

      // Immediately handle this message as a question
      return this.handleQuestionInput(userId, message);
    }

    // Normal flow - handle message based on the current conversation step
    switch (session.step) {
      case ConversationStep.WAITING_FOR_QUESTION:
        console.log(`Handling as question input: "${message}"`);
        return this.handleQuestionInput(userId, message);

      case ConversationStep.WAITING_FOR_ANSWER:
        // The teacher should upload an image, not send text
        console.log(`Received text but expecting an image upload`);
        return "Please upload an image of the student's answer.";

      case ConversationStep.WAITING_FOR_INSTRUCTION:
        console.log(`Handling as instruction input: "${message}"`);
        return this.handleInstructionInput(userId, message);

      default:
        console.log(
          `Unknown session state: ${session.step}, resetting session`
        );
        sessionStore.resetSession(userId);
        return "I'm sorry, something went wrong. Let's start over. Please send me the question you'd like to grade.";
    }
  }

  /**
   * Process an uploaded image
   */
  async processImageUpload(userId: string, imagePath: string): Promise<string> {
    const session = sessionStore.getSession(userId);
    console.log(
      `Processing image upload for user ${userId}, session state: ${session.step}`
    );

    // If the session is in COMPLETE state, we need to reset it first to allow a new upload
    if (session.step === ConversationStep.COMPLETE) {
      console.log(
        `Resetting completed session for user ${userId} before processing image`
      );
      sessionStore.resetSession(userId);
      // After reset, get the updated session
      const updatedSession = sessionStore.getSession(userId);

      // Set a default question since we're starting with an image upload
      sessionStore.updateSession(userId, {
        question: "Grading a student answer",
        step: ConversationStep.WAITING_FOR_ANSWER,
      });

      console.log(
        `Reset session to step ${updatedSession.step} for user ${userId}`
      );
    }

    // Get the current session again in case it was updated
    const currentSession = sessionStore.getSession(userId);

    // Check if we're expecting an answer image
    if (currentSession.step !== ConversationStep.WAITING_FOR_ANSWER) {
      console.log(
        `Unexpected image upload in session state: ${currentSession.step}`
      );
      // Force session to correct state if needed
      sessionStore.updateSession(userId, {
        step: ConversationStep.WAITING_FOR_ANSWER,
      });
      console.log(
        `Forced session state to WAITING_FOR_ANSWER for user ${userId}`
      );
    }

    try {
      // Extract text from the image
      const ocrText = await ocrService.extractTextFromImage(imagePath);
      console.log(
        `Successfully extracted OCR text (${ocrText.length} chars) for user ${userId}`
      );

      // Update session with the extracted text
      sessionStore.updateSession(userId, {
        studentAnswer: ocrText,
        step: ConversationStep.WAITING_FOR_INSTRUCTION,
      });
      console.log(
        `Updated session to WAITING_FOR_INSTRUCTION for user ${userId}`
      );

      return "Thanks! What would you like me to do? (e.g., 'Grade it for 6 marks', 'Give feedback')";
    } catch (error) {
      console.error(`Error processing image for user ${userId}:`, error);
      return "Sorry, I couldn't process the image. Please try uploading it again.";
    }
  }

  /**
   * Handle the question input from the teacher
   */
  private handleQuestionInput(userId: string, question: string): string {
    console.log(`Saving question for user ${userId}: "${question}"`);

    // Make sure question isn't empty
    if (!question || question.trim().length === 0) {
      console.error(`Empty question received for user ${userId}`);
      return "I couldn't understand your question. Please provide a question to grade.";
    }

    try {
      // Update session with the question
      const session = sessionStore.updateSession(userId, {
        question,
        step: ConversationStep.WAITING_FOR_ANSWER,
      });

      console.log(
        `Session updated for user ${userId}, question saved: "${session.question}"`
      );
      return "Got it. Now upload the student's answer sheet image.";
    } catch (error) {
      console.error(`Error saving question for user ${userId}:`, error);
      return "I encountered an error saving your question. Please try again.";
    }
  }

  /**
   * Handle the instruction input from the teacher
   */
  private async handleInstructionInput(
    userId: string,
    instruction: string
  ): Promise<string> {
    const session = sessionStore.getSession(userId);
    console.log(
      `Processing instruction: "${instruction}" for userId: ${userId}`
    );
    console.log(`Session data:`, JSON.stringify(session));

    // Check if we have all the required data
    if (!session.question || !session.studentAnswer) {
      console.log(
        `Missing data in session. Question: ${!!session.question}, Answer: ${!!session.studentAnswer}`
      );

      // Try to recover by setting default values if missing
      let updatedSession = session;

      if (!session.question) {
        console.log(
          `Attempting to recover missing question for user ${userId}`
        );
        updatedSession = sessionStore.updateSession(userId, {
          question: "Unknown question",
        });
      }

      if (!session.studentAnswer) {
        console.log(
          `Missing student answer cannot be recovered, resetting session for user ${userId}`
        );
        sessionStore.resetSession(userId);
        return "I couldn't find the student's answer. Let's start over. Please send me the question you'd like to grade.";
      }

      // If we made it here, we were able to recover
      console.log(
        `Recovered session data for user ${userId}:`,
        JSON.stringify(updatedSession)
      );
    }

    // Extract marks from the instruction (e.g., "Grade it for 6 marks")
    const marksMatch = instruction.match(/(\d+)\s*marks/i);
    const marks = marksMatch ? parseInt(marksMatch[1], 10) : 10; // Default to 10 if not specified
    console.log(`Using ${marks} marks for grading`);

    // Update session with the marks
    sessionStore.updateSession(userId, { marks });

    try {
      console.log(`Sending to OpenAI for grading...`);
      console.log(
        `Question: ${session.question?.substring(0, 50) || "MISSING"}...`
      );
      console.log(
        `Student Answer: ${
          session.studentAnswer?.substring(0, 50) || "MISSING"
        }...`
      );

      // Final safety check before calling OpenAI
      if (!session.question || !session.studentAnswer) {
        throw new Error("Missing required data for grading");
      }

      // Call OpenAI to grade the answer
      const gradingResult = await openaiService.gradeAnswer(
        session.question,
        session.studentAnswer,
        instruction,
        marks
      );

      console.log(
        `Received grading result: Score ${gradingResult.score}/${marks}`
      );

      // Format the response in a conversational way
      const response = this.formatGradingResponse(gradingResult, marks);

      // Mark the conversation as complete
      sessionStore.updateSession(userId, { step: ConversationStep.COMPLETE });

      return response;
    } catch (error) {
      console.error("Error grading answer:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }

      // Reset the session on error to avoid getting stuck
      sessionStore.resetSession(userId);
      return "Sorry, I couldn't process the grading request. Let's start over. Please send me the question you'd like to grade.";
    }
  }

  /**
   * Format the grading result into a conversational response
   */
  private formatGradingResponse(
    result: GradingResult,
    maxMarks: number
  ): string {
    const mistakesText =
      result.mistakes.length > 0
        ? `❌ Mistakes:\n${result.mistakes.map((m) => `- ${m}`).join("\n")}`
        : "";

    return `
✅ Score: ${result.score}/${maxMarks}
📝 Feedback: ${result.feedback}
${mistakesText}

Do you want to grade another answer? If so, please send me the new question.
    `.trim();
  }
}

export const chatService = new ChatService();
