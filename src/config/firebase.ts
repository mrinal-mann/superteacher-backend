import admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

// Check if we should use mock storage
const useMockStorage = process.env.USE_MOCK_STORAGE === "true";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // For development/testing when Firebase credentials aren't available or mock is enabled,
    // use a mock implementation to avoid breaking the app
    if (useMockStorage || !process.env.FIREBASE_PROJECT_ID) {
      console.log("Using mock Firebase implementation");
      admin.initializeApp({
        // Use an empty configuration for local development
        projectId: "mock-project",
      });
    } else {
      // Production configuration with Firebase
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    }

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

// Export a mock storage service for local development
class MockStorage {
  async upload(filePath: string, options: any): Promise<any> {
    console.log(`MOCK: Would upload ${filePath} with options:`, options);
    return [{ name: path.basename(filePath) }];
  }

  file(name: string) {
    return {
      getSignedUrl: async (options: any) => {
        // Return a fake local URL for testing
        const mockUrl = `http://localhost:3001/mock-storage/${name}`;
        console.log(
          `MOCK: Generated signed URL ${mockUrl} with options:`,
          options
        );
        return [mockUrl];
      },
    };
  }
}

// Use the appropriate storage service
let storageService: any;
if (useMockStorage || !process.env.FIREBASE_PROJECT_ID) {
  console.log("Using mock storage service");
  storageService = new MockStorage();
} else {
  try {
    storageService = getStorage().bucket();
  } catch (error) {
    console.error("Failed to initialize Firebase Storage, using mock:", error);
    storageService = new MockStorage();
  }
}

export const storage = storageService;
export default admin;
