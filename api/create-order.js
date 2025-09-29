// This is a serverless function.
import Razorpay from 'razorpay';
import admin from 'firebase-admin';

// --- Initialize Firebase Admin ---
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error.stack);
    }
}

// --- Initialize Razorpay ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Plan Data (Backend Source of Truth) ---
const plans = {
    hobby: {
        name: 'Hobby Plan',
        prices: { monthly: 798, yearly: 798 * 12 * 0.8 },
        razorpayPlanId: process.env.RAZORPAY_PLAN_HOBBY,
    },
    create: {
        name: 'Create Plan',
        prices: { monthly: 1596, yearly: 1596 * 12 * 0.8 },
        razorpayPlanId: process.env.RAZORPAY_PLAN_CREATE,
    },
    elevate: {
        name: 'Elevate Plan',
        prices: { monthly: 2571, yearly: 2571 * 12 * 0.8 },
        razorpayPlanId: process.env.RAZORPAY_PLAN_ELEVATE,
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'Unauthorized: No token provided.' });
        }
        const user = await admin.auth().verifyIdToken(idToken);

        const { planId, billingCycle } = req.body;

        if (!plans[planId]) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        const selectedPlan = plans[planId];
        let responsePayload;

        const notes = {
            userId: user.uid,
            planId: planId,
            billingCycle: billingCycle,
        };

        if (billingCycle === 'monthly') {
            // --- Create a Subscription ---
            const subscription = await razorpay.subscriptions.create({
                plan_id: selectedPlan.razorpayPlanId,
                total_count: 12, // For a year, can be changed
                quantity: 1,
                notes: notes,
            });
            responsePayload = {
                key: process.env.RAZORPAY_KEY_ID,
                subscription_id: subscription.id,
                // amount isn't needed for subscription checkout
            };
        } else {
            // --- Create a one-time Order for Yearly Payment ---
            const amount = Math.round(selectedPlan.prices.yearly);
            const options = {
                amount: amount * 100, // Amount in paisa
                currency: 'INR',
                receipt: `receipt_genart_${Date.now()}`,
                notes: notes,
            };
            const order = await razorpay.orders.create(options);
            responsePayload = {
                key: process.env.RAZORPAY_KEY_ID,
                id: order.id,
                amount: order.amount,
            };
        }

        res.status(200).json(responsePayload);

    } catch (error) {
        console.error("Create Order API Error:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
