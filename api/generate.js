// /api/generate.js
// This file now handles both image generation and saving to the gallery.

// IMPORTANT: You must install firebase-admin for this to work.
// In your terminal, run: npm install firebase-admin
import admin from 'firebase-admin';

// --- Firebase Admin Initialization ---
// This needs to be configured once. We check if the app is already initialized
// to prevent errors during development (hot-reloading).
if (!admin.apps.length) {
  try {
    // You MUST create a service account and store the JSON credentials 
    // in an environment variable named FIREBASE_SERVICE_ACCOUNT.
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // You also need your storage bucket URL in an environment variable.
      // e.g., 'genart-a693a.appspot.com'
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

// --- Main API Handler ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, imageData, aspectRatio, saveToGallery } = req.body;
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            console.error("Server config error: GOOGLE_API_KEY not found.");
            return res.status(500).json({ error: "Server configuration error." });
        }

        let apiUrl, payload;
        // Logic to call the appropriate Google AI model
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
            const errorText = await apiResponse.text();
            console.error("Google API Error:", errorText);
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();

        // Extract the base64 image data from the correct response structure
        let base64Data;
        if (imageData) {
            base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        } else {
            base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        }

        // --- NEW: Save to Gallery Logic (if requested) ---
        if (saveToGallery && base64Data) {
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `gallery/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`;
            const file = bucket.file(fileName);

            await file.save(buffer, {
                metadata: { contentType: 'image/png' },
                public: true // Make the file publicly readable
            });
            
            // The public URL can be constructed directly.
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

            // Save metadata to Firestore
            await db.collection('galleryImages').add({
                imageUrl: publicUrl,
                prompt: prompt,
                aspectRatio: aspectRatio || "1:1",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
             console.log("Image saved to gallery:", publicUrl);
        }
        
        // Return the original API response to the client
        res.status(200).json(result);

    } catch (error) {
        console.error("API function /api/generate crashed:", error.message, error.stack);
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}

