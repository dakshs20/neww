import admin from 'firebase-admin';
import crypto from 'crypto';
import Razorpay from 'razorpay';


if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in razorpay-verify.js:", error);
    }
}

const db = admin.firestore();
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Match these to your pricing.html `plans` object
const plans = {
    create: { monthly: { credits: 575 }, yearly: { credits: 575 } },
    elevate: { monthly: { credits: 975 }, yearly: { credits: 975 } },
    pro: { monthly: { credits: 1950 }, yearly: { credits: 1950 } }
};

export default async function handler(req, res) {
    // This function now acts as a webhook endpoint.
    // It should be triggered by Razorpay, not directly by your frontend.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const signature = req.headers['x-razorpay-signature'];
        const body = req.body;

        // IMPORTANT: Verify the webhook signature
        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
        shasum.update(JSON.stringify(body));
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            return res.status(400).json({ error: 'Invalid signature. Request is not from Razorpay.' });
        }
        
        // Process the event
        const event = body.event;
        if (event === 'subscription.charged') {
            const subscriptionEntity = body.payload.subscription.entity;
            const notes = subscriptionEntity.notes;
            const firebase_uid = notes.firebase_uid;
            const plan_key = notes.plan_key;

            if (!firebase_uid || !plan_key) {
                 console.error("Webhook payload missing firebase_uid or plan_key in notes.");
                 return res.status(400).json({ error: 'Missing user or plan information.' });
            }

            const [plan, cycle] = plan_key.split('_');
            const creditsToAdd = plans[plan][cycle].credits;
            const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
            
            const userRef = db.collection('users').doc(firebase_uid);
            await userRef.update({
                credits: admin.firestore.FieldValue.increment(creditsToAdd),
                subscription: {
                    id: subscriptionEntity.id,
                    planName: planName,
                    cycle: cycle,
                    status: 'active',
                    // `current_end` is the end of the current billing cycle
                    nextBillingDate: new Date(subscriptionEntity.current_end * 1000).toISOString()
                }
            });
        } else if (event === 'subscription.cancelled') {
            // You can add logic here if needed, but the /api/cancel-subscription handles the DB update.
            console.log("Subscription cancelled event received for:", body.payload.subscription.entity.id);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error("Razorpay Webhook Error:", error);
        res.status(500).json({ error: 'Webhook processing failed.' });
    }
}

