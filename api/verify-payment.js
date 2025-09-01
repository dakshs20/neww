// File: /api/verify-payment.js
// This server-side function verifies the payment and adds credits to the user's account.
import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { increment } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

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

    const { 
        razorpay_payment_id, 
        razorpay_order_id, 
        razorpay_signature,
        userId,
        credits
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    try {
        // Step 1: Verify the signature
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ status: 'error', error: 'Invalid signature' });
        }

        // Step 2: Signature is valid, update the user's credits in Firestore
        const userRef = db.collection('users').doc(userId);
        
        await userRef.update({
            credits: increment(parseInt(credits, 10))
        });
        
        // You could also store transaction details in a separate collection here for your records

        res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
}
