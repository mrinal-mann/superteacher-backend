import { Request, Response } from "express";
import { IncomingForm } from "formidable";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { chatService } from "../services/chatService";

// Configure formidable options
const uploadDir = path.join(__dirname, "../../uploads");
// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const chatController = {
  /**
   * Handle chat messages and file uploads
   */
  async handleChatRequest(req: Request, res: Response): Promise<void> {
    try {
      // Check if it's a multipart form (file upload) or regular JSON request
      const contentType = req.headers["content-type"] || "";

      if (contentType.includes("multipart/form-data")) {
        // Handle file upload
        await handleFileUpload(req, res);
      } else {
        // Handle text message
        await handleTextMessage(req, res);
      }
    } catch (error) {
      console.error("Error handling chat request:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  },

  /**
   * Handle the initial greeting
   */
  handleGreeting(req: Request, res: Response): void {
    // Extract or generate user ID
    const userId = req.body.userId || uuidv4();

    res.json({
      userId,
      message:
        "Hi! I'm SuperTeacher 👩‍🏫 Please send me the question you'd like to grade.",
    });
  },
};

/**
 * Process a text message request
 */
async function handleTextMessage(req: Request, res: Response): Promise<void> {
  // Validate request body
  if (!req.body || !req.body.message) {
    res.status(400).json({ error: "Missing required field: message" });
    return;
  }

  // Extract message and user ID
  const { message, userId = uuidv4() } = req.body;

  // Special case for initial greeting
  if (message.toLowerCase() === "hello") {
    chatController.handleGreeting(req, res);
    return;
  }

  // Process the message
  const response = await chatService.processTextMessage(userId, message);

  // Send response
  res.json({
    userId,
    message: response,
  });
}

/**
 * Process a file upload request
 */
async function handleFileUpload(req: Request, res: Response): Promise<void> {
  // Create a temporary file upload handler
  const form = new IncomingForm({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
  });

  // Process the form
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Error parsing form:", err);
      res.status(400).json({ error: "Failed to upload file" });
      return;
    }

    // Extract user ID from form fields or generate one
    const userId =
      (fields.userId && Array.isArray(fields.userId)
        ? fields.userId[0]
        : fields.userId) || uuidv4();

    // Get the uploaded file - accepting both 'image' and 'file' field names
    const fileField = files.image || files.file;
    if (!fileField || Array.isArray(fileField)) {
      res.status(400).json({ error: "Missing or invalid image file" });
      return;
    }

    const imagePath = (fileField as { filepath: string }).filepath;

    try {
      // Process the image
      const response = await chatService.processImageUpload(userId, imagePath);

      // Send response
      res.json({
        userId,
        message: response,
      });
    } catch (error) {
      console.error("Error processing image:", error);
      res.status(500).json({ error: "Failed to process image" });
    } finally {
      // Clean up the temporary file
      // This would be removed in production to keep the files for debugging
      // fs.unlinkSync(imagePath);
    }
  });
}