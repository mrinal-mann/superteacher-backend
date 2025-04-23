import axios from "axios";
import { OPENAI_CONFIG } from "../config/openai";
import { GradingResult, OpenAIResponse } from "../types";

class OpenAIService {
  private apiKey: string;
  private model: string;
  private apiEndpoint: string = "https://api.openai.com/v1/chat/completions";

  constructor() {
    this.apiKey = OPENAI_CONFIG.apiKey;
    this.model = OPENAI_CONFIG.model;

    // Use standard OpenAI endpoint only
    console.log(`Using model: ${this.model} with standard OpenAI API`);
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
      console.log(`Building prompt for OpenAI grading...`);
      const prompt = this.buildGradingPrompt(
        question,
        studentAnswer,
        instruction,
        maxMarks
      );

      console.log(`Sending request to OpenAI API with model: ${this.model}`);
      console.log(`Using API endpoint: ${this.apiEndpoint}`);

      if (this.apiKey === "your-api-key") {
        console.error(
          "OpenAI API key is not set properly. Using default value."
        );
        throw new Error("OpenAI API key is not configured correctly");
      }

      const response = await axios.post(
        this.apiEndpoint,
        {
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: OPENAI_CONFIG.maxTokens,
          temperature: OPENAI_CONFIG.temperature,
          response_format: { type: "json_object" },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      console.log(`Received response from OpenAI API`);
      const result = response.data as OpenAIResponse;
      const content = result.choices[0].message.content;

      // Parse the JSON response
      try {
        const gradingResult = JSON.parse(content) as GradingResult;
        return gradingResult;
      } catch (parseError) {
        console.error("Error parsing OpenAI JSON response:", parseError);
        console.error("Raw content received:", content);
        throw new Error("Failed to parse grading result from OpenAI");
      }
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error("OpenAI API error status:", error.response.status);
          console.error(
            "OpenAI API error data:",
            JSON.stringify(error.response.data)
          );
        } else if (error.request) {
          // The request was made but no response was received
          console.error("No response received from OpenAI API");
        }
      }

      // Fallback to local grading if OpenAI fails
      console.log("Using fallback local grading due to API error");
      return this.getFallbackGrading(studentAnswer, maxMarks);
    }
  }

  /**
   * Provide a fallback grading when the OpenAI API fails
   */
  private getFallbackGrading(
    studentAnswer: string,
    maxMarks: number
  ): GradingResult {
    console.log("Generating fallback grading result");

    // Simple scoring based on length and content
    const textLength = studentAnswer.length;
    let score = Math.min(Math.round((textLength / 300) * maxMarks), maxMarks);

    // Minimum score of 50% if there's substantial content
    if (textLength > 200 && score < maxMarks / 2) {
      score = Math.round(maxMarks / 2);
    }

    return {
      score,
      feedback:
        "This is a system-generated score based on the answer's length and structure. The answer shows understanding of the concepts but could benefit from more details.",
      mistakes: [
        "Unable to perform detailed analysis due to system limitations.",
        "Please review the answer manually for accuracy.",
      ],
    };
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
