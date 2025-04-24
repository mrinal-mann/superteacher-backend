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
      console.log("Content-Type:", contentType);

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
   * Handle the initial greeting with streaming support
   */
  handleGreeting(req: Request, res: Response): void {
    // Extract or generate user ID
    const userId = req.body.userId || uuidv4();

    // Reset the session for this user
    const { sessionStore } = require("../utils/sessionStore");
    sessionStore.resetSession(userId);

    console.log(`Session reset for user ${userId} during greeting`);

    // Check if streaming is requested
    const useStreaming = req.headers["accept"]?.includes("text/event-stream");

    if (useStreaming) {
      // Setup streaming response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send the user ID first
      res.write(`data: ${JSON.stringify({ userId })}\n\n`);

      // Stream the greeting message character by character
      const greeting =
        "Hi! I'm SuperTeacher 👩‍🏫 Please send me the question you'd like to grade.";
      streamResponse(res, greeting);
    } else {
      // Send regular JSON response
      res.json({
        userId,
        message:
          "Hi! I'm SuperTeacher 👩‍🏫 Please send me the question you'd like to grade.",
      });
    }
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

  // Check if client supports streaming
  const useStreaming = req.headers["accept"]?.includes("text/event-stream");

  // Special case for initial greeting
  if (message.toLowerCase() === "hello" || message.toLowerCase() === "hi") {
    chatController.handleGreeting(req, res);
    return;
  }

  // Process the message
  // const session = chatService.getSession(userId);

  if (useStreaming) {
    // Set up streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Send the user ID first
    res.write(`data: ${JSON.stringify({ userId })}\n\n`);

    try {
      const response = await chatService.processTextMessage(userId, message);

      // Stream the response
      streamResponse(res, response);
    } catch (error) {
      console.error("Error in streaming response:", error);
      res.write(`data: ${JSON.stringify({ error: "An error occurred" })}\n\n`);
      res.end();
    }
  } else {
    // Regular JSON response
    const response = await chatService.processTextMessage(userId, message);

    // Send response
    res.json({
      userId,
      message: response,
    });
  }
}

/**
 * Process a file upload request
 */
async function handleFileUpload(req: Request, res: Response): Promise<void> {
  console.log("Starting file upload process...");
  console.log("Upload directory:", uploadDir);

  // Create a temporary file upload handler
  const form = new IncomingForm({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
  });

  // Enhanced debugging
  form.on("fileBegin", (formName, file) => {
    console.log(`File upload starting: ${formName}`, file);
  });

  form.on("progress", (bytesReceived, bytesExpected) => {
    console.log(`Upload progress: ${bytesReceived}/${bytesExpected} bytes`);
  });

  // Process the form
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Error parsing form:", err);
      res.status(400).json({ error: "Failed to upload file" });
      return;
    }

    console.log("Form parsed successfully");
    console.log("Fields received:", JSON.stringify(fields));
    console.log("Files received:", Object.keys(files));
    console.log("Files details:", JSON.stringify(files, null, 2));

    // Extract user ID from form fields or generate one
    const userId =
      (fields.userId && Array.isArray(fields.userId)
        ? fields.userId[0]
        : fields.userId) || uuidv4();

    console.log("Using userId:", userId);

    // Check if any file was uploaded
    if (!files || Object.keys(files).length === 0) {
      console.error("No files were uploaded");
      res.status(400).json({ error: "No files were uploaded" });
      return;
    }

    // Try to get file with more flexibility
    let fileField = null;
    const fileKeys = Object.keys(files);

    // Log each file key
    for (const key of fileKeys) {
      console.log(`Found file with key: ${key}`);
      fileField = files[key];
      if (fileField && !Array.isArray(fileField)) {
        console.log(`Using file from key: ${key}`);
        break;
      }
    }

    // Specific check for 'image' and 'file' keys
    if (files.image) {
      console.log("'image' field found");
      fileField = Array.isArray(files.image) ? files.image[0] : files.image;
    } else if (files.file) {
      console.log("'file' field found");
      fileField = Array.isArray(files.file) ? files.file[0] : files.file;
    } else {
      console.log(
        "Neither 'image' nor 'file' field found in:",
        Object.keys(files)
      );
    }

    if (!fileField) {
      console.error("Missing or invalid image file");
      res.status(400).json({ error: "Missing or invalid image file" });
      return;
    }

    const imagePath = (fileField as { filepath: string }).filepath;
    console.log("Image path:", imagePath);

    try {
      console.log("Processing image...");

      // Make sure we have a question before processing the image
      const session = chatService.initializeSessionIfNeeded(userId);
      console.log("Session state:", session.step);

      // Check if client supports streaming
      const useStreaming = req.headers["accept"]?.includes("text/event-stream");

      if (useStreaming) {
        // Set up streaming response
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Send the user ID first
        res.write(`data: ${JSON.stringify({ userId })}\n\n`);

        // Process the image
        const response = await chatService.processImageUpload(
          userId,
          imagePath
        );

        // Stream the response
        streamResponse(res, response);

        // Clean up the temporary file AFTER processing is complete
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Cleaned up temporary file: ${imagePath}`);
          }
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      } else {
        // Process the image
        const response = await chatService.processImageUpload(
          userId,
          imagePath
        );
        console.log("Image processed successfully");

        // Send response
        res.json({
          userId,
          message: response,
        });

        // Clean up the temporary file AFTER processing is complete
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Cleaned up temporary file: ${imagePath}`);
          }
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }
    } catch (error) {
      console.error("Error processing image:", error);
      res.status(500).json({ error: "Failed to process image" });

      // Don't delete the file on error to allow debugging
    }
  });
}

/**
 * Stream a response text character by character with delays
 */
function streamResponse(res: Response, text: string): void {
  let index = 0;
  const interval = 15; // milliseconds between characters

  const streamInterval = setInterval(() => {
    if (index < text.length) {
      // Send the next character
      const char = text.charAt(index);
      res.write(`data: ${JSON.stringify({ char })}\n\n`);
      index++;
    } else {
      // End of text
      clearInterval(streamInterval);

      // Send end marker
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  }, interval);

  // Handle client disconnect
  res.on("close", () => {
    clearInterval(streamInterval);
    res.end();
  });
}
