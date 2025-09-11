// /api/generate.js
// --- UPDATED ---
// This function now requires authentication, checks for user credits,
// and deducts one credit before generating an image.

import admin from './firebase-admin-config.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, imageData, aspectRatio, idToken } = req.body;

        if (!idToken) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        // 1. Verify user's authentication token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid } = decodedToken;

        const db = admin.firestore();
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();

        // 2. Check for sufficient credits
        if (userData.credits <= 0) {
            return res.status(402).json({ error: 'Insufficient credits. Please purchase a plan.' });
        }

        // 3. Deduct one credit
        await userRef.update({
            credits: admin.firestore.FieldValue.increment(-1)
        });

        // 4. Proceed with image generation
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        let apiUrl, payload;
        if (imageData) {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;
            payload = {
                "contents": [{ "parts": [{ "text": prompt }, { "inlineData": { "mimeType": imageData.mimeType, "data": imageData.data } }] }],
                "generationConfig": { "responseModalities": ["IMAGE", "TEXT"] }
            };
        } else {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            payload = {
                instances: [{ prompt }],
                parameters: { "sampleCount": 1, "aspectRatio": aspectRatio || "1:1" }
            };
        }

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            // IMPORTANT: If API fails, refund the credit.
            await userRef.update({
                credits: admin.firestore.FieldValue.increment(1)
            });
            const errorText = await apiResponse.text();
            console.error("Google API Error:", errorText);
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        res.status(200).json(result);

    } catch (error) {
        console.error("API function crashed:", error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Authentication token expired. Please sign in again.' });
        }
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}
