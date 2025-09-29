import crypto from 'crypto';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// --- Initialize Firebase Admin SDK ---
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in verify-payment.js:", error);
    }
}

const db = getFirestore();

// --- Plan Credits (SERVER-SIDE SOURCE OF TRUTH) ---
const planCredits = {
    hobby: 575,
    create: 975,
    elevate: 1950
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // --- Authenticate User ---
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature,
            billingCycle
        } = req.body;

        const webhookSecret = process.env.RAZORPAY_KEY_SECRET;

        // --- Verify Signature ---
        // The body for signature verification is different for orders vs. subscriptions.
        const body = billingCycle === 'monthly' 
            ? `${razorpay_payment_id}|${razorpay_subscription_id}`
            : `${razorpay_order_id}|${razorpay_payment_id}`;
        
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed. Signature mismatch.' });
        }

        // --- SIGNATURE IS VERIFIED ---
        // Now we can safely update the database.

        // Fetch order/subscription details to get the planId from notes
        // This is more secure than trusting the client.
        const razorpay = new (await import('razorpay')).default({
             key_id: process.env.RAZORPAY_KEY_ID,
             key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const entity = billingCycle === 'monthly'
            ? await razorpay.subscriptions.fetch(razorpay_subscription_id)
            : await razorpay.payments.fetch(razorpay_payment_id);
            
        const planId = entity.notes?.planId;

        if (!planId || !planCredits[planId]) {
            throw new Error(`Invalid planId '${planId}' found in payment notes.`);
        }

        const creditsToAdd = planCredits[planId];
        const userRef = db.collection('users').doc(userId);

        // Update user's credits
        await userRef.update({
            credits: admin.firestore.FieldValue.increment(creditsToAdd)
        });

        // Store subscription details for the user for dashboard and scheduler
        await userRef.collection('subscriptions').doc(razorpay_subscription_id || razorpay_order_id).set({
            planId: planId,
            billingCycle: billingCycle,
            status: 'active',
            startDate: admin.firestore.FieldValue.serverTimestamp(),
            razorpaySubscriptionId: razorpay_subscription_id || null,
            razorpayOrderId: razorpay_order_id || null,
            razorpayPaymentId: razorpay_payment_id,
        }, { merge: true });

        console.log(`Successfully verified payment for user ${userId}. Added ${creditsToAdd} credits.`);
        res.status(200).json({ message: 'Payment verified successfully.' });

    } catch (error) {
        console.error("API Error in /api/verify-payment:", error);
        res.status(500).json({ error: 'Payment verification failed.', details: error.message });
    }
}

