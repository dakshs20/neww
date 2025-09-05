// /api/generate.js
import { db, auth } from './utils/firebase-admin.js';

// Simple in-memory rate limiter
const rateLimitStore = {};
const RATE_LIMIT_COUNT = 10; // 10 requests
const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. Authenticate User
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }
    const idToken = authHeader.split('Bearer ')[1];

    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }
    const { uid } = decodedToken;

    // 2. Basic Rate Limiting
    const now = Date.now();
    const userRequests = rateLimitStore[uid] || [];
    const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    if (recentRequests.length >= RATE_LIMIT_COUNT) {
        res.setHeader('Retry-After', 60);
        return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    }
    rateLimitStore[uid] = [...recentRequests, now];

    const { prompt, imageData, aspectRatio, idempotencyKey } = req.body;
    if (!prompt || !idempotencyKey) {
        return res.status(400).json({ error: 'Prompt and idempotencyKey are required.' });
    }

    const userRef = db.collection('users').doc(uid);
    const generationRef = db.collection('generations').doc(idempotencyKey);
    const ledgerRef = userRef.collection('creditLedger');

    try {
        let imageUrl, finalCreditBalance;

        await db.runTransaction(async (transaction) => {
            // 3. Idempotency Check: See if this generation was already successful
            const existingGenDoc = await transaction.get(generationRef);
            if (existingGenDoc.exists && existingGenDoc.data().status === 'SUCCESS') {
                throw { code: 'IDEMPOTENT_SUCCESS', data: existingGenDoc.data() };
            }

            // 4. Credit Check
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists || userDoc.data().creditBalance <= 0) {
                throw { code: 402, message: 'NO_CREDITS' };
            }

            // Lock this generation attempt by creating a record
            transaction.set(generationRef, {
                idempotencyKey,
                userId: uid,
                prompt,
                status: 'PROCESSING',
                createdAt: new Date().toISOString(),
            });
        });

        // 5. Call External Image Provider (outside transaction)
        const imageProviderResponse = await callImageProvider(prompt, imageData, aspectRatio);

        // 6. On success, debit credit and finalize records
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const currentBalance = userDoc.data().creditBalance;
            finalCreditBalance = currentBalance - 1;

            // a. Decrement user's credit balance
            transaction.update(userRef, { creditBalance: admin.firestore.FieldValue.increment(-1) });
            
            // b. Record the successful generation details
            transaction.update(generationRef, {
                status: 'SUCCESS',
                imageUrl: imageProviderResponse.imageUrl,
                completedAt: new Date().toISOString()
            });
            
            // c. Create a ledger entry for the debit
            const newLedgerEntryRef = ledgerRef.doc();
            transaction.set(newLedgerEntryRef, {
                delta: -1,
                reason: 'DEBIT_GENERATION',
                ref: idempotencyKey,
                createdAt: new Date().toISOString(),
            });
        });

        return res.status(200).json({ 
            imageUrl: imageProviderResponse.imageUrl, 
            remainingCredits: finalCreditBalance 
        });

    } catch (error) {
        // Handle specific thrown errors and general failures
        if (error.code === 'IDEMPOTENT_SUCCESS') {
            const userSnapshot = await userRef.get();
            return res.status(200).json({ 
                imageUrl: error.data.imageUrl, 
                remainingCredits: userSnapshot.data().creditBalance,
                message: 'Request already processed.'
            });
        }
        if (error.code === 402) {
            return res.status(402).json({ error: error.message });
        }

        console.error("Image Generation Transaction Error:", error);
        // Mark generation as failed
        await generationRef.set({ status: 'FAILED', error: error.message || 'Unknown error' }, { merge: true });
        
        if (error.isProviderError) {
             return res.status(502).json({ error: `Image provider error: ${error.message}` });
        }
        
        return res.status(500).json({ error: 'An internal error occurred during generation.' });
    }
}

async function callImageProvider(prompt, imageData, aspectRatio) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw { isProviderError: true, message: 'Server configuration error: API key not found.' };
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
        payload = { instances: [{ prompt }], parameters: { "sampleCount": 1, "aspectRatio": aspectRatio || "1:1" } };
    }

    const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw { isProviderError: true, message: `Google API Error: ${errorText}` };
    }

    const result = await apiResponse.json();
    let base64Data;
    if (imageData) {
        base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    } else {
        base64Data = result.predictions?.[0]?.bytesBase64Encoded;
    }

    if (!base64Data) {
        throw { isProviderError: true, message: 'No image data received from API.' };
    }
    
    return { imageUrl: `data:image/png;base64,${base64Data}` };
}
