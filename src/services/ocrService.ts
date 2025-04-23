import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import path from "path";

/**
 * Service to handle OCR operations
 * Connects to a remote OCR service running on Render
 */
class OcrService {
  private ocrEndpoint: string;
  private demoMode: boolean;

  constructor() {
    // Configure from environment variables - use the Render URL
    this.ocrEndpoint =
      process.env.OCR_ENDPOINT ||
      "https://grading-api.onrender.com/extract-text";

    // Enable demo mode if environment variable is set
    this.demoMode = process.env.OCR_DEMO_MODE === "true";
  }

  /**
   * Extract text from an image using the remote OCR service
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.error(`Image file does not exist at path: ${imagePath}`);

        // Use demo mode if enabled or file doesn't exist
        if (this.demoMode) {
          console.log("Using demo mode for OCR since file doesn't exist");
          return this.getDemoText(path.basename(imagePath));
        }

        throw new Error("Image file does not exist");
      }

      // Try to access file stats to make sure it's readable
      try {
        const stats = fs.statSync(imagePath);
        console.log(`Image file size: ${stats.size} bytes`);

        if (stats.size === 0) {
          console.error("Image file is empty (0 bytes)");
          if (this.demoMode) {
            return this.getDemoText(path.basename(imagePath));
          }
          throw new Error("Image file is empty");
        }
      } catch (fsError) {
        console.error("Error accessing image file:", fsError);
        if (this.demoMode) {
          return this.getDemoText(path.basename(imagePath));
        }
        throw fsError;
      }

      // Create a form with the image file
      const form = new FormData();
      // Important: Use 'file' as the field name for FastAPI
      form.append("file", fs.createReadStream(imagePath));

      console.log(`Sending image to remote OCR service at ${this.ocrEndpoint}`);

      // Call the OCR service
      const response = await axios.post(this.ocrEndpoint, form, {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 60000, // 60 second timeout for OCR processing
      });

      // Log OCR results (for debugging)
      console.log("OCR Response status:", response.status);
      console.log("OCR Response data keys:", Object.keys(response.data));

      if (response.data) {
        console.log(
          "OCR Text length:",
          response.data.extracted_text?.length || 0
        );
      }

      // Extract and return the OCR text
      if (response.data && response.data.extracted_text) {
        return response.data.extracted_text;
      } else {
        console.error(
          "OCR response format error:",
          JSON.stringify(response.data)
        );

        if (this.demoMode) {
          return this.getDemoText(path.basename(imagePath));
        }

        throw new Error("OCR service did not return text");
      }
    } catch (error) {
      console.error("Error calling OCR service:", error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error("OCR service error status:", error.response.status);
          console.error(
            "OCR service error data:",
            JSON.stringify(error.response.data)
          );
        } else if (error.request) {
          console.error("No response received from OCR service");
        }
      }

      // If we're in demo mode, return demo text instead of failing
      if (this.demoMode) {
        console.log("Using demo mode for OCR due to service error");
        return this.getDemoText(path.basename(imagePath));
      }

      throw new Error("Failed to extract text from image");
    }
  }

  /**
   * Return demo text for testing when OCR service is unavailable
   */
  private getDemoText(filename: string): string {
    console.log(`Using demo text for file: ${filename}`);
    return `This is a sample student answer for testing.
    
The student has written about the water cycle, explaining that water evaporates from oceans and lakes due to heat from the sun. The water vapor rises and cools in the atmosphere, forming clouds through condensation. When the water droplets get heavy enough, they fall back to Earth as precipitation (rain, snow, etc.).

The student has also drawn a diagram showing the cycle with arrows connecting the different stages.`;
  }
}

export const ocrService = new OcrService();
