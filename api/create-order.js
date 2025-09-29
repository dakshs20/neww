import Razorpay from 'razorpay';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';

// --- Initialize Firebase Admin SDK ---
// This must be done once and is safe to run multiple times in a serverless environment.
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in create-order.js:", error);
    }
}


// --- Plan Details (SERVER-SIDE SOURCE OF TRUTH) ---
// Prices are defined here to prevent manipulation from the client-side.
// Prices are in RUPEES. We will convert to paise before sending to Razorpay.
const planDetails = {
    hobby: { priceMonthly: 798, priceYearly: 7980, razorpayPlanId: process.env.RAZORPAY_PLAN_HOBBY },
    create: { priceMonthly: 1596, priceYearly: 15960, razorpayPlanId: process.env.RAZORPAY_PLAN_CREATE },
    elevate: { priceMonthly: 2571, priceYearly: 25710, razorpayPlanId: process.env.RAZORPAY_PLAN_ELEVATE }
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

        // --- Initialize Razorpay ---
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const { planId, billingCycle } = req.body;
        const selectedPlan = planDetails[planId];

        if (!selectedPlan) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }
        
        const notes = { userId, planId, billingCycle };

        // --- Handle Monthly vs. Yearly Flow ---
        if (billingCycle === 'monthly') {
            // ** MONTHLY FLOW: Create a Subscription **
            if (!selectedPlan.razorpayPlanId) {
                return res.status(500).json({ error: `Razorpay Plan ID for ${planId} is not configured on the server.` });
            }

            const subscription = await razorpay.subscriptions.create({
                plan_id: selectedPlan.razorpayPlanId,
                total_count: 12, // The subscription will run for 12 cycles (1 year)
                quantity: 1,
                notes: notes,
            });
            
            res.status(200).json({
                key: process.env.RAZORPAY_KEY_ID,
                subscriptionId: subscription.id,
                // No orderId is needed for subscriptions
            });

        } else {
            // ** YEARLY FLOW: Create a one-time Order **
            const amountInRupees = selectedPlan.priceYearly;
            const amountInPaise = amountInRupees * 100; // CRITICAL: Convert to paise

            const options = {
                amount: amountInPaise,
                currency: "INR",
                receipt: `receipt_user_${userId}_${Date.now()}`,
                notes: notes
            };

            const order = await razorpay.orders.create(options);
             res.status(200).json({
                key: process.env.RAZORPAY_KEY_ID,
                amount: order.amount,
                orderId: order.id,
                // No subscriptionId for one-time orders
            });
        }

    } catch (error) {
        console.error("API Error in /api/create-order:", error);
        res.status(500).json({ error: 'Could not create order.', details: error.message });
    }
}

