// src/config/firebase.ts
import admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";
import path from "path";

// Path to your service account file
const serviceAccountPath = path.join(__dirname, "../../firebase-service-account.json");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // Use the service account file directly
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath)),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

// Export the storage service
export const storage = getStorage().bucket();
export default admin;