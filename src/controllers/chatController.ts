import { Request, Response } from "express";
import { IncomingForm } from "formidable";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { chatService } from "../services/chatService";

// Configure formidable options - use /tmp for Render compatibility
const uploadDir =
  process.env.NODE_ENV === "production"
    ? path.join("/tmp", "superteacher-uploads")
    : path.join(__dirname, "../../uploads");

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
  const { message, userId: rawUserId } = req.body;

  // Ensure valid userId format
  const userId =
    rawUserId && typeof rawUserId === "string" && rawUserId.trim().length > 0
      ? rawUserId.trim()
      : uuidv4();

  console.log(`Processing text message for user ${userId}: "${message}"`);

  // Check if client supports streaming
  const useStreaming = req.headers["accept"]?.includes("text/event-stream");

  // Special case for initial greeting
  if (
    message.toLowerCase() === "hello" ||
    message.toLowerCase() === "hi" ||
    message.toLowerCase().includes("hello") ||
    message.toLowerCase().includes("hi") ||
    message.toLowerCase().includes("hey") ||
    message.toLowerCase().includes("start")
  ) {
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

    // Extract user ID from form fields or generate one
    const rawUserId =
      fields.userId &&
      (Array.isArray(fields.userId) ? fields.userId[0] : fields.userId);

    // Make sure we have a valid userId format
    const userId =
      rawUserId && typeof rawUserId === "string" && rawUserId.trim().length > 0
        ? rawUserId.trim()
        : uuidv4();

    console.log(`Processing file upload for user ${userId}`);

    // Check if any file was uploaded
    if (!files || Object.keys(files).length === 0) {
      console.error("No files were uploaded");
      res.status(400).json({ error: "No files were uploaded" });
      return;
    }

    // Process the uploaded file
    let fileField = null;

    // Check for 'image' field first (our primary field name)
    if (files.image) {
      console.log("'image' field found");
      fileField = Array.isArray(files.image) ? files.image[0] : files.image;
    }
    // Then check for 'file' field
    else if (files.file) {
      console.log("'file' field found");
      fileField = Array.isArray(files.file) ? files.file[0] : files.file;
    }
    // If neither specific field is found, try to get the first available file
    else {
      const fileKeys = Object.keys(files);
      console.log(
        `Neither 'image' nor 'file' field found. Available keys: ${fileKeys.join(
          ", "
        )}`
      );

      for (const key of fileKeys) {
        fileField = files[key];
        // If it's an array, get the first element
        if (Array.isArray(fileField) && fileField.length > 0) {
          fileField = fileField[0];
        }

        if (fileField) {
          console.log(`Using file from key: ${key}`);
          break;
        }
      }
    }

    if (!fileField) {
      console.error("Missing or invalid image file");
      res.status(400).json({ error: "Missing or invalid image file" });
      return;
    }

    const imagePath = (fileField as { filepath: string }).filepath;
    console.log(`Image path: ${imagePath}`);

    if (!imagePath || !fs.existsSync(imagePath)) {
      console.error(`File doesn't exist at path: ${imagePath}`);
      res.status(400).json({ error: "File upload failed" });
      return;
    }

    try {
      console.log(`Processing image for user ${userId}...`);

      // Initialize session - always reset if starting a new conversation
      const { sessionStore } = require("../utils/sessionStore");
      const session = sessionStore.getSession(userId);

      console.log(`Current session state for user ${userId}: ${session.step}`);

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
