// Define the conversation steps with more detailed states
export enum ConversationStep {
  INITIAL = "initial",                      // Very first interaction
  WAITING_FOR_QUESTION = "waiting_for_question", // Waiting for question/topic to assess
  WAITING_FOR_ANSWER = "waiting_for_answer",    // Waiting for student's answer (image upload)
  WAITING_FOR_INSTRUCTION = "waiting_for_instruction", // Waiting for grading instructions
  GRADING_IN_PROGRESS = "grading_in_progress",   // Processing the grading request
  COMPLETE = "complete",                    // Grading is complete
  FOLLOW_UP = "follow_up"                   // Handling follow-up questions about the grading
}

// Enhanced session data with more contextual information
export interface SessionData {
  userId: string;                         // Unique identifier for the user
  question: string | null;                // The question/topic being assessed
  studentAnswer: string | null;           // The extracted text from the student's answer
  originalImage: string | null;           // Path or reference to the uploaded image
  subjectArea: string | null;             // Detected subject (math, science, english, etc.)
  contextualNotes: string | null;         // Additional context provided by the teacher
  marks: number | null;                   // Maximum marks for this assessment
  step: ConversationStep;                 // Current state in the conversation
  gradingApproach: string | null;         // Detected approach (strict, lenient, etc.)
  lastInteraction: Date | null;           // Timestamp of last interaction
  previousGradingResults: GradingResult[] | null; // History of previous gradings
}

// Enhanced chat request with more metadata
export interface ChatRequest {
  message: string;                        // The user's message
  userId: string;                         // User identifier
  timestamp: Date;                        // When the request was made
  imageAttached: boolean;                 // Whether an image is attached
  intentDetected?: string;                // Optional detected intent of message
}

// Enhanced grading result with detailed feedback categories
export interface GradingResult {
  score: number;                          // Numerical score
  outOf: number;                          // Maximum possible score
  percentage: number;                     // Score as percentage
  letterGrade?: string;                   // Optional letter grade (A, B, C, etc.)
  
  // Overall assessment
  feedback: string;                       // Main feedback summary
  
  // Specific areas of assessment
  strengths: string[];                    // What the student did well
  areas_for_improvement: string[];        // What needs improvement
  suggested_points: string[];             // Specific improvement suggestions
  correct_concepts: string;               // Concepts correctly understood
  misconceptions: string;                 // Evident misconceptions
  
  // Additional assessment components
  critical_thinking: number | null;       // Score for critical thinking (optional)
  organization: number | null;            // Score for organization (optional)
  language_use: number | null;            // Score for language/communication (optional)
  concept_application: number | null;     // Score for applying concepts (optional)
  
  // Legacy support
  mistakes?: string[];                    // Kept for backward compatibility
  
  // Metadata
  gradingApproach: string;                // How the grading was approached
  subjectSpecificNotes?: string;          // Notes specific to the subject area
  timeGraded: Date;                       // When the grading was completed
}

// Enhanced OpenAI/LLM response structure
export interface LLMResponse {
  choices: {
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

// User intent classification
export enum UserIntent {
  GREETING = "greeting",                  // General hello/hi
  HELP_REQUEST = "help_request",          // Asking for help/guidance
  PROVIDE_QUESTION = "provide_question",  // Providing a question to assess
  UPLOAD_ANSWER = "upload_answer",        // Uploading student's answer
  GRADING_INSTRUCTION = "grading_instruction", // Giving grading instructions
  CLARIFICATION_REQUEST = "clarification_request", // Asking for clarification
  FEEDBACK_ON_FEEDBACK = "feedback_on_feedback", // Commenting on the grading
  NEW_SESSION = "new_session",            // Starting a new session
  FOLLOW_UP_QUESTION = "follow_up_question", // Follow-up about the grading
  UNKNOWN = "unknown"                     // Cannot determine intent
}

// Subject area detection
export enum SubjectArea {
  MATH = "mathematics",
  SCIENCE = "science",
  ENGLISH = "english_language_arts",
  HISTORY = "history",
  SOCIAL_STUDIES = "social_studies",
  FOREIGN_LANGUAGE = "foreign_language",
  COMPUTER_SCIENCE = "computer_science",
  ARTS = "arts",
  PHYSICAL_EDUCATION = "physical_education",
  GENERAL = "general"
}

// Grading approach detection
export enum GradingApproach {
  STRICT = "strict",                     // Emphasis on accuracy/correctness
  BALANCED = "balanced",                 // Balance between correctness and effort
  LENIENT = "lenient",                   // Emphasis on effort/improvement
  DETAILED = "detailed",                 // Highly detailed assessment
  QUICK = "quick",                       // Brief assessment
  CONCEPTUAL = "conceptual",             // Focus on conceptual understanding
  TECHNICAL = "technical",               // Focus on technical accuracy
  RUBRIC_BASED = "rubric_based"          // Based on a specific rubric
}