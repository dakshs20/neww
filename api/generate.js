// File: /api/generate.js
// Final working version with Aspect Ratio support.

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ status: "ok", message: "API endpoint is working correctly." });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Destructure the new aspectRatio property from the request body
        const { prompt, imageData, recaptchaToken, aspectRatio } = req.body;
        
        const apiKey = process.env.GOOGLE_API_KEY;
        const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

        // --- Step 1: Verify reCAPTCHA (No changes here) ---
        if (!recaptchaToken) {
            return res.status(400).json({ error: "reCAPTCHA token is missing." });
        }
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptchaToken}`;
        const recaptchaResponse = await fetch(verificationUrl, { method: 'POST' });
        const verificationData = await recaptchaResponse.json();
        if (!verificationData.success) {
            console.error("reCAPTCHA verification failed:", verificationData['error-codes']);
            return res.status(403).json({ error: "You are not human! reCAPTCHA verification failed." });
        }

        // --- Step 2: Proceed with image generation ---
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        let apiUrl, payload;

        if (imageData) {
            // Image-to-image model (Gemini Flash) does not support aspect ratio in the same way.
            // We will proceed without it for image uploads.
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;
            payload = {
                "contents": [{ "parts": [{ "text": prompt }, { "inlineData": { "mimeType": imageData.mimeType, "data": imageData.data } }] }],
                "generationConfig": { "responseModalities": ["IMAGE", "TEXT"] }
            };
        } else {
            // Text-to-image model (Imagen 3)
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            
            // Construct the parameters object, including the new aspectRatio
            const parameters = {
                "sampleCount": 1,
                "aspectRatio": aspectRatio || "1:1" // Default to 1:1 if not provided
            };

            payload = { 
                instances: [{ prompt }], 
                parameters: parameters 
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
        res.status(200).json(result);

    } catch (error) {
        console.error("API function crashed:", error);
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}
