const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();
const OLD_URL = 'http://localhost:5000';
const NEW_URL = 'https://privox-backend.onrender.com';

async function repairUrls() {
  console.log('🔍 Starting URL repair in Firestore...');
  
  const collections = ['products', 'designFiles', 'refundRequests'];
  let totalFixed = 0;

  for (const colName of collections) {
    console.log(`Checking collection: ${colName}`);
    const snapshot = await db.collection(colName).get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      let updated = false;
      const updates = {};

      // Check fields that usually have URLs
      const fieldsToCheck = ['imageUrl', 'fileUrl', 'customerPhotoUrl', 'customerVideoUrl', 'vendorDisputePhotoUrl', 'vendorPackingVideoUrl'];
      
      for (const field of fieldsToCheck) {
        if (data[field] && typeof data[field] === 'string' && data[field].includes(OLD_URL)) {
          updates[field] = data[field].replace(OLD_URL, NEW_URL);
          updated = true;
          console.log(`✅ Fixed ${field} in ${colName}/${doc.id}`);
        }
      }

      if (updated) {
        await doc.ref.update(updates);
        totalFixed++;
      }
    }
  }

  console.log(`✨ Done! Fixed ${totalFixed} broken links.`);
}

repairUrls().catch(console.error);
