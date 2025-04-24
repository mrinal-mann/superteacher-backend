# SuperTeacher Backend

Intelligent chatbot-style grading system for educators to process and assess student work.

## Image Processing Workflow

The backend now supports two methods of processing images:

1. **Direct File Upload**: The client uploads a photo to the backend, which is then:

   - Uploaded to Firebase Storage to generate a URL
   - Sent to the OCR service with `image_url` parameter to extract text
   - Processed by the grading system

2. **Image URL Processing**: You can directly send an image URL to the backend, and it will:
   - Skip the upload step and use the provided URL
   - Send to the OCR service with `image_url` parameter
   - Process the extracted text as usual

## API Endpoints

### POST /api/chat

This endpoint handles both text messages and image processing:

#### Text Message:

```json
{
  "message": "Your text message",
  "userId": "optional-user-id"
}
```

#### Process Image URL:

```json
{
  "image_url": "https://example.com/image.jpg",
  "userId": "optional-user-id"
}
```

#### File Upload:

Use multipart/form-data with:

- `image`: The image file
- `userId`: (Optional) user identifier
- `message`: (Optional) accompanying text message

## Environment Configuration

Key environment variables:

```
# Server and API settings
NODE_ENV=development
OPENAI_API_KEY=your-openai-key

# OCR Configuration
OCR_ENDPOINT=https://grading-api.onrender.com/extract-text

# Firebase Storage configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Set to true to use mock storage without Firebase credentials
USE_MOCK_STORAGE=true
```

## Development

1. Install dependencies:

   ```
   npm install
   ```

2. Start the development server:

   ```
   npm run dev
   ```

3. For local testing without Firebase, set `USE_MOCK_STORAGE=true` in your `.env` file
