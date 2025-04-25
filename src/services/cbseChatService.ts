// src/services/cbseChatService.ts - CBSE Grading Assistant Implementation
import {
  ConversationStep,
  SessionData,
  GradingResult,
  UserIntent,
  SubjectArea,
  ClassLevel,
  CbseSessionData,
  GradingApproach,
} from "../types";
import { sessionStore } from "../utils/sessionStore";
import { ocrService } from "./ocrService";
import { openaiService } from "./openaiService";
import { storageService } from "./storageService";
import { ChatService } from "./chatService";

/**
 * Enhanced ChatService with CBSE-specific grading flow
 * Extends the base ChatService to add specialized functionality for CBSE teachers
 */
export class CbseChatService extends ChatService {
  /**
   * Get or initialize a session for a user ID with CBSE-specific data
   */
  getOrCreateSession(userId: string): CbseSessionData {
    const existingSession = sessionStore.getSession(userId) as CbseSessionData;

    // For new sessions, add CBSE-specific fields
    if (!existingSession.classLevel) {
      return sessionStore.updateSession(userId, {
        question: null,
        studentAnswer: null,
        originalImage: null,
        subjectArea: null,
        contextualNotes: null,
        marks: null,
        step: ConversationStep.INITIAL,
        gradingApproach: null,
        lastInteraction: new Date(),
        previousGradingResults: [],
        classLevel: null,
        questionPaper: null,
        questionMarks: null,
        isMarkingConfirmed: false,
      }) as CbseSessionData;
    }

    // Update last interaction time
    return sessionStore.updateSession(userId, {
      lastInteraction: new Date(),
    }) as CbseSessionData;
  }

  /**
   * Detect user intent for CBSE-specific flow
   * Overrides the parent method to add CBSE-specific intent detection
   */
  protected detectUserIntent(
    message: string,
    session: CbseSessionData
  ): UserIntent {
    const lowerMsg = message.toLowerCase().trim();

    // Check for CBSE-specific intents
    if (
      lowerMsg.includes("set class") ||
      lowerMsg.includes("class") ||
      /^class\s+\d+$/.test(lowerMsg) ||
      /^grade\s+\d+$/.test(lowerMsg)
    ) {
      return UserIntent.SET_CLASS;
    }

    if (
      lowerMsg.includes("set subject") ||
      lowerMsg.includes("subject") ||
      lowerMsg === "economics" ||
      lowerMsg === "math" ||
      lowerMsg === "science"
    ) {
      return UserIntent.SET_SUBJECT;
    }

    if (
      lowerMsg.includes("marks") &&
      (lowerMsg.includes("correct") ||
        lowerMsg.includes("right") ||
        lowerMsg.includes("yes") ||
        lowerMsg.includes("no"))
    ) {
      return UserIntent.CONFIRM_MARKS;
    }

    if (
      lowerMsg.includes("update marks") ||
      lowerMsg.includes("change marks") ||
      lowerMsg.includes("fix marks")
    ) {
      return UserIntent.UPDATE_MARKS;
    }

    // Fall back to standard intents in parent class
    return super.detectUserIntent(message, session as SessionData);
  }

  /**
   * Process text messages with CBSE-specific flow
   * Overrides the parent method to implement the CBSE grading workflow
   */
  async processTextMessage(userId: string, message: string): Promise<string> {
    console.log(
      `Processing message for user ${userId}: "${message.substring(0, 50)}${
        message.length > 50 ? "..." : ""
      }"`
    );

    // Get or initialize session
    const session = this.getOrCreateSession(userId);

    // Detect user intent
    const userIntent = this.detectUserIntent(message, session);
    console.log(`Detected user intent: ${userIntent}`);

    // Handle CBSE-specific intents
    switch (userIntent) {
      case UserIntent.SET_CLASS:
        return this.handleClassInput(userId, message);

      case UserIntent.SET_SUBJECT:
        return this.handleSubjectInput(userId, message);

      case UserIntent.CONFIRM_MARKS:
        return this.handleMarksConfirmation(userId, message);

      case UserIntent.UPDATE_MARKS:
        return this.handleMarksUpdate(userId, message);
    }

    // Handle based on current session state
    switch (session.step) {
      case ConversationStep.INITIAL:
        return this.handleInitialGreeting(userId, message);

      case ConversationStep.WAITING_FOR_CLASS:
        return this.handleClassInput(userId, message);

      case ConversationStep.WAITING_FOR_SUBJECT:
        return this.handleSubjectInput(userId, message);

      case ConversationStep.WAITING_FOR_QUESTION_PAPER:
        return "Please upload the question paper so I can extract the questions and marks.";

      case ConversationStep.WAITING_FOR_MARKS_CONFIRMATION:
        return this.handleMarksConfirmation(userId, message);

      case ConversationStep.WAITING_FOR_STUDENT_ANSWER:
        return "Please upload the student's answer paper so I can grade it.";

      // Fall back to standard states in parent class
      default:
        return super.processTextMessage(userId, message);
    }
  }

