// This is a serverless function, intended to be run by a cron job.
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
const db = admin.firestore();

// --- Plan Data for Credit Allocation ---
const plans = {
    hobby: { name: 'Hobby Plan', credits: 575 },
    create: { name: 'Create Plan', credits: 975 },
    elevate: { name: 'Elevate Plan', credits: 1950 }
};

export default async function handler(req, res) {
    // --- Security Check ---
    const cronSecret = req.headers.authorization?.split('Bearer ')[1];
    if (cronSecret !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }
    
    console.log("Scheduler starting run...");
    const now = new Date();
    let usersProcessed = 0;

    try {
        // --- Find yearly subscribers due for credits ---
        const querySnapshot = await db.collection('users')
            .where('subscription.billingCycle', '==', 'yearly')
            .where('subscription.status', '==', 'active')
            .where('subscription.nextCreditDate', '<=', admin.firestore.Timestamp.fromDate(now))
            .get();

        if (querySnapshot.empty) {
            console.log("No users due for yearly credit allocation.");
            return res.status(200).json({ status: 'No users to process.' });
        }

        // --- Process each due subscriber ---
        for (const doc of querySnapshot.docs) {
            const user = doc.data();
            const userId = doc.id;
            const planId = user.subscription.planId;
            
            if (!plans[planId]) {
                console.error(`User ${userId} has an invalid planId: ${planId}. Skipping.`);
                continue;
            }

            const creditsToAdd = Math.floor(plans[planId].credits / 12);
            
            // --- Use a transaction for idempotency and safety ---
            // The unique key for idempotency is userId + nextCreditDate
            const nextCreditDate = user.subscription.nextCreditDate.toDate();
            const idempotencyKey = `${userId}_${nextCreditDate.toISOString()}`;
            const transactionRef = db.collection('transactions').doc(idempotencyKey);
            
            await db.runTransaction(async (t) => {
                const transactionDoc = await t.get(transactionRef);
                if (transactionDoc.exists) {
                    console.log(`Scheduler allocation for ${idempotencyKey} already processed. Skipping.`);
                    return;
                }

                const userRef = db.collection('users').doc(userId);
                const newNextCreditDate = new Date(nextCreditDate);
                newNextCreditDate.setMonth(newNextCreditDate.getMonth() + 1);

                // 1. Update user's credits and next credit date
                t.update(userRef, {
                    'credits': admin.firestore.FieldValue.increment(creditsToAdd),
                    'subscription.nextCreditDate': admin.firestore.Timestamp.fromDate(newNextCreditDate)
                });

                // 2. Log the transaction
                 t.set(transactionRef, {
                    userId: userId,
                    status: 'success',
                    amount: `+${creditsToAdd} credits`,
                    type: 'yearly_scheduled_allocation',
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            usersProcessed++;
            console.log(`Allocated ${creditsToAdd} credits to user ${userId}.`);
        }

        res.status(200).json({ status: 'success', usersProcessed });

    } catch (error) {
        console.error("Scheduler Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
