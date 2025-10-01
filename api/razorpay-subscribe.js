import admin from 'firebase-admin';
import Razorpay from 'razorpay';

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in razorpay-subscribe.js:", error);
    }
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// IMPORTANT: Replace these placeholder IDs with your actual Plan IDs from the Razorpay Dashboard.
// You must create a separate plan in Razorpay for each of these.
const plan_ids = {
    create_monthly: 'plan_REPLACE_WITH_YOUR_ID',
    create_yearly: 'plan_REPLACE_WITH_YOUR_ID',
    elevate_monthly: 'plan_REPLACE_WITH_YOUR_ID',
    elevate_yearly: 'plan_REPLACE_WITH_YOUR_ID',
    pro_monthly: 'plan_REPLACE_WITH_YOUR_ID',
    pro_yearly: 'plan_REPLACE_WITH_YOUR_ID',
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { plan, cycle } = req.body;
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const user = await admin.auth().verifyIdToken(idToken);

        const planKey = `${plan}_${cycle}`;
        const plan_id = plan_ids[planKey];

        if (!plan_id || plan_id === 'plan_REPLACE_WITH_YOUR_ID') {
            return res.status(400).json({ error: 'Invalid plan selected or Plan ID not configured on the server.' });
        }
        
        // Add user's UID to the notes so we can identify them in the webhook
        const notes = {
            firebase_uid: user.uid,
            plan_key: planKey
        };

        const subscription = await razorpay.subscriptions.create({
            plan_id: plan_id,
            customer_notify: 1,
            total_count: cycle === 'yearly' ? 12 : 12, // Number of billing cycles
            notes: notes
        });

        res.status(200).json({
            subscription_id: subscription.id,
            razorpay_key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Razorpay API Error:", error);
        res.status(500).json({ error: 'Could not create subscription.' });
    }
}

