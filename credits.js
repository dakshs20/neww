// File: /api/credits.js
// Handles all logic for fetching, adding, and deducting user credits.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore'; // Corrected: Added FieldValue
import { getAuth } from 'firebase-admin/auth';

// --- Firebase Admin SDK Initialization ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();
const auth = getAuth();

export default async function handler(req, res) {
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    const idToken = authorization.split('Bearer ')[1];
    let decodedToken;

    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }

    const userId = decodedToken.uid;
    const userRef = db.collection('users').doc(userId);

    try {
        switch (req.method) {
            case 'GET':
                // --- Fetch user's credit balance ---
                const doc = await userRef.get();
                if (!doc.exists) {
                    // This case handles new users. We'll create their doc with initial credits.
                    await userRef.set({ credits: 25 });
                    return res.status(200).json({ credits: 25 });
                }
                res.status(200).json({ credits: doc.data().credits || 0 });
                break;

            case 'POST':
                // --- Add credits after a purchase ---
                const { amount } = req.body;
                if (typeof amount !== 'number' || amount <= 0) {
                    return res.status(400).json({ error: 'Invalid credit amount specified.' });
                }
                await userRef.update({
                    credits: FieldValue.increment(amount)
                });
                res.status(200).json({ success: true, message: 'Credits added successfully.' });
                break;

            case 'PATCH':
                 // --- Deduct one credit for generation ---
                const userDoc = await userRef.get();
                if (!userDoc.exists || userDoc.data().credits < 1) {
                    return res.status(402).json({ error: 'Insufficient credits.' });
                }
                await userRef.update({
                    credits: userDoc.data().credits - 1
                });
                res.status(200).json({ success: true, newBalance: userDoc.data().credits - 1 });
                break;

            default:
                res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
                res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        console.error(`Credit API Error (${req.method}):`, error);
        res.status(500).json({ error: 'An internal server error occurred while managing credits.' });
    }
}