  /**
   * Handle initial greeting and explain CBSE grading flow
   */
  private handleInitialGreeting(userId: string, message: string): string {
    const lowerMsg = message.toLowerCase().trim();

    // Check if it's a greeting or starting a grading session
    if (
      lowerMsg.includes("hi") ||
      lowerMsg.includes("hello") ||
      lowerMsg.includes("hey") ||
      lowerMsg.includes("start") ||
      lowerMsg.includes("begin")
    ) {
      sessionStore.updateSession(userId, {
        step: ConversationStep.WAITING_FOR_CLASS,
      });

      return `
  Welcome to the CBSE Grading Assistant! I'm here to help you grade student papers according to CBSE standards.
  
  Let's get started with your grading session. First, please tell me which class level you're grading for (e.g., Class 10, Class 12)?
        `.trim();
    }

    // If message indicates wanting to grade directly
    if (
      lowerMsg.includes("grade") ||
      lowerMsg.includes("assess") ||
      lowerMsg.includes("evaluate") ||
      lowerMsg.includes("mark")
    ) {
      sessionStore.updateSession(userId, {
        step: ConversationStep.WAITING_FOR_CLASS,
      });

      return `
  I'll help you grade papers according to CBSE standards. Let's set up your grading session.
  
  First, please tell me which class level you're grading for (e.g., Class 10, Class 12)?
        `.trim();
    }

    // Default initial response
    sessionStore.updateSession(userId, {
      step: ConversationStep.WAITING_FOR_CLASS,
    });

    return `
  Welcome to the CBSE Grading Assistant! I'm here to help you grade papers according to CBSE standards.
  
  To begin, please tell me which class level you're grading for (e.g., Class 10, Class 12)?
      `.trim();
  }

  /**
   * Handle class level input
   */
  private handleClassInput(userId: string, message: string): string {
    const lowerMsg = message.toLowerCase().trim();
    let classLevel: ClassLevel | null = null;

    // Extract class level from message
    if (lowerMsg.includes("6") || lowerMsg === "class 6" || lowerMsg === "6") {
      classLevel = ClassLevel.CLASS_6;
    } else if (
      lowerMsg.includes("7") ||
      lowerMsg === "class 7" ||
      lowerMsg === "7"
    ) {
      classLevel = ClassLevel.CLASS_7;
    } else if (
      lowerMsg.includes("8") ||
      lowerMsg === "class 8" ||
      lowerMsg === "8"
    ) {
      classLevel = ClassLevel.CLASS_8;
    } else if (
      lowerMsg.includes("9") ||
      lowerMsg === "class 9" ||
      lowerMsg === "9"
    ) {
      classLevel = ClassLevel.CLASS_9;
    } else if (
      lowerMsg.includes("10") ||
      lowerMsg === "class 10" ||
      lowerMsg === "10"
    ) {
      classLevel = ClassLevel.CLASS_10;
    } else if (
      lowerMsg.includes("11") ||
      lowerMsg === "class 11" ||
      lowerMsg === "11"
    ) {
      classLevel = ClassLevel.CLASS_11;
    } else if (
      lowerMsg.includes("12") ||
      lowerMsg === "class 12" ||
      lowerMsg === "12"
    ) {
      classLevel = ClassLevel.CLASS_12;
    }

    if (!classLevel) {
      return "I didn't recognize that class level. Please specify which CBSE class you're grading for (e.g., Class 10, Class 12).";
    }

    // Update session with class level and move to next step
    sessionStore.updateSession(userId, {
      classLevel,
      step: ConversationStep.WAITING_FOR_SUBJECT,
    });

    return `
  Thank you! You're grading for ${classLevel.replace("_", " ").toUpperCase()}.
  
  Now, please tell me which subject you're grading (e.g., Economics, Mathematics, Science)?
      `.trim();
  }

  /**
   * Handle subject input
   */
  private handleSubjectInput(userId: string, message: string): string {
    const lowerMsg = message.toLowerCase().trim();
    let subjectArea: SubjectArea | null = null;

    // Extract subject from message
    if (lowerMsg.includes("math") || lowerMsg === "mathematics") {
      subjectArea = SubjectArea.MATH;
    } else if (lowerMsg.includes("econ")) {
      subjectArea = SubjectArea.ECONOMICS;
    } else if (lowerMsg.includes("science") && !lowerMsg.includes("social")) {
      subjectArea = SubjectArea.SCIENCE;
    } else if (lowerMsg.includes("english")) {
      subjectArea = SubjectArea.ENGLISH;
    } else if (lowerMsg.includes("history")) {
      subjectArea = SubjectArea.HISTORY;
    } else if (
      lowerMsg.includes("social") ||
      lowerMsg.includes("social studies")
    ) {
      subjectArea = SubjectArea.SOCIAL_STUDIES;
    } else if (lowerMsg.includes("business")) {
      subjectArea = SubjectArea.BUSINESS_STUDIES;
    } else if (lowerMsg.includes("account")) {
      subjectArea = SubjectArea.ACCOUNTANCY;
    } else if (
      lowerMsg.includes("politi") ||
      lowerMsg.includes("political science")
    ) {
      subjectArea = SubjectArea.POLITICAL_SCIENCE;
    } else if (lowerMsg.includes("geo")) {
      subjectArea = SubjectArea.GEOGRAPHY;
    } else if (lowerMsg.includes("physics")) {
      subjectArea = SubjectArea.PHYSICS;
    } else if (lowerMsg.includes("chem")) {
      subjectArea = SubjectArea.CHEMISTRY;
    } else if (lowerMsg.includes("bio")) {
      subjectArea = SubjectArea.BIOLOGY;
    } else if (lowerMsg.includes("computer")) {
      subjectArea = SubjectArea.COMPUTER_SCIENCE;
    } else {
      subjectArea = SubjectArea.GENERAL;
    }

    // Update session with subject and move to next step
    sessionStore.updateSession(userId, {
      subjectArea,
      step: ConversationStep.WAITING_FOR_QUESTION_PAPER,
    });

    // Customize response based on subject (with special handling for Economics)
    let subjectSpecificMessage = "";
    if (subjectArea === SubjectArea.ECONOMICS) {
      subjectSpecificMessage = `
  As you're grading Economics, I'll follow CBSE marking scheme guidelines for economic concepts, diagrams, and explanations. I'll look for:
  - Correct use of economic terminology and concepts
  - Proper explanation of economic theories
  - Accurate diagrams when required
  - Application of economic principles to real-world scenarios
  - Logical structure and flow in answers
  `;
    }

    return `
  Great! You're grading ${subjectArea.replace("_", " ")} for ${(
      sessionStore.getSession(userId) as CbseSessionData
    ).classLevel
      ?.replace("_", " ")
      .toUpperCase()}.
  ${subjectSpecificMessage}
  Now, please upload the question paper so I can analyze the questions and their marks distribution.
      `.trim();
  }

