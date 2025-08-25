// File: /api/generate.js
// This is your backend server file. It now checks for reCAPTCHA.

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ status: "ok", message: "API endpoint is working correctly." });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, imageData, recaptchaToken } = req.body;
        const apiKey = process.env.GOOGLE_API_KEY;
        // Get the Secret Key from your Vercel Environment Variables
        const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

        // --- Step 1: Verify the reCAPTCHA token ---
        if (!recaptchaToken) {
            return res.status(400).json({ error: "reCAPTCHA token is missing." });
        }

        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${recaptchaToken}`;
        
        const recaptchaResponse = await fetch(verificationUrl, { method: 'POST' });
        const verificationData = await recaptchaResponse.json();

        // If 'success' is false, it's a bot or an error.
        if (!verificationData.success) {
            console.error("reCAPTCHA verification failed:", verificationData['error-codes']);
            return res.status(403).json({ error: "You are not human! reCAPTCHA verification failed." });
        }
        // --- End of reCAPTCHA verification ---


        // --- Step 2: Proceed with image generation if reCAPTCHA was successful ---
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
            payload = { instances: [{ prompt }], parameters: { "sampleCount": 1 } };
        }

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        res.status(200).json(result);

    } catch (error) {
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}
