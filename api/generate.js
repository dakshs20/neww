// NOTE: This is a server-side API file (e.g., for Vercel, Netlify, or Node.js).
// It requires the Firebase Admin SDK and environment variables.

// MOCK SETUP for demonstration in a non-server environment.
// In a real setup, you would use:
// import { initializeApp, cert } from 'firebase-admin/app';
// import { getFirestore } from 'firebase-admin/firestore';
//
// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// initializeApp({ credential: cert(serviceAccount) });
// const db = getFirestore();
// const admin = { firestore: { FieldValue } }; // To get access to increment

// This is a simplified mock for browser demonstration.
const MOCK_DB = {
    users: {},
    increment: (val) => ({ type: 'INCREMENT', value: val }),
    async getDoc(path) {
        const [ , userId] = path.split('/');
        return {
            exists: () => !!this.users[userId],
            data: () => this.users[userId]
        }
    },
    async updateDoc(path, data) {
        const [ , userId] = path.split('/');
        if(data.credits && data.credits.type === 'INCREMENT') {
            this.users[userId].credits += data.credits.value;
        }
    },
    // Helper to setup mock user
    setupUser(userId, credits) {
        this.users[userId] = { credits };
    }
};
// MOCK_DB.setupUser('test-user-123', 5); // Example setup

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, imageData, aspectRatio, userId } = req.body;
        
        // --- 1. Authentication & Authorization ---
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const userDocRefPath = `users/${userId}`; // Path for mock DB
        // Real Firestore: const userDocRef = db.collection('users').doc(userId);
        
        const userDoc = await MOCK_DB.getDoc(userDocRefPath); // Real: await userDocRef.get();

        if (!userDoc.exists()) {
            // This case should be handled by the client on first login, but as a safeguard:
            return res.status(404).json({ error: 'User not found.' });
        }

        const userData = userDoc.data();
        
        // --- 2. Check Credits ---
        if (userData.credits <= 0) {
            return res.status(403).json({ error: "No credits remaining.", code: "NO_CREDITS" });
        }

        // --- 3. Deduct Credit ---
        // In a real environment, this should be a transaction for safety.
        await MOCK_DB.updateDoc(userDocRefPath, { credits: MOCK_DB.increment(-1) });
        // Real Firestore: await userDocRef.update({ credits: admin.firestore.FieldValue.increment(-1) });

        // --- 4. Image Generation Logic (Unchanged) ---
        const apiKey = process.env.GOOGLE_API_KEY; // This needs to be set in your server environment
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        let apiUrl, payload;
        // The rest of the image generation logic is the same...
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
        payload = { 
            instances: [{ prompt }], 
            parameters: { "sampleCount": 1, "aspectRatio": aspectRatio || "1:1" } 
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            // IMPORTANT: If image generation fails, REFUND the credit.
            await MOCK_DB.updateDoc(userDocRefPath, { credits: MOCK_DB.increment(1) });
            // Real Firestore: await userDocRef.update({ credits: admin.firestore.FieldValue.increment(1) });
            const errorText = await apiResponse.text();
            console.error("Google API Error:", errorText);
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }
        
        const result = await apiResponse.json();

        // --- 5. Return Success Response with Remaining Credits ---
        const remainingCredits = userData.credits - 1;
        res.status(200).json({ ...result, remainingCredits });

    } catch (error) {
        console.error("API function '/api/generate' crashed:", error);
        // Note: A credit refund might also be needed here depending on where the error occurred.
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}