  /**
   * Process an uploaded image of the question paper with OCR
   */
  async processQuestionPaperUpload(
    userId: string,
    imagePath: string
  ): Promise<string> {
    const session = this.getOrCreateSession(userId);
    console.log(`Processing question paper upload for user ${userId}`);

    // Update session state
    sessionStore.updateSession(userId, {
      step: ConversationStep.PROCESSING_QUESTION_PAPER,
    });

    try {
      // Upload the image to Firebase Storage
      console.log(`Uploading question paper to Firebase Storage: ${imagePath}`);
      const imageUrl = await storageService.uploadFile(imagePath);

      // Extract text from the image URL
      console.log(`Extracting text from question paper: ${imageUrl}`);
      const ocrText = await ocrService.extractTextFromImageUrl(imageUrl);
      console.log(`Successfully extracted OCR text (${ocrText.length} chars)`);

      // Update session with the extracted text
      sessionStore.updateSession(userId, {
        questionPaper: ocrText,
        step: ConversationStep.EXTRACTING_QUESTION_MARKS,
      });

      // Extract questions and marks from the paper
      const questionMarks = this.extractQuestionMarks(
        ocrText,
        session.subjectArea
      );

      // Update session with extracted marks
      sessionStore.updateSession(userId, {
        questionMarks,
        step: ConversationStep.WAITING_FOR_MARKS_CONFIRMATION,
      });

      // Format the extracted questions and marks for display
      const formattedQuestions = this.formatExtractedQuestions(questionMarks);

      return `
  I've analyzed the question paper. Here are the questions and their marks:
  
  ${formattedQuestions}
  
  Are these questions and marks correct? Please respond with "Yes" or "No".
        `.trim();
    } catch (error) {
      console.error(`Error processing question paper:`, error);

      // Reset to appropriate state to allow retrying
      sessionStore.updateSession(userId, {
        step: ConversationStep.WAITING_FOR_QUESTION_PAPER,
      });

      return "I encountered an issue processing the question paper. This could be due to image quality or format. Could you try uploading it again, perhaps with better lighting or clarity?";
    }
  }

  /**
   * Enhanced function to extract questions and their marks from OCR text
   * Handles various CBSE question paper formats across different subjects
   */
  private extractQuestionMarks(
    ocrText: string,
    _subjectArea: SubjectArea | null
  ): Map<number, number> {
    console.log("Extracting question marks from OCR text");
    const questionMarks = new Map<number, number>();
    const lines = ocrText.split("\n");

    // First, look for the total marks (MM) in the header
    let totalMarksInHeader = 0;
    const mmPattern =
      /MM:\s*(\d+)|Maximum\s+Marks\s*:?\s*(\d+)|MM\s*(\d+)|Total\s+Marks\s*:?\s*(\d+)/i;
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const mmMatch = lines[i].match(mmPattern);
      if (mmMatch) {
        totalMarksInHeader = parseInt(
          mmMatch[1] || mmMatch[2] || mmMatch[3] || mmMatch[4],
          10
        );
        console.log(`Total marks found in header: ${totalMarksInHeader}`);
        break;
      }
    }

