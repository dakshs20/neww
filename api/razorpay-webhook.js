// This is a serverless function.
import admin from 'firebase-admin';
import crypto from 'crypto';

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
const db = admin.firestore();

// --- Plan Data (Backend Source of Truth) ---
const plans = {
    hobby: { name: 'Hobby Plan', credits: 575, expiry: '3 months' },
    create: { name: 'Create Plan', credits: 975, expiry: '5 months' },
    elevate: { name: 'Elevate Plan', credits: 1950, expiry: 'Never' }
};

// --- Map Razorpay Plan IDs to our internal plan IDs ---
// This is crucial for identifying which plan to credit
const razorpayPlanMap = {
    [process.env.RAZORPAY_PLAN_HOBBY]: 'hobby',
    [process.env.RAZORPAY_PLAN_CREATE]: 'create',
    [process.env.RAZORPAY_PLAN_ELEVATE]: 'elevate'
};


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    try {
        // --- Verify Webhook Signature ---
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            return res.status(400).json({ error: 'Invalid signature.' });
        }

        // --- Process Webhook Event ---
        const event = req.body.event;
        const payload = req.body.payload;

        // We only care about successful monthly charges
        if (event === 'subscription.charged') {
            const paymentId = payload.payment.entity.id;
            const subscription = payload.subscription.entity;
            const userId = subscription.notes.userId;
            const razorpayPlanId = subscription.plan_id;
            
            const planId = razorpayPlanMap[razorpayPlanId];
            if (!planId || !plans[planId]) {
                throw new Error(`Could not map Razorpay plan ${razorpayPlanId} to internal plan.`);
            }

            const plan = plans[planId];
            const creditsToAdd = plan.credits;
            
            // --- Idempotency Check & Credit Allocation ---
            const userRef = db.collection('users').doc(userId);
            const transactionRef = db.collection('transactions').doc(paymentId);

            await db.runTransaction(async (t) => {
                const transactionDoc = await t.get(transactionRef);
                if (transactionDoc.exists) {
                    console.log(`Webhook event for payment ${paymentId} already processed.`);
                    return;
                }

                // 1. Update user's credits and subscription info
                 t.set(userRef, {
                    credits: admin.firestore.FieldValue.increment(creditsToAdd),
                    subscription: {
                        planId: planId,
                        planName: plan.name,
                        billingCycle: 'monthly',
                        status: 'active',
                        expiry: plan.expiry,
                        razorpaySubscriptionId: subscription.id
                    }
                }, { merge: true });

                // 2. Log the transaction to prevent reprocessing
                t.set(transactionRef, {
                    userId: userId,
                    status: 'success',
                    amount: payload.payment.entity.amount / 100,
                    type: 'monthly_subscription',
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
             console.log(`Successfully processed subscription.charged for user ${userId}. Added ${creditsToAdd} credits.`);
        }
        
        res.status(200).json({ status: 'received' });

    } catch (error) {
        console.error("Razorpay Webhook Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
