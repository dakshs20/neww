import { auth } from 'firebase-admin';
import crypto from 'crypto';

// Initialize Firebase Admin SDK (ensure it's initialized only once)
import admin from 'firebase-admin';
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
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

        // Define the pricing structure on the server to prevent manipulation from the client-side.
        const pricing = {
            starter: { amount: '6.00', credits: 600 },
            pro: { amount: '12.00', credits: 1200 },
            mega: { amount: '35.00', credits: 4000 }
        };

        if (!pricing[plan]) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }

        const { amount } = pricing[plan];
        const key = process.env.PAYU_CLIENT_ID;
        const salt = process.env.PAYU_SECRET_KEY;

        if (!key || !salt) {
            console.error("PayU credentials (KEY or SALT) are not set in environment variables.");
            return res.status(500).json({ error: 'Server payment configuration error.' });
        }
        
        // Create a unique transaction ID for every request to prevent rate-limiting issues.
        const txnid = `GENART-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        
        // Prepare user and product information for PayU.
        const productinfo = `GenArt Credits - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`;
        const firstname = user.name || 'GenArt User';
        const email = user.email || '';
        
        // CRITICAL STEP: Securely pass the user's unique Firebase ID to PayU.
        // This is essential for the callback to identify which user to give credits to.
        const udf1 = user.uid; 
        
        // Define the URLs PayU will use to redirect the user after payment.
        const surl = `${req.headers.origin}/api/payu-callback`; // Success URL
        const furl = `${req.headers.origin}/api/payu-callback`; // Failure URL

        // Construct the hash string in the exact order required by PayU for security.
        const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}||||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        // Package all the data to be sent back to the frontend.
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
            udf1, // This must be included in the data sent back to the form.
        };

        res.status(200).json({ paymentData });

    } catch (error) {
        console.error("PayU API Error:", error);
        res.status(500).json({ error: 'Could not start the payment process due to a server error.' });
    }
}

