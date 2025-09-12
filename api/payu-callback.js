// File: /api/payu-callback.js
// This endpoint handles the response from PayU after a transaction.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

// --- Firebase Admin SDK Initialization ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { status, txnid, amount, productinfo } = req.body;
    const salt = process.env.PAYU_SECRET_KEY || 'c909c9b9ab0e4f84dcbadde5f5d9829773a90ffcb92e9282341d40af723241b6';
    const key = process.env.PAYU_CLIENT_ID || 'a10828505233b1d8a3112837184c40bb63078a637ebebef0d75ba9724f11e511';

    // --- Verify the hash to ensure the request is from PayU ---
    // Note: The hash calculation for the response is different.
    // Please refer to PayU documentation for the exact reverse hash string format.
    // This is a simplified example.
    
    if (status === 'success') {
        try {
            const userId = txnid.split('-')[1]; // Extract userId from txnid
            const userRef = db.collection('users').doc(userId);

            // Determine credits to add based on product info
            let creditsToAdd = 0;
            if (productinfo === 'Starter Pack') creditsToAdd = 600;
            else if (productinfo === 'Pro Pack') creditsToAdd = 1200;
            else if (productinfo === 'Mega Pack') creditsToAdd = 4000;

            if (creditsToAdd > 0) {
                await userRef.update({
                    credits: FieldValue.increment(creditsToAdd)
                });
            }
            
            // Redirect to the main page with a success message
            res.redirect('/?payment=success');

        } catch (error) {
            console.error("Callback Error - DB Update Failed:", error);
            res.redirect('/?payment=error');
        }
    } else {
        // Handle failed or cancelled transaction
        res.redirect('/?payment=failed');
    }
}
