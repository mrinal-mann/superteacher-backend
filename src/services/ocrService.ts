import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

/**
 * Service to handle OCR operations
 * Connects to a remote OCR service running on Render
 */
class OcrService {
  private ocrEndpoint: string;

  constructor() {
    // Configure from environment variables - use the Render URL
    this.ocrEndpoint = process.env.OCR_ENDPOINT || 'https://grading-api.onrender.com/extract-text';
  }

  /**
   * Extract text from an image using the remote OCR service
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      // Create a form with the image file
      const form = new FormData();
      // Important: Use 'file' as the field name for FastAPI
      form.append('file', fs.createReadStream(imagePath));

      console.log(`Sending image to remote OCR service at ${this.ocrEndpoint}`);
      
      // Call the OCR service
      const response = await axios.post(this.ocrEndpoint, form, {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 60000, // 60 second timeout for OCR processing
      });

      // Log OCR results (for debugging)
      console.log('OCR Response:', {
        textLength: response.data.extracted_text?.length || 0,
      });

      // Extract and return the OCR text
      if (response.data && response.data.extracted_text) {
        return response.data.extracted_text;
      } else {
        throw new Error('OCR service did not return text');
      }
    } catch (error) {
      console.error('Error calling OCR service:', error);
      throw new Error('Failed to extract text from image');
    }
  }
}

export const ocrService = new OcrService();