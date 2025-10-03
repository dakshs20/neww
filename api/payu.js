import { auth } from 'firebase-admin';
import crypto from 'crypto';
import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized Successfully in payu.js");
    } catch (error) {
        console.error("Firebase Admin Initialization Error in payu.js:", error);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { plan } = req.body;
        const idToken = req.headers.authorization?.split('Bearer ')[1];

        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated. No token provided.' });
        }
        
        const user = await auth().verifyIdToken(idToken);
        if (!user) {
            return res.status(401).json({ error: 'Invalid user token. Authentication failed.' });
        }

        // IMPORTANT: Server-side pricing to prevent manipulation.
        const pricing = {
            starter: { amount: '798.00', credits: 575 },
            pro:     { amount: '1596.00', credits: 975 },
            elite:   { amount: '2571.00', credits: 1950 }
        };

        if (!pricing[plan]) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        const { amount } = pricing[plan];
        const key = process.env.PAYU_CLIENT_ID;
        const salt = process.env.PAYU_SECRET_KEY;

        if (!key || !salt) {
            console.error("PayU credentials (PAYU_CLIENT_ID or PAYU_SECRET_KEY) are not set.");
            return res.status(500).json({ error: 'Server payment configuration error.' });
        }
        
        const txnid = `GENART-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        
        const productinfo = `GenArt Credits - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`;
        const firstname = user.name || 'GenArt User';
        const email = user.email || '';
        const udf1 = user.uid; // User's Firebase UID
        const udf2 = plan; // Store the plan name

        const surl = `${req.headers.origin}/api/payu-callback`;
        const furl = `${req.headers.origin}/api/payu-callback`;

        // Construct the hash string in the exact order required by PayU.
        const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        const paymentData = {
            key,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            surl,
            furl,
            hash,
            udf1,
            udf2,
        };

        res.status(200).json({ paymentData });

    } catch (error) {
        console.error("PayU API Error in payu.js:", error);
        res.status(500).json({ error: 'Could not start the payment process due to a server error.' });
    }
}
