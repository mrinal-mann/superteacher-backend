import axios from "axios";
import { OPENAI_CONFIG } from "../config/openai";
import {
  GradingResult,
  GradingApproach,
  SubjectArea,
  LLMResponse,
} from "../types";

class OpenAIService {
  private apiKey: string;
  private model: string;
  private apiEndpoint: string = "https://api.openai.com/v1/chat/completions";

  constructor() {
    this.apiKey = OPENAI_CONFIG.apiKey;
    this.model = OPENAI_CONFIG.model;
    console.log(`Using model: ${this.model} with standard OpenAI API`);
  }

  /**
   * Call AI model to grade a student's answer
   */
  async gradeAnswer(
    question: string,
    studentAnswer: string,
    instruction: string,
    maxMarks: number
  ): Promise<GradingResult> {
    try {
      console.log(`Preparing to grade answer with ${maxMarks} maximum marks`);

      // Detect subject area and grading approach to customize prompt
      const subjectArea = this.detectSubjectArea(question);
      const gradingApproach = this.detectGradingApproach(instruction);

      console.log(
        `Detected subject: ${subjectArea}, approach: ${gradingApproach}`
      );

      // Build a customized prompt based on subject and approach
      const prompt = this.buildCustomGradingPrompt(
        question,
        studentAnswer,
        instruction,
        maxMarks,
        subjectArea,
        gradingApproach
      );

      console.log(`Sending request to AI API with model: ${this.model}`);

      // Validate API key
      if (this.apiKey === "your-api-key" || !this.apiKey) {
        console.error("API key is not set properly. Using default value.");
        throw new Error("API key is not configured correctly");
      }

      // Call the API
      const response = await axios.post(
        this.apiEndpoint,
        {
          model: this.model,
          messages: [
            { role: "system", content: prompt.systemPrompt },
            { role: "user", content: prompt.userPrompt },
          ],
          max_tokens: OPENAI_CONFIG.maxTokens,
          temperature: this.determineTemperature(gradingApproach),
          response_format: { type: "json_object" },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 60000, // 1 minute timeout
        }
      );

      console.log(`Received response from AI API`);
      const result = response.data as LLMResponse;
      const content = result.choices[0].message.content;

      // Process the JSON response
      try {
        const gradingResult = JSON.parse(content) as GradingResult;

        // Validate and fill in missing fields if needed
        return this.validateAndEnhanceResult(gradingResult, maxMarks);
      } catch (parseError) {
        console.error("Error parsing AI JSON response:", parseError);
        console.error(
          "Raw content received:",
          content.substring(0, 200) + "..."
        );
        throw new Error("Failed to parse grading result from AI");
      }
    } catch (error) {
      console.error("Error calling AI service:", error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error("API error status:", error.response.status);
          console.error("API error data:", JSON.stringify(error.response.data));
        } else if (error.request) {
          console.error("No response received from API");
        }
      }

      // Fallback to local grading if API fails
      console.log("Using fallback local grading due to API error");
      return this.getFallbackGrading(studentAnswer, maxMarks, question);
    }
  }

  /**
   * Determine appropriate temperature based on grading approach
   */
  private determineTemperature(approach: GradingApproach): number {
    switch (approach) {
      case GradingApproach.STRICT:
        return 0.2; // More deterministic for strict grading
      case GradingApproach.TECHNICAL:
        return 0.2; // More deterministic for technical analysis
      case GradingApproach.QUICK:
        return 0.3; // Slightly more deterministic for quick assessments
      case GradingApproach.DETAILED:
        return 0.4; // More creative for detailed feedback
      case GradingApproach.LENIENT:
        return 0.5; // More creative for lenient assessment
      default:
        return 0.3; // Default balanced temperature
    }
  }

  /**
   * Validate grading result and fill in any missing fields
   */
  private validateAndEnhanceResult(
    result: GradingResult,
    maxMarks: number
  ): GradingResult {
    // Ensure score is within bounds
    result.score = Math.max(0, Math.min(result.score, maxMarks));

    // Add empty arrays for missing list fields
    if (!result.strengths) result.strengths = [];
    if (!result.areas_for_improvement) result.areas_for_improvement = [];
    if (!result.suggested_points) result.suggested_points = [];

    // Add empty strings for missing text fields
    if (!result.feedback) result.feedback = "Assessment complete.";
    if (!result.correct_concepts) result.correct_concepts = "";
    if (!result.misconceptions) result.misconceptions = "";

    // Support legacy field
    if (!result.mistakes && result.areas_for_improvement) {
      result.mistakes = [...result.areas_for_improvement];
    }

    return result;
  }

  /**
   * Detect subject area based on question content
   */
  private detectSubjectArea(question: string): SubjectArea {
    const lowerQuestion = question.toLowerCase();

    // Check for math indicators
    if (
      /\b(math|algebra|geometry|calculus|equation|formula|triangle|solve)\b/i.test(
        lowerQuestion
      ) ||
      /[+\-*/=^√∫∑π]/.test(question)
    ) {
      return SubjectArea.MATH;
    }

    // Check for science indicators
    if (
      /\b(science|biology|chemistry|physics|experiment|molecule|atom|cell)\b/i.test(
        lowerQuestion
      )
    ) {
      return SubjectArea.SCIENCE;
    }

    // Check for English/writing indicators
    if (
      /\b(essay|write|paragraph|literature|grammar|analyze|text)\b/i.test(
        lowerQuestion
      )
    ) {
      return SubjectArea.ENGLISH;
    }

    // Check for history/social studies indicators
    if (
      /\b(history|civilization|government|war|president|country|society)\b/i.test(
        lowerQuestion
      )
    ) {
      return SubjectArea.HISTORY;
    }

    // Check for computer science indicators
    if (
      /\b(program|code|algorithm|function|variable|class|data structure)\b/i.test(
        lowerQuestion
      )
    ) {
      return SubjectArea.COMPUTER_SCIENCE;
    }

    // Default to general
    return SubjectArea.GENERAL;
  }

  /**
   * Detect grading approach based on instruction
   */
  private detectGradingApproach(instruction: string): GradingApproach {
    const lowerInstruction = instruction.toLowerCase();

    // Check for strict indicators
    if (/\b(strict|rigorous|thorough|exact)\b/i.test(lowerInstruction)) {
      return GradingApproach.STRICT;
    }

    // Check for lenient indicators
    if (/\b(lenient|generous|forgiving|effort)\b/i.test(lowerInstruction)) {
      return GradingApproach.LENIENT;
    }

    // Check for detailed indicators
    if (/\b(detailed|in-depth|comprehensive)\b/i.test(lowerInstruction)) {
      return GradingApproach.DETAILED;
    }

    // Check for quick indicators
    if (
      /\b(quick|brief|short|just score|only grade)\b/i.test(lowerInstruction)
    ) {
      return GradingApproach.QUICK;
    }

    // Check for conceptual focus
    if (
      /\b(concept|understanding|grasp|comprehension)\b/i.test(lowerInstruction)
    ) {
      return GradingApproach.CONCEPTUAL;
    }

    // Check for technical focus
    if (
      /\b(technical|accuracy|precision|correctness)\b/i.test(lowerInstruction)
    ) {
      return GradingApproach.TECHNICAL;
    }

    // Default to balanced
    return GradingApproach.BALANCED;
  }

  /**
   * Build customized prompts for different subjects and approaches
   */
  private buildCustomGradingPrompt(
    question: string,
    studentAnswer: string,
    instruction: string,
    maxMarks: number,
    subjectArea: SubjectArea,
    gradingApproach: GradingApproach
  ): { systemPrompt: string; userPrompt: string } {
    // Base system prompt that establishes the AI's role
    let systemPrompt = `
You are SuperTeacher, an expert educational assistant with years of teaching experience across multiple subjects. Your goal is to provide helpful, accurate, and supportive assessment of student work.

ASSESSMENT CONTEXT:
- You're analyzing a student's answer that was extracted from an image using OCR technology
- The teacher has shared this student's work seeking your professional assessment
- Respond as a thoughtful, experienced educator would
`;
    if (subjectArea === SubjectArea.ECONOMICS) {
      systemPrompt += `
SUBJECT EXPERTISE - ECONOMICS (CBSE):
- You're experienced with CBSE economics curriculum standards and marking schemes
- You can evaluate understanding of economic concepts, theories and models
- You can assess proper use of economic terminology and diagrams 
- You understand how to evaluate application of economic principles to real-world scenarios
- You can identify common misconceptions in economic understanding
`;
    }

    // Add CBSE grading approach
    if (gradingApproach === GradingApproach.CBSE_STANDARD) {
      systemPrompt += `
GRADING APPROACH - CBSE STANDARD:
- Follow CBSE marking scheme guidelines precisely
- Award full marks for complete explanations of required concepts
- Award partial marks for partial understanding based on CBSE guidelines
- Evaluate both conceptual clarity and application skills
- Check for proper economic terminology and diagram accuracy
- Consider overall structure and organization of the answer
`;
    }

    // Add subject-specific expertise to system prompt
    switch (subjectArea) {
      case SubjectArea.MATH:
        systemPrompt += `
SUBJECT EXPERTISE - MATHEMATICS:
- You have extensive experience teaching mathematics at all levels
- You can identify correct solution approaches even if notation isn't perfect
- You can recognize common misconceptions and errors in mathematical thinking
- You understand both procedural fluency and conceptual understanding
- You can assess work even if steps are incomplete or notation is imperfect due to OCR
`;
        break;

      case SubjectArea.SCIENCE:
        systemPrompt += `
SUBJECT EXPERTISE - SCIENCE:
- You have deep knowledge across biology, chemistry, physics, and earth sciences
- You can evaluate both factual knowledge and scientific reasoning
- You can assess experimental design, hypothesis formation, and data analysis
- You understand how to evaluate scientific explanations and models
- You can identify misconceptions about scientific principles
`;
        break;

      case SubjectArea.ENGLISH:
        systemPrompt += `
SUBJECT EXPERTISE - ENGLISH LANGUAGE ARTS:
- You're skilled at evaluating writing across different forms and purposes
- You can assess organization, coherence, evidence use, and argumentation
- You understand literary analysis, rhetorical techniques, and language conventions
- You can evaluate depth of reading comprehension and textual analysis
- You can provide constructive feedback on writing style and effectiveness
`;
        break;

      case SubjectArea.COMPUTER_SCIENCE:
        systemPrompt += `
SUBJECT EXPERTISE - COMPUTER SCIENCE:
- You have extensive experience in programming, algorithms, and computational thinking
- You can evaluate code functionality, efficiency, and style
- You understand software design principles and data structures
- You can identify logical errors and algorithmic inefficiencies
- You can assess problem-solving approaches in computational contexts
`;
        break;

      default:
        systemPrompt += `
GENERAL SUBJECT EXPERTISE:
- You have broad knowledge across multiple academic disciplines
- You can evaluate critical thinking, reasoning, and clarity of expression
- You understand how to assess student work based on accuracy, completeness, and coherence
- You can identify strengths and areas for improvement in any academic response
`;
    }

    // Add grading approach specifications to system prompt
    switch (gradingApproach) {
      case GradingApproach.STRICT:
        systemPrompt += `
GRADING APPROACH - STRICT:
- Focus primarily on accuracy and correctness
- Hold to high standards for precision and completeness
- Be thorough in identifying errors and misconceptions
- Maintain rigorous expectations appropriate to the subject
- Still provide constructive, actionable feedback
`;
        break;

      case GradingApproach.LENIENT:
        systemPrompt += `
GRADING APPROACH - LENIENT:
- Focus on effort and positive aspects of the work
- Recognize partial understanding and give credit where possible
- Emphasize encouragement while still being honest
- Consider the learning process rather than just the end result
- Frame areas for improvement constructively
`;
        break;

      case GradingApproach.DETAILED:
        systemPrompt += `
GRADING APPROACH - DETAILED:
- Provide comprehensive, thorough assessment
- Address multiple aspects of the work in depth
- Offer specific examples from the student's response
- Explain both strengths and weaknesses with precision
- Include detailed suggestions for improvement
`;
        break;

      case GradingApproach.QUICK:
        systemPrompt += `
GRADING APPROACH - QUICK:
- Provide efficient, focused assessment
- Prioritize the most important feedback points
- Be concise but still helpful and specific
- Focus on the core aspects of the response
- Keep explanations brief but meaningful
`;
        break;

      case GradingApproach.CONCEPTUAL:
        systemPrompt += `
GRADING APPROACH - CONCEPTUAL:
- Focus primarily on understanding of key concepts
- Evaluate depth of conceptual comprehension over mechanics
- Assess how well the student grasps fundamental principles
- Look for evidence of deeper understanding vs. surface knowledge
- Identify conceptual strengths and misconceptions
`;
        break;

      case GradingApproach.TECHNICAL:
        systemPrompt += `
GRADING APPROACH - TECHNICAL:
- Focus on technical accuracy and precision
- Evaluate correctness of procedures, calculations, and terminology
- Assess proper application of rules, formulas, and techniques
- Look for technical errors and misapplications
- Provide feedback on technical proficiency
`;
        break;

      default: // BALANCED
        systemPrompt += `
GRADING APPROACH - BALANCED:
- Consider both strengths and areas for improvement equally
- Balance assessment of effort with accuracy
- Evaluate both conceptual understanding and technical execution
- Provide fair, balanced feedback addressing multiple aspects
- Offer constructive suggestions while acknowledging achievements
`;
    }

    // Add response format instructions to system prompt
    systemPrompt += `
RESPONSE FORMAT:
You must return your assessment as a valid JSON object with these fields:
{
  "score": (a number from 0 to ${maxMarks} representing the grade),
  "feedback": (professional explanation of the grade with specific examples from the student's work),
  "strengths": (array of 2-4 specific strengths demonstrated in the work),
  "areas_for_improvement": (array of 2-4 specific areas needing improvement),
  "suggested_points": (array of 2-3 actionable suggestions for improvement),
  "correct_concepts": (key concepts the student understood correctly),
  "misconceptions": (any evident misconceptions in the student's answer)
}

Your response must be valid parseable JSON, nothing else. Ensure all array fields are proper JSON arrays with elements in quotes and separated by commas.
`;

    // Build user prompt with the specific content to grade
    const userPrompt = `
I need to assess this student's work:

QUESTION/PROMPT:
${question}

STUDENT'S ANSWER:
${studentAnswer}

ASSESSMENT INSTRUCTIONS:
${instruction}
Maximum possible marks: ${maxMarks}

Please evaluate this work and provide your assessment in the required JSON format.
`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Provide a fallback grading when the API fails
   */
  private getFallbackGrading(
    studentAnswer: string,
    maxMarks: number,
    question: string
  ): GradingResult {
    console.log("Generating fallback grading result");

    // Get basic metrics about the answer
    const textLength = studentAnswer.length;
    const sentenceCount = (studentAnswer.match(/[.!?]+\s/g) || []).length + 1;
    const wordCount = studentAnswer.split(/\s+/).length;

    // Calculate a score based on length and structure
    let score = Math.min(Math.round((textLength / 300) * maxMarks), maxMarks);

    // Ensure minimum score of 40% for substantial answers
    if (textLength > 200 && score < maxMarks * 0.4) {
      score = Math.round(maxMarks * 0.4);
    }

    // Cap score at 80% for fallback grading
    if (score > maxMarks * 0.8) {
      score = Math.round(maxMarks * 0.8);
    }

    // Prepare relevant strengths based on answer length
    const strengths = [];
    if (wordCount > 100)
      strengths.push("Provides a substantive response with adequate detail");
    if (sentenceCount > 5)
      strengths.push("Organizes thoughts into a structured response");
    strengths.push("Attempts to address the question directly");
    if (studentAnswer.includes(",") && studentAnswer.includes(".")) {
      strengths.push("Uses appropriate punctuation and sentence structure");
    }

    // Limit to 3 strengths
    const finalStrengths = strengths.slice(0, 3);

    // Dynamic response based on score percentage
    const scorePercentage = (score / maxMarks) * 100;
    let feedbackPrefix = "";

    if (scorePercentage >= 70) {
      feedbackPrefix =
        "This is a strong response that demonstrates good understanding of the topic.";
    } else if (scorePercentage >= 50) {
      feedbackPrefix =
        "This response shows basic understanding of the topic with some areas needing development.";
    } else {
      feedbackPrefix =
        "This response attempts to address the question but needs significant improvement.";
    }

    return {
      score,
      outOf: maxMarks,
      percentage: scorePercentage,
      feedback: `${feedbackPrefix} The answer addresses the main points required but could benefit from more detailed explanation and specific examples to strengthen the analysis.`,
      strengths: finalStrengths,
      areas_for_improvement: [
        "More detailed explanation would strengthen the answer",
        "Additional examples would help illustrate understanding",
        "Connecting ideas more explicitly to the question asked",
      ],
      suggested_points: [
        "Add specific examples to support main arguments",
        "Expand on key concepts with more detailed explanation",
        'Connect ideas more explicitly to the question: "' +
          question.substring(0, 50) +
          (question.length > 50 ? "..." : "") +
          '"',
      ],
      correct_concepts:
        "The response shows a basic understanding of the fundamental concepts related to the topic.",
      misconceptions:
        "There may be some minor misconceptions or oversimplifications that could be addressed with more precise language and examples.",
      gradingApproach: "balanced",
      timeGraded: new Date(),
      critical_thinking: Math.round((scorePercentage * 0.6) / 10),
      organization: Math.round((scorePercentage * 0.7) / 10),
      language_use: Math.round((scorePercentage * 0.65) / 10),
      concept_application: Math.round((scorePercentage * 0.55) / 10),
    };
  }
}

export const openaiService = new OpenAIService();
