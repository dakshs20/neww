// File: /api/generate.js
// Final working version with CAPTCHA verification.

export default async function handler(req, res) {
    // This is a test to see if the file is reachable.
    if (req.method === 'GET') {
        return res.status(200).json({ status: "ok", message: "API endpoint is working correctly." });
    }

    // Only allow POST requests for the actual image generation.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Destructure all expected parts from the request body
        const { prompt, imageData, recaptchaToken } = req.body;
        
        // Get API keys from environment variables
        const googleApiKey = process.env.GOOGLE_API_KEY;
        // IMPORTANT: You must set this in your Vercel project settings
        const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;

        // --- Start CAPTCHA VERIFICATION ---
        if (!recaptchaToken) {
            return res.status(400).json({ error: "CAPTCHA token is missing. Please complete the check." });
        }
        if (!recaptchaSecretKey) {
            return res.status(500).json({ error: "Server configuration error: reCAPTCHA secret key not found." });
        }

        // Construct the verification URL to send to Google's API
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaToken}`;
        
        // Send the verification request
        const verificationResponse = await fetch(verificationUrl, { method: 'POST' });
        const verificationData = await verificationResponse.json();

        // Check if the verification was successful
        if (!verificationData.success) {
            // If verification fails, log the error codes and return an error response
            console.error('CAPTCHA verification failed:', verificationData['error-codes']);
            return res.status(403).json({ error: "Failed CAPTCHA verification. Please try again." });
        }
        // --- End CAPTCHA VERIFICATION ---

        if (!googleApiKey) {
            return res.status(500).json({ error: "Server configuration error: Google API key not found." });
        }

        let apiUrl, payload;

        if (imageData) {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${googleApiKey}`;
            payload = {
                "contents": [{ "parts": [{ "text": prompt }, { "inlineData": { "mimeType": imageData.mimeType, "data": imageData.data } }] }],
                "generationConfig": { "responseModalities": ["IMAGE", "TEXT"] }
            };
        } else {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${googleApiKey}`;
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
        console.error('The API function crashed:', error);
        res.status(500).json({ error: 'An unexpected error occurred on the server.', details: error.message });
    }
}
