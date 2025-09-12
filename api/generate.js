// File: /api/generate.js
// Updated to remove all reCAPTCHA and Turnstile verification.

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ status: "ok", message: "API endpoint is working correctly." });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // UPDATED: Removed 'recaptchaToken' from the request body.
        const { prompt, imageData, aspectRatio } = req.body;
        
        const apiKey = process.env.GOOGLE_API_KEY;

        // REMOVED: The entire reCAPTCHA verification block is gone.
        // The function now proceeds directly to image generation.

        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        let apiUrl, payload;

        if (imageData) {
            // Image-to-image model (Gemini Flash)
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;
            payload = {
                "contents": [{ "parts": [{ "text": prompt }, { "inlineData": { "mimeType": imageData.mimeType, "data": imageData.data } }] }],
                "generationConfig": { "responseModalities": ["IMAGE", "TEXT"] }
            };
        } else {
            // Text-to-image model (Imagen 3)
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            
            const parameters = {
                "sampleCount": 1,
                "aspectRatio": aspectRatio || "1:1"
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
