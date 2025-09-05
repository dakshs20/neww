// /api/provision-user.js
import { db, auth } from './utils/firebase-admin.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { token } = req.body;
    if (!token) {
        return res.status(401).json({ error: 'Authentication token is required.' });
    }

    try {
        const decodedToken = await auth.verifyIdToken(token);
        const { uid, name, email, picture } = decodedToken;
        
        const userRef = db.collection('users').doc(uid);
        const ledgerRef = userRef.collection('creditLedger');

        // Run a transaction to ensure atomic creation
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (userDoc.exists) {
                // If the user document already exists, do nothing.
                return;
            }

            // 1. Create the user document
            transaction.set(userRef, {
                uid,
                name,
                email,
                picture,
                creditBalance: 5,
                createdAt: new Date().toISOString(),
            });

            // 2. Create the initial credit ledger entry
            const initialCreditEntryRef = ledgerRef.doc();
            transaction.set(initialCreditEntryRef, {
                delta: 5,
                reason: 'ALLOCATE_FREE',
                createdAt: new Date().toISOString(),
            });
        });

        res.status(200).json({ success: true, message: 'User provisioned successfully.' });

    } catch (error) {
        console.error('Error in user provisioning:', error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Token expired, please sign in again.' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