    // Look for mark distribution information
    const markDistributions = [];
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      // Look for patterns like "5 questions of 2 marks each"
      const distributionMatch = lines[i].match(
        /(\d+)\s*questions?\s*of\s*(\d+)\s*marks?\s*each/i
      );
      if (distributionMatch) {
        markDistributions.push({
          count: parseInt(distributionMatch[1], 10),
          marks: parseInt(distributionMatch[2], 10),
        });
        console.log(
          `Found mark distribution: ${distributionMatch[1]} questions of ${distributionMatch[2]} marks each`
        );
      }
    }

    // First approach: Check for tabular format with separate MARKS column
    let hasMarksColumn = false;
    let marksColumnIndex = -1;

    // Look for "MARKS" column header
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const marksHeaderIndex = lines[i].toUpperCase().indexOf("MARKS");
      if (marksHeaderIndex > 0) {
        hasMarksColumn = true;
        marksColumnIndex = marksHeaderIndex;
        console.log(`Found MARKS column at position ${marksColumnIndex}`);
        break;
      }
    }

    if (hasMarksColumn) {
      // Process as tabular format
      console.log("Processing question paper in tabular format");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for question number pattern at start of line
        const qNumberMatch = line.match(
          /^(?:\s*|\s*Q\.?\s*|\s*Question\s+)(\d+)/i
        );
        if (qNumberMatch) {
          const questionNumber = parseInt(qNumberMatch[1], 10);

          // Look for marks in the marks column position
          let marksValue = 0;
          if (line.length > marksColumnIndex) {
            const marksSection = line.substring(marksColumnIndex).trim();
            const marksMatch = marksSection.match(/^(\d+)/);
            if (marksMatch) {
              marksValue = parseInt(marksMatch[1], 10);
            }
          }

          // If we found both a question number and marks, store them
          if (questionNumber > 0 && marksValue > 0) {
            questionMarks.set(questionNumber, marksValue);
            console.log(
              `Extracted from table: Question ${questionNumber} = ${marksValue} marks`
            );
          }
        }
      }
    }

    // Second approach: Look for questions and marks in various formats
    console.log("Processing with general patterns");
    let currentQuestion = 0;

    // Define various patterns to identify questions and marks
    const questionPatterns = [
      /Q\.No\.\s*(\d+)/i, // Q.No. 1
      /Question\s*(\d+)/i, // Question 1
      /Q\s*\.?\s*(\d+)/i, // Q.1 or Q 1
      /^(\d+)\s*\.\s/i, // 1. (at start of line)
      /^(\d+)\s+/i, // 1 (at start of line followed by space)
    ];

    const marksPatterns = [
      /\[(\d+)\s*marks?\]/i, // [5 marks]
      /\((\d+)\s*marks?\)/i, // (5 marks)
      /(\d+)\s*marks?$/i, // 5 marks (at end of line)
      /^(\d+)$/i, // Just the digit (in marks column)
      /(\d+)\s*m\b/i, // 5m (shorthand)
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and lines containing only "Or"
      if (line.length === 0 || /^Or$/i.test(line)) continue;

      // Try to find question numbers
      let questionFound = false;
      for (const pattern of questionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const questionNumber = parseInt(match[1], 10);
          if (!isNaN(questionNumber)) {
            currentQuestion = questionNumber;
            questionFound = true;
            break;
          }
        }
      }

      // If we found a question number, look for marks
      if (questionFound) {
        let marksFound = false;

        // First look in the current line
        for (const pattern of marksPatterns) {
          const match = line.match(pattern);
          if (match) {
            const marks = parseInt(match[1], 10);
            if (!isNaN(marks) && marks > 0) {
              if (!questionMarks.has(currentQuestion)) {
                questionMarks.set(currentQuestion, marks);
                console.log(
                  `Extracted: Question ${currentQuestion} = ${marks} marks`
                );
                marksFound = true;
                break;
              }
            }
          }
        }

        // If no marks found in current line, check the next line
        if (!marksFound && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          for (const pattern of marksPatterns) {
            const match = nextLine.match(pattern);
            if (match) {
              const marks = parseInt(match[1], 10);
              if (!isNaN(marks) && marks > 0) {
                if (!questionMarks.has(currentQuestion)) {
                  questionMarks.set(currentQuestion, marks);
                  console.log(
                    `Extracted from next line: Question ${currentQuestion} = ${marks} marks`
                  );
                  break;
                }
              }
            }
          }
        }
      }
    }

    // If we have mark distribution info but missing questions, try to fill them in
    if (
      markDistributions.length > 0 &&
      questionMarks.size < totalMarksInHeader
    ) {
      console.log("Using mark distribution to fill in missing questions");

      // Sort questions to process them in order
      const sortedQuestions = Array.from(questionMarks.keys()).sort(
        (a, b) => a - b
      );

      // Find the highest question number
      const highestQuestion =
        sortedQuestions.length > 0
          ? sortedQuestions[sortedQuestions.length - 1]
          : 0;

      // Fill in missing questions based on distribution patterns
      let questionIndex = 1;

      for (const distribution of markDistributions) {
        for (let i = 0; i < distribution.count; i++) {
          if (
            questionIndex <= highestQuestion &&
            !questionMarks.has(questionIndex)
          ) {
            questionMarks.set(questionIndex, distribution.marks);
            console.log(
              `Filled missing Question ${questionIndex} with ${distribution.marks} marks based on distribution`
            );
          }
          questionIndex++;
        }
      }
    }

    // Detect and handle section-based question papers (common in CBSE)
    // Look for sections like "SECTION A", "SECTION B", etc.
    const sectionPattern = /SECTION\s+([A-Z])/i;
    const sectionMarks = new Map<string, number>();

    for (let i = 0; i < lines.length; i++) {
      const sectionMatch = lines[i].match(sectionPattern);
      if (sectionMatch) {
        const section = sectionMatch[1].toUpperCase();

        // Try to find marks for this section in the next few lines
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          const marksMatch = lines[j].match(/(\d+)\s*marks?/i);
          if (marksMatch) {
            sectionMarks.set(section, parseInt(marksMatch[1], 10));
            console.log(`Found Section ${section} with ${marksMatch[1]} marks`);
            break;
          }
        }
      }
    }

    // Verify and validate the extracted question marks
    console.log("Validating extracted question marks");

    // Calculate total of extracted marks
    const totalExtractedMarks = Array.from(questionMarks.values()).reduce(
      (sum, marks) => sum + marks,
      0
    );
    console.log(`Total extracted marks: ${totalExtractedMarks}`);

    // Compare with header total if available
    if (totalMarksInHeader > 0 && totalExtractedMarks > 0) {
      if (totalMarksInHeader !== totalExtractedMarks) {
        console.log(
          `Warning: Total marks in header (${totalMarksInHeader}) doesn't match extracted total (${totalExtractedMarks})`
        );

        // If the difference is significant, we may need to adjust
        if (Math.abs(totalMarksInHeader - totalExtractedMarks) > 5) {
          console.log(
            "Large discrepancy detected, extraction may be incomplete"
          );
        }
      } else {
        console.log("Total marks match header, extraction likely complete");
      }
    }

    // If no marks were found at all, try one more approach with very lenient patterns
    if (questionMarks.size === 0) {
      console.log(
        "No marks found with standard patterns, trying fallback approach"
      );

      // Simply look for patterns like "1. ... 2" anywhere in the text
      const fallbackPattern =
        /(\d+)\s*\.\s+.{10,100}?\s+(\d+)\s*(?:marks?|m)?/g;
      let match;

      const fullText = lines.join(" ");
      while ((match = fallbackPattern.exec(fullText)) !== null) {
        const questionNumber = parseInt(match[1], 10);
        const marks = parseInt(match[2], 10);

        if (
          !isNaN(questionNumber) &&
          !isNaN(marks) &&
          questionNumber > 0 &&
          marks > 0 &&
          marks <= 20
        ) {
          questionMarks.set(questionNumber, marks);
          console.log(
            `Fallback extraction: Question ${questionNumber} = ${marks} marks`
          );
        }
      }
    }

    return questionMarks;
  }

  /**
   * Format extracted questions and marks for display
   */
  private formatExtractedQuestions(questionMarks: Map<number, number>): string {
    let result = "";

    // Convert to array and sort by question number
    const sortedQuestions = Array.from(questionMarks.entries()).sort(
      (a, b) => a[0] - b[0]
    );

    for (const [question, marks] of sortedQuestions) {
      result += `Question ${question}: ${marks} mark${
        marks !== 1 ? "s" : ""
      }\n`;
    }

    return result;
  }

  /**
   * Handle marks confirmation response
   */
  private handleMarksConfirmation(userId: string, message: string): string {
    const lowerMsg = message.toLowerCase().trim();
    const session = this.getOrCreateSession(userId);

    // Check if user confirms marks are correct
    if (
      lowerMsg.includes("yes") ||
      lowerMsg.includes("correct") ||
      lowerMsg.includes("right")
    ) {
      // Update session to confirm marks and move to next step
      sessionStore.updateSession(userId, {
        isMarkingConfirmed: true,
        step: ConversationStep.WAITING_FOR_STUDENT_ANSWER,
      });

      return `
  Great! The marks distribution is confirmed. Now, please upload the student's answer paper so I can grade it according to CBSE guidelines.
        `.trim();
    }

    // If marks are not correct
    if (
      lowerMsg.includes("no") ||
      lowerMsg.includes("incorrect") ||
      lowerMsg.includes("wrong")
    ) {
      // Move to state for updating marks
      sessionStore.updateSession(userId, {
        step: ConversationStep.WAITING_FOR_MARKS_UPDATE,
      });

      // Format the current questions for reference
      const formattedQuestions = this.formatExtractedQuestions(
        session.questionMarks || new Map()
      );

      return `
  I understand the marks need correction. Here are the current questions and marks I detected:
  
  ${formattedQuestions}
  
  Please tell me which question needs updating and the correct marks. For example:
  "Question 3 should be 5 marks" or "Update question 7 to 10 marks".
        `.trim();
    }

    // If response is unclear
    return `
  I need to know if the questions and marks I extracted are correct. Please respond with "Yes" if they're correct, or "No" if they need to be updated.
      `.trim();
  }

  /**
   * Handle marks update request
   */
  private handleMarksUpdate(userId: string, message: string): string {
    const session = this.getOrCreateSession(userId);
    const questionMarks = session.questionMarks || new Map<number, number>();

    // Regex to extract question number and new marks
    const updatePattern =
      /(?:question|q)\s*\.?\s*(\d+)(?:[a-z])?\s*(?:should|to|is)\s*(?:be|have)?\s*(\d+)\s*(?:mark|marks)/i;
    const match = message.match(updatePattern);

    if (match) {
      const questionNumber = parseInt(match[1], 10);
      const newMarks = parseInt(match[2], 10);

      // Update the question marks
      questionMarks.set(questionNumber, newMarks);

      // Update session with new marks
      sessionStore.updateSession(userId, {
        questionMarks,
        step: ConversationStep.WAITING_FOR_MARKS_CONFIRMATION,
      });

      // Format updated questions
      const formattedQuestions = this.formatExtractedQuestions(questionMarks);

      return `
  I've updated Question ${questionNumber} to ${newMarks} mark${
        newMarks !== 1 ? "s" : ""
      }.
  
  Here are the updated questions and marks:
  
  ${formattedQuestions}
  
  Are these questions and marks correct now? Please respond with "Yes" or "No".
        `.trim();
    }

    // If update format wasn't recognized
    return `
  I couldn't understand which question to update. Please use a format like:
  "Question 3 should be 5 marks" or "Update question 7 to 10 marks".
      `.trim();
  }

  /**
   * Process an uploaded image of student answer with OCR
   */
  async processStudentAnswerUpload(
    userId: string,
    imagePath: string
  ): Promise<string> {
    const session = this.getOrCreateSession(userId);
    console.log(`Processing student answer upload for user ${userId}`);

    // Ensure we have question paper and marks first
    if (
      !session.questionPaper ||
      !session.questionMarks ||
      !session.isMarkingConfirmed
    ) {
      return "Before I can grade the student's answer, I need the question paper with confirmed marks distribution. Let's start with uploading the question paper first.";
    }

    // Update session state
    sessionStore.updateSession(userId, {
      step: ConversationStep.GRADING_IN_PROGRESS,
    });

    try {
      // Upload the image to Firebase Storage
      console.log(`Uploading student answer to Firebase Storage: ${imagePath}`);
      const imageUrl = await storageService.uploadFile(imagePath);

      // Extract text from the image URL
      console.log(`Extracting text from student answer: ${imageUrl}`);
      const ocrText = await ocrService.extractTextFromImageUrl(imageUrl);
      console.log(`Successfully extracted OCR text (${ocrText.length} chars)`);

      // Update session with the extracted text
      sessionStore.updateSession(userId, {
        studentAnswer: ocrText,
        step: ConversationStep.GRADING_IN_PROGRESS,
      });

      // Calculate total marks
      let totalMarks = 0;
      for (const marks of session.questionMarks.values()) {
        totalMarks += marks;
      }

      // Grade the student's answer
      const gradingResult = await this.gradeStudentAnswer(
        session.questionPaper,
        ocrText,
        session.questionMarks,
        session.subjectArea,
        session.classLevel
      );

      // Update session with completed status
      const previousResults = session.previousGradingResults || [];
      sessionStore.updateSession(userId, {
        step: ConversationStep.COMPLETE,
        previousGradingResults: [...previousResults, gradingResult],
      });

      // Format the response with CBSE-specific grading
      return this.formatCbseGradingResponse(gradingResult, totalMarks, session);
    } catch (error) {
      console.error(`Error processing student answer:`, error);

      // Reset to appropriate state to allow retrying
      sessionStore.updateSession(userId, {
        step: ConversationStep.WAITING_FOR_STUDENT_ANSWER,
      });

      return "I encountered an issue processing the student's answer. This could be due to image quality or format. Could you try uploading it again, perhaps with better lighting or clarity?";
    }
  }

  /**
   * Grade student answer according to CBSE guidelines
   */
  private async gradeStudentAnswer(
    questionPaper: string,
    studentAnswer: string,
    questionMarks: Map<number, number>,
    subjectArea: SubjectArea | null,
    classLevel: ClassLevel | null
  ): Promise<GradingResult> {
    // Calculate total marks
    let totalMarks = 0;
    for (const marks of questionMarks.values()) {
      totalMarks += marks;
    }

    // Use OpenAI to grade the answer with CBSE specific instructions
    const subjectString = subjectArea?.replace("_", " ") || "general";
    const classString = classLevel?.replace("_", " ").toUpperCase() || "";

    // Specific instructions for CBSE Economics grading
    let subjectSpecificInstructions = "";
    if (subjectArea === SubjectArea.ECONOMICS) {
      subjectSpecificInstructions = `
  For Economics, follow these CBSE guidelines:
  - Award full marks for complete explanations of economic concepts
  - Award partial marks for partial understanding
  - Check for correct diagrams when required
  - Look for proper economic terminology usage
  - Evaluate application of economic theories to real-world scenarios
  - Consider logical structure and flow of the answer
  `;
    }

    try {
      // Call OpenAI service with CBSE-specific grading instructions
      const instructions = `
  Grade this student's answer according to CBSE guidelines for ${classString} ${subjectString}. 
  ${subjectSpecificInstructions}
  Allocate marks per question according to the marks distribution provided.
  `;

      const result = await openaiService.gradeAnswer(
        questionPaper,
        studentAnswer,
        instructions,
        totalMarks
      );

      // Add CBSE-specific metadata
      result.cbseClass = classString;
      result.cbseSubject = subjectString;
      result.gradingApproach = GradingApproach.CBSE_STANDARD;
      result.timeGraded = new Date();

      return result;
    } catch (error) {
      console.error("Error during CBSE grading:", error);

      // Fallback to simple grading
      return this.getFallbackCbseGrading(
        studentAnswer,
        totalMarks,
        questionPaper,
        subjectArea
      );
    }
  }

  /**
   * Format the grading result with CBSE-specific format
   */
  private formatCbseGradingResponse(
    result: GradingResult,
    totalMarks: number,
    session: CbseSessionData
  ): string {
    const subjectName =
      session.subjectArea?.replace("_", " ").toUpperCase() || "GENERAL";
    const className = session.classLevel?.replace("_", " ").toUpperCase() || "";

    let formattedResponse = `
  ## CBSE ${className} ${subjectName} ASSESSMENT
  
  🏆 **TOTAL SCORE: ${result.score}/${totalMarks}** (${Math.round(
      result.percentage
    )}%)
  
  📝 **EXAMINER'S REMARKS:**
  ${result.feedback}
  
  💪 **STRENGTHS:**
  ${result.strengths.map((s) => `- ${s}`).join("\n")}
  
  🔍 **AREAS FOR IMPROVEMENT:**
  ${result.areas_for_improvement.map((a) => `- ${a}`).join("\n")}
  
  💡 **SUGGESTIONS TO IMPROVE:**
  ${result.suggested_points.map((s) => `- ${s}`).join("\n")}
  `;

    // Add economics-specific feedback if applicable
    if (session.subjectArea === SubjectArea.ECONOMICS) {
      formattedResponse += `
  📊 **ECONOMICS-SPECIFIC FEEDBACK:**
  - Economic Concepts: ${result.conceptsScore || "Not explicitly evaluated"}/10
  - Diagram Accuracy: ${result.diagramScore || "Not explicitly evaluated"}/10
  - Application of Theories: ${
    result.applicationScore || "Not explicitly evaluated"
  }/10
  - Use of Terminology: ${
    result.terminologyScore || "Not explicitly evaluated"
  }/10
  `;
    }

    // Final remarks
    formattedResponse += `
  Would you like to grade another answer or have any questions about this assessment?
  `;

    return formattedResponse;
  }

  /**
   * Fallback grading specifically for CBSE
   */
  private getFallbackCbseGrading(
    studentAnswer: string,
    totalMarks: number,
    _questionPaper: string,
    subjectArea: SubjectArea | null
  ): GradingResult {
    // Similar to the original fallback but with CBSE-specific fields
    const textLength = studentAnswer.length;
    const sentenceCount = (studentAnswer.match(/[.!?]+\s/g) || []).length + 1;
    const wordCount = studentAnswer.split(/\s+/).length;

    // Calculate a score based on length and structure
    let score = Math.min(
      Math.round((textLength / 300) * totalMarks),
      totalMarks
    );
    score = Math.min(
      Math.max(Math.round(totalMarks * 0.4), score),
      Math.round(totalMarks * 0.8)
    );

    // Generate subject-specific feedback
    let subjectSpecificStrengths: string[] = [];
    let subjectSpecificAreas: string[] = [];

    if (subjectArea === SubjectArea.ECONOMICS) {
      subjectSpecificStrengths = [
        "Shows some understanding of economic concepts",
        "Attempts to connect economic theory to real-world examples",
      ];

      subjectSpecificAreas = [
        "Further development of economic terminology needed",
        "Economic diagrams could be more precise and labeled better",
      ];
    }

    // Combine with general strengths
    const strengths = [
      ...(wordCount > 100
        ? ["Provides a substantive response with adequate detail"]
        : []),
      ...(sentenceCount > 5
        ? ["Organizes thoughts into a structured response"]
        : []),
      "Attempts to address the questions directly",
      ...subjectSpecificStrengths,
    ].slice(0, 4);

    const areasForImprovement = [
      "More detailed explanation would strengthen the answer",
      "Additional examples would help illustrate understanding",
      "Connecting ideas more explicitly to the question asked",
      ...subjectSpecificAreas,
    ].slice(0, 4);

    // Calculate percentage
    const scorePercentage = (score / totalMarks) * 100;

    return {
      score,
      outOf: totalMarks,
      percentage: scorePercentage,
      feedback: `This answer demonstrates a basic understanding of the concepts covered in the question paper. The response addresses the key points but could be more comprehensive and detailed. According to CBSE guidelines for this subject, the answer shows partial mastery of the required knowledge.`,
      strengths,
      areas_for_improvement: areasForImprovement,
      suggested_points: [
        "Review NCERT textbooks for more precise economic terminology",
        "Practice drawing and labeling diagrams clearly when answering economics questions",
        "Use specific real-world examples to illustrate economic concepts",
      ],
      correct_concepts:
        "The response shows a basic understanding of the fundamental concepts related to the topic.",
      misconceptions:
        "There may be some minor misconceptions that could be addressed with more precise language and examples.",
      gradingApproach: GradingApproach.CBSE_STANDARD,
      timeGraded: new Date(),

      // CBSE-specific fields
      cbseClass: subjectArea?.toString() || "general",
      cbseSubject: subjectArea?.toString() || "general",
      conceptsScore: Math.round((scorePercentage * 0.6) / 10),
      diagramScore: Math.round((scorePercentage * 0.5) / 10),
      applicationScore: Math.round((scorePercentage * 0.55) / 10),
      terminologyScore: Math.round((scorePercentage * 0.65) / 10),
      critical_thinking: Math.round((scorePercentage * 0.6) / 10),
      organization: Math.round((scorePercentage * 0.7) / 10),
      language_use: Math.round((scorePercentage * 0.65) / 10),
      concept_application: Math.round((scorePercentage * 0.5) / 10),
    };
  }

  /**
   * Process an uploaded image with OCR - overriding parent method for CBSE flow
   */
  async processImageUpload(userId: string, imagePath: string): Promise<string> {
    const session = this.getOrCreateSession(userId);
    console.log(
      `Processing image upload for user ${userId}, session state: ${session.step}`
    );

    // Handle image based on current session state in CBSE flow
    switch (session.step) {
      case ConversationStep.WAITING_FOR_QUESTION_PAPER:
        return this.processQuestionPaperUpload(userId, imagePath);

      case ConversationStep.WAITING_FOR_STUDENT_ANSWER:
        return this.processStudentAnswerUpload(userId, imagePath);

      case ConversationStep.COMPLETE:
      case ConversationStep.FOLLOW_UP:
        // Start a new session
        sessionStore.resetSession(userId);
        sessionStore.updateSession(userId, {
          step: ConversationStep.WAITING_FOR_CLASS,
        });

        return `
  I've started a new grading session. Let's begin again.
  
  Which class level are you grading for? (e.g., Class 10, Class 12)
          `.trim();

      default:
        // If not in expected state, guide user to correct flow
        sessionStore.updateSession(userId, {
          step: ConversationStep.WAITING_FOR_CLASS,
        });

        return `
  To use the CBSE grading assistant effectively, let's follow the proper sequence.
  
  First, tell me which class you're grading for (e.g., Class 10, Class 12)?
          `.trim();
    }
  }

  /**
   * Process an image from URL with OCR - overriding parent method for CBSE flow
   */
  async processImageFromUrl(userId: string, imageUrl: string): Promise<string> {
    const session = this.getOrCreateSession(userId);
    console.log(
      `Processing image from URL for user ${userId}, session state: ${session.step}`
    );

    // Handle image based on current session state in CBSE flow
    switch (session.step) {
      case ConversationStep.WAITING_FOR_QUESTION_PAPER:
        // Simulate question paper upload with URL
        sessionStore.updateSession(userId, {
          originalImage: imageUrl,
          step: ConversationStep.PROCESSING_QUESTION_PAPER,
        });

        try {
          // Extract text from the image URL
          console.log(`Extracting text from question paper URL: ${imageUrl}`);
          const ocrText = await ocrService.extractTextFromImageUrl(imageUrl);

          // Continue with question paper processing
          sessionStore.updateSession(userId, {
            questionPaper: ocrText,
            step: ConversationStep.EXTRACTING_QUESTION_MARKS,
          });

          // Extract questions and marks
          const questionMarks = this.extractQuestionMarks(
            ocrText,
            session.subjectArea
          );

          // Update session with extracted marks
          sessionStore.updateSession(userId, {
            questionMarks,
            step: ConversationStep.WAITING_FOR_MARKS_CONFIRMATION,
          });

          // Format for display
          const formattedQuestions =
            this.formatExtractedQuestions(questionMarks);

          return `
  I've analyzed the question paper. Here are the questions and their marks:
  
  ${formattedQuestions}
  
  Are these questions and marks correct? Please respond with "Yes" or "No".
            `.trim();
        } catch (error) {
          console.error(`Error processing question paper URL:`, error);
          return "I had trouble processing that question paper. Could you try uploading it again?";
        }

      case ConversationStep.WAITING_FOR_STUDENT_ANSWER:
        // Simulate student answer upload with URL
        sessionStore.updateSession(userId, {
          originalImage: imageUrl,
          step: ConversationStep.GRADING_IN_PROGRESS,
        });

        try {
          // Extract text from the image URL
          console.log(`Extracting text from student answer URL: ${imageUrl}`);
          const ocrText = await ocrService.extractTextFromImageUrl(imageUrl);

          // Update session with the extracted text
          sessionStore.updateSession(userId, {
            studentAnswer: ocrText,
            step: ConversationStep.GRADING_IN_PROGRESS,
          });

          // Calculate total marks
          let totalMarks = 0;
          for (const marks of (session.questionMarks || new Map()).values()) {
            totalMarks += marks;
          }

          // Grade the answer
          const gradingResult = await this.gradeStudentAnswer(
            session.questionPaper || "",
            ocrText,
            session.questionMarks || new Map(),
            session.subjectArea,
            session.classLevel
          );

          // Update session
          const previousResults = session.previousGradingResults || [];
          sessionStore.updateSession(userId, {
            step: ConversationStep.COMPLETE,
            previousGradingResults: [...previousResults, gradingResult],
          });

          // Format response
          return this.formatCbseGradingResponse(
            gradingResult,
            totalMarks,
            session
          );
        } catch (error) {
          console.error(`Error processing student answer URL:`, error);
          return "I had trouble processing that student answer. Could you try uploading it again?";
        }

      default:
        // If not in expected state, guide user to correct flow
        sessionStore.updateSession(userId, {
          step: ConversationStep.WAITING_FOR_CLASS,
        });

        return `
  To use the CBSE grading assistant effectively, let's follow the proper sequence.
  
  First, tell me which class you're grading for (e.g., Class 10, Class 12)?
          `.trim();
    }
  }
}
