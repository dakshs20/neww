// Use require for Node.js server environments (like Vercel)
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// --- IMPORTANT ---
// This is your service account JSON.
// You MUST set this as a `FIREBASE_SERVICE_ACCOUNT` environment variable
// on your hosting platform (e.g., Vercel, Netlify).
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
    console.error('Firebase service account setup error: Make sure the FIREBASE_SERVICE_ACCOUNT environment variable is set correctly.', e);
}

// Initialize Firebase Admin SDK, but only if it hasn't been already.
// This prevents re-initialization on hot reloads in a serverless environment.
if (!getApps().length) {
    try {
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (e) {
        console.error('Firebase Admin SDK initialization error.', e);
    }
}

const db = getFirestore();

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, aspectRatio, userId } = req.body;
        const apiKey = process.env.GOOGLE_API_KEY;

        // 1. Validate all incoming data from the client
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required. User ID is missing.' });
        }
        if (!prompt) {
            return res.status(400).json({ error: 'A prompt is required.' });
        }
        if (!apiKey) {
            console.error("Server config error: GOOGLE_API_KEY not found.");
            return res.status(500).json({ error: "Server configuration error." });
        }
        if (!db || !getApps().length) {
             console.error("Firestore database not initialized. Check service account.");
             return res.status(500).json({ error: "Database connection error." });
        }

        // 2. Securely check user credits on the server
        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User account not found in database.' });
        }

        const userData = userDoc.data();
        if (userData.credits <= 0) {
            return res.status(402).json({ error: "You don't have enough credits.", code: 'NO_CREDITS' });
        }

        // 3. Call the Google AI Image Generation API
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
        const payload = {
            instances: [{ prompt }],
            parameters: { "sampleCount": 1, "aspectRatio": aspectRatio || "1:1" }
        };
        
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Google API Error:", errorText);
            return res.status(apiResponse.status).json({ error: `Image generation failed due to an API error.` });
        }

        const result = await apiResponse.json();
        
        // 4. On successful image generation, deduct one credit from the user's account
        await userDocRef.update({
            credits: FieldValue.increment(-1)
        });
        
        // 5. Send the successful response back to the client
        return res.status(200).json(result);

    } catch (error) {
        console.error("API function /api/generate crashed:", error);
        return res.status(500).json({ error: 'An internal server error occurred. Please try again later.' });
    }
}

