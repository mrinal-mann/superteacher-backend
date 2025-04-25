// src/server.ts - Custom implementation for CBSE Grading Assistant
import app from './app';
import dotenv from 'dotenv';
import { CbseChatService } from './services/cbseChatService';

// Load environment variables
dotenv.config();

// Set port
const PORT = process.env.PORT || 3000;

// Register the CBSE chat service
console.log('Initializing CBSE Grading Assistant...');

// Create an instance of the CBSE chat service
const cbseChatService = new CbseChatService();

// Register the service globally
(global as any).chatService = cbseChatService;
console.log('CBSE Grading Assistant initialized successfully');

// Start the server
app.listen(PORT, () => {
  console.log(`CBSE Grading Assistant server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`CBSE Grading API: http://localhost:${PORT}/api/chat`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Add graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing server');
  process.exit(0);
});