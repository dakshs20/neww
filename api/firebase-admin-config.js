// --- UPDATED & FINAL ---
// This file provides a robust way to initialize the Firebase Admin SDK.
// It prevents re-initialization errors and safely parses the service account key.

import admin from 'firebase-admin';

// Check if the service account key environment variable exists.
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('The FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
}

// Safely parse the stringified JSON from the environment variable.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// CORE FIX: Check if the Firebase app is already initialized.
// This prevents errors during hot-reloads in a development environment.
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin SDK initialized successfully.");
    } catch (error) {
        console.error("Firebase Admin SDK initialization error:", error);
        // Throw the error to prevent the application from running with a faulty config.
        throw error;
    }
}

// Export the initialized admin instance for use in other API routes.
export { admin };

