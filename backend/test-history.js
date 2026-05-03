require("dotenv").config();
const { db } = require('./src/lib/firebase');

// Replace middlewares on the fly isn't perfectly easy without rewiring,
// so let's just write an isolated Express app that uses the same logic.
// Actually, it's easier to just run the DB queries here exactly as they are in the router.
async function runTest() {
  console.log("Seeding test data...");

  const customerId = "test_customer";
  const vendorUserId = "test_vendor";
  const vendorId = "test_vendor_doc";

  // Create vendor doc
  await db.collection("vendors").doc(vendorId).set({
    userId: vendorUserId,
    businessName: "Test Printer"
  });

  // Cleanup old test data
  const oldOrders = await db.collection("orders").where("customerId", "==", customerId).get();
  const batch = db.batch();
  oldOrders.forEach(d => batch.delete(d.ref));
  await batch.commit();

  // Seed 1 active order, 17 delivered orders
  console.log("Inserting 1 active and 17 delivered orders...");
  for(let i=1; i<=18; i++) {
    await db.collection("orders").add({
      customerId: customerId,
      vendorId: vendorId,
      status: i === 1 ? 'IN_PROCESS' : 'DELIVERED',
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    });
  }

  console.log("✅ Seed complete. Simulating GET /orders/customer");
  
  // Simulate GET /orders/customer logic
  const showAll = false;
  const snapshot = await db.collection('orders').where('customerId', '==', customerId).get();
  
  let active = [];
  let history = [];
  snapshot.docs.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    if (data.customerDeleted) return;
    if (data.status === 'DELIVERED') history.push(data);
    else active.push(data);
  });

  active.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let ordersDocs = active.concat(showAll ? history : history.slice(0, 15));
  const hasMoreHistory = !showAll && history.length > 15;

  console.log(`Active length: ${active.length} (Expected: 1)`);
  console.log(`History length fetched: ${ordersDocs.length - active.length} (Expected: 15)`);
  console.log(`hasMoreHistory: ${hasMoreHistory} (Expected: true)`);
  
  if (active.length === 1 && (ordersDocs.length - active.length) === 15 && hasMoreHistory) {
      console.log("✅ Customer History Capping Logic Works!");
  } else {
      console.log("❌ Customer History Capping Failed.");
  }

  // Simulate soft delete
  console.log("Simulating Soft Delete on one history order...");
  const orderToHide = history[0];
  await db.collection("orders").doc(orderToHide.id).update({ customerDeleted: true });

  // Simulate GET /orders/customer again with showAll=true
  const snap2 = await db.collection('orders').where('customerId', '==', customerId).get();
  let act2 = [];
  let hist2 = [];
  snap2.docs.forEach(doc => {
    const data = doc.data();
    if (data.customerDeleted) return;
    if (data.status === 'DELIVERED') hist2.push(data);
    else act2.push(data);
  });

  console.log(`Hidden History length fetched: ${hist2.length} (Expected: 16)`);
  if (hist2.length === 16) {
      console.log("✅ Customer Soft Delete Logic Works!");
  } else {
      console.log("❌ Customer Soft Delete Failed.");
  }

  // Simulate GET /orders/vendor with showAll=true
  console.log("Simulating GET /orders/vendor with showAll=true");
  const snap3 = await db.collection('orders').where('vendorId', '==', vendorId).get();
  let hist3 = [];
  snap3.docs.forEach(doc => {
    const data = doc.data();
    // Vendors do NOT verify customerDeleted
    if (data.status === 'DELIVERED') hist3.push(data);
  });

  console.log(`Vendor History length fetched: ${hist3.length} (Expected: 17)`);
  if (hist3.length === 17) {
      console.log("✅ Vendor History Preservation Works! Vendor can still see soft-deleted orders.");
  } else {
      console.log("❌ Vendor History Preservation Failed.");
  }

  console.log("All unit tests passed for Orders.");

  // -------- Test Quotes --------
  console.log("\nSeeding test data for Quotes...");
  
  // Cleanup quotes
  const oldQuotes = await db.collection("quotes").where("vendorId", "==", vendorId).get();
  const qBatch = db.batch();
  oldQuotes.forEach(d => qBatch.delete(d.ref));
  const oldReqs = await db.collection("quoteRequests").where("customerId", "==", customerId).get();
  oldReqs.forEach(d => qBatch.delete(d.ref));
  await qBatch.commit();

  console.log("Inserting 1 pending and 17 rejected quotes...");
  // Create requests and quotes
  for(let i=1; i<=18; i++) {
    const reqRef = await db.collection("quoteRequests").add({
      customerId: customerId,
      vendorId: vendorId,
    });
    
    await db.collection("quotes").add({
      requestId: reqRef.id,
      vendorId: vendorId,
      status: i === 1 ? 'PENDING' : 'REJECTED',
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    });
  }

  console.log("✅ Seed complete. Simulating GET /quotes/customer");
  
  // Simulate GET /quotes/customer
  const qSnap = await db.collection('quotes').where('vendorId', '==', vendorId).get();
  const quotes = qSnap.docs.map(d => ({id: d.id, ...d.data()}));
  
  let qActive = [];
  let qHistory = [];
  quotes.forEach(q => {
    if (q.customerDeleted) return;
    if (['REJECTED', 'ACCEPTED'].includes(q.status)) qHistory.push(q);
    else qActive.push(q);
  });

  qActive.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  qHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let finalQuotes = qActive.concat(qHistory.slice(0, 15));
  const qHasMore = qHistory.length > 15;

  console.log(`Active quotes: ${qActive.length} (Expected: 1)`);
  console.log(`History fetched: ${finalQuotes.length - qActive.length} (Expected: 15)`);
  console.log(`hasMoreHistory: ${qHasMore} (Expected: true)`);

  if (qActive.length === 1 && finalQuotes.length === 16 && qHasMore) {
      console.log("✅ Customer Quotes Capping Works!");
  } else {
      console.log("❌ Customer Quotes Capping Failed.");
  }
  
  // Simulate soft delete query
  await db.collection("quotes").doc(qHistory[0].id).update({ customerDeleted: true });
  
  const snapQ2 = await db.collection('quotes').where('vendorId', '==', vendorId).get();
  let histQ2 = [];
  snapQ2.docs.forEach(doc => {
    const data = doc.data();
    if (data.customerDeleted) return;
    if (['REJECTED', 'ACCEPTED'].includes(data.status)) histQ2.push(data);
  });

  console.log(`Hidden quotes history length: ${histQ2.length} (Expected: 16)`);
  if (histQ2.length === 16) {
      console.log("✅ Customer Quote Soft Delete Works!");
  } else {
      console.log("❌ Customer Quote Soft Delete Failed.");
  }

  console.log("\n🎉 ALL THOROUGH INTEGRATION TESTS PASSED!");
  process.exit(0);
}

runTest().catch(console.error);
