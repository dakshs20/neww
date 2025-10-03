import admin from 'firebase-admin';
import crypto from 'crypto';

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized Successfully in payu-callback.js");
    } catch (error) {
        console.error("Firebase Admin Initialization Error in payu-callback.js:", error);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const salt = process.env.PAYU_SECRET_KEY;
        const receivedData = req.body;
        
        const status = receivedData.status;
        const key = receivedData.key;
        const txnid = receivedData.txnid;
        const amount = receivedData.amount;
        const productinfo = receivedData.productinfo;
        const firstname = receivedData.firstname;
        const email = receivedData.email;
        const udf1 = receivedData.udf1; // Firebase UID
        const udf2 = receivedData.udf2; // Plan name
        const receivedHash = receivedData.hash;

        // Security Check: Verify the integrity of the response
        const hashString = `${salt}|${status}|||||||||${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

        if (calculatedHash !== receivedHash) {
            console.error("Hash Mismatch Error: Payment callback is not authentic.");
            return res.status(400).send("Security Error: Transaction tampering detected.");
        }
        
        const planDetails = {
            'starter': { amount: 798.00, credits: 575 },
            'pro':     { amount: 1596.00, credits: 975 },
            'elite':   { amount: 2571.00, credits: 1950 },
        };

        if (status === 'success' && udf1 && udf2 && planDetails[udf2]) {
            const plan = planDetails[udf2];
            const creditsToAdd = plan.credits;

            const userRef = db.collection('users').doc(udf1);
            
            // Calculate next billing date (one month from now)
            const now = new Date();
            const nextBillingDate = new Date(now.setMonth(now.getMonth() + 1));

            // Use a transaction to ensure atomic update
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const currentCredits = userDoc.exists ? userDoc.data().credits : 0;
                
                transaction.set(userRef, {
                    plan: udf2,
                    credits: currentCredits + creditsToAdd,
                    subscriptionStatus: 'active',
                    lastPayment: admin.firestore.FieldValue.serverTimestamp(),
                    nextBilling: admin.firestore.Timestamp.fromDate(nextBillingDate)
                }, { merge: true });
            });
            
            console.log(`Successfully added ${creditsToAdd} credits for plan ${udf2} to user ${udf1}`);

            const successUrl = new URL('/pricing.html', `https://${req.headers.host}`);
            successUrl.searchParams.append('status', 'success');
            return res.redirect(302, successUrl.toString());
        }
        
        console.warn(`Payment status was not 'success' for txnid: ${txnid}. Status: ${status}`);
        const failureUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        failureUrl.searchParams.append('status', 'failed');
        res.redirect(302, failureUrl.toString());

    } catch (error) {
        console.error("Fatal Error in PayU Callback Handler:", error);
        const errorUrl = new URL('/pricing.html', `https://${req.headers.host}`);
        errorUrl.searchParams.append('status', 'error');
        res.redirect(302, errorUrl.toString());
    }
}
