// /api/verify-payment.js
// --- NEW FILE ---
// Verifies the payment signature and adds credits to the user's account.

import crypto from 'crypto';
import admin from './firebase-admin-config.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            idToken,
            planId,
            credits
        } = req.body;

        if (!idToken) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid } = decodedToken;

        // 1. Verify the payment signature
        const secret = process.env.RAZORPAY_KEY_SECRET || 'QEsURcMPpAupgzuRZQkSQxfI';
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', secret).update(body.toString()).digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
        }

        // 2. Signature is valid. Update user's credits in Firestore.
        const db = admin.firestore();
        const userRef = db.collection('users').doc(uid);
        
        // Use a transaction to safely update credits and log the purchase
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new Error("User document does not exist!");
            }
            
            const newCredits = (userDoc.data().credits || 0) + credits;
            transaction.update(userRef, { credits: newCredits });

            // Log the transaction
            const transactionRef = userRef.collection('transactions').doc(razorpay_payment_id);
            transaction.set(transactionRef, {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                plan: planId,
                creditsAdded: credits,
                status: 'success',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        res.status(200).json({ success: true, message: 'Payment successful and credits added.' });

    } catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ error: 'Payment verification failed.', details: error.message });
    }
}
