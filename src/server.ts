import app from './app';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set port
const PORT =3000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Chat API: http://localhost:${PORT}/api/chat`);
});