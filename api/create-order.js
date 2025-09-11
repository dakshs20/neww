// --- UPDATED & FINAL ---
// This file correctly uses INR as the currency and converts the amount to the 
// smallest unit (paisa) to align with Razorpay's requirements.

import { admin } from './firebase-admin-config.js';
import Razorpay from 'razorpay';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
    // Add a check to ensure Firebase Admin initialized correctly.
    if (!admin.apps.length) {
        console.error("Firebase Admin SDK is not initialized.");
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { idToken, plan } = req.body;
        const { amount, name } = plan;

        if (!idToken || !plan || !amount || !name) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }
        
        // Securely verify the user's identity with Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        
        // Initialize Razorpay with server-side credentials
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // CORE FIX: Generate a shorter receipt ID to stay within Razorpay's 40-character limit.
        const shortReceiptId = `rcpt_${randomBytes(8).toString('hex')}`;

        const options = {
            amount: amount * 100, // Convert amount (e.g., ₹499) to smallest unit (49900 paisa)
            currency: 'INR',      // Set currency to INR to match your Razorpay account
            receipt: shortReceiptId,
            notes: {
                userId: uid,
                planName: name
            }
        };
        
        const order = await razorpay.orders.create(options);
        
        if (!order) {
            console.error("Razorpay order creation failed: No order object was returned from the API.");
            return res.status(500).json({ error: 'Razorpay order creation failed.' });
        }
        
        // Send the complete order details back to the frontend
        res.status(200).json(order);

    } catch (error) {
        console.error("Critical Error in /api/create-order:", error);
        
        // Provide more specific feedback if Razorpay gives a detailed error
        if (error.error && error.error.description) {
             return res.status(500).json({ error: `Razorpay Error: ${error.error.description}` });
        }
        
        // Generic fallback error
        res.status(500).json({ error: 'Could not create payment order.', details: error.message });
    }
}

