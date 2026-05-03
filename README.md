<div align="center">
  <img src="./frontend/public/landing/hero_illustration.jfif" alt="Prinvox Banner" width="100%" style="border-radius: 12px;" />
  <br/>
  <h1>Prinvox</h1>
  <p><b>A Real-Time, Multi-Vendor 3D Printing Marketplace & Order Management System</b></p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs)](https://nodejs.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql)](https://www.postgresql.org/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-Real%20Time-010101?logo=socketdotio)](https://socket.io/)
</div>

---

## 📖 Overview

Prinvox is a full-stack, event-driven marketplace bridging the gap between consumers requiring custom 3D prints and specialized manufacturing vendors. The platform handles the entire lifecycle of a custom manufacturing request: from **in-browser 3D model visualization**, to **bidding and quoting**, **real-time order tracking**, and **financial settlement & dispute resolution**.

Built with a focus on real-time state synchronization, robust financial ledgers, and Role-Based Access Control (RBAC), Prinvox demonstrates scalable architectural patterns suitable for complex, multi-sided platforms.

---

## ✨ System Architecture & Key Technical Achievements

### 1. Event-Driven Real-Time Synchronization (Socket.IO)
Implemented a custom WebSocket layer to eliminate manual polling. Actions taken by one entity (e.g., a Vendor updating manufacturing status, or an Admin resolving a dispute) instantly propagate to all connected clients.
*   **Targeted Broadcasting:** Users join specific Socket rooms based on their UUID and Role, ensuring notifications (bids, status changes, refunds) are securely routed only to the authorized participants.
*   **Global State Sync:** The UI dynamically re-fetches and updates badge counts without full page reloads, ensuring a reactive user experience.

### 2. Multi-Sided Financial Ledger & Split Payments
Engineered a comprehensive financial tracking system to manage payouts, commissions, and escrow.
*   **Escrow System:** Customer payments are held in an `ESCROWED` state until the order is marked `DELIVERED`.
*   **Automated Settlements:** An automated background cron job (Payout Scheduler) processes settlements 12-24 hours after order completion.
*   **Complex Refund Math (80/12/8):** When a dispute is resolved in favor of a customer after manufacturing began, the system enforces a strict mathematical split: 80% to Customer, 12% vendor compensation, and 8% platform fee, updating the ledger transactionally to prevent floating-point or `NaN` anomalies.

### 3. Role-Based Access Control (RBAC) & Hardened Workflows
The platform isolates routing, APIs, and data access between three distinct roles: `CUSTOMER`, `VENDOR`, and `ADMIN`.
*   **Strict Linear Progression:** Vendor dashboards programmatically prevent non-linear status updates (e.g., an order cannot move from `IN_PROCESS` backward to `NOT_STARTED`), enforcing strict data integrity.
*   **Bifurcated Order Workflows:** Custom quote-based orders go through 5 manufacturing stages, whereas ready-made marketplace orders bypass manufacturing to a streamlined 3-stage delivery flow.

### 4. Client-Side 3D Rendering
Integrated **Three.js** to parse and render `.stl` and `.obj` files directly in the browser, extracting bounding box dimensions to automatically filter vendors based on their machine volume capabilities before a quote request is even sent.

---

## 🛠 Tech Stack

**Frontend (Client)**
*   **Framework:** Next.js 14 (App Router)
*   **Styling:** TailwindCSS, Vanilla CSS, Glassmorphism UI
*   **State & Real-Time:** React Context API, Socket.IO Client
*   **3D Rendering:** Three.js
*   **Deployment:** Netlify (Configured for static caching and edge routing)

**Backend (Server)**
*   **Runtime:** Node.js, Express.js
*   **Database:** PostgreSQL
*   **ORM:** Prisma (Type-safe database queries)
*   **Real-time:** Socket.IO
*   **Storage:** Supabase / Firebase Storage (Blob storage for 3D files and evidence photos)
*   **Auth:** JSON Web Tokens (JWT) & bcrypt

---

## 🚀 Running Locally

### Prerequisites
*   Node.js v18+
*   PostgreSQL database (Local or Cloud like Supabase/Neon)

### 1. Database & Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the backend:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/prinvox"
JWT_SECRET="your_secure_secret"
PORT=5000
```
Run migrations and start the server:
```bash
npx prisma migrate dev --name init
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```
Create a `.env.local` file in the frontend:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```
Start the frontend:
```bash
npm run dev
```

The application will be running at `http://localhost:3000`.

---

## 📈 Future Roadmap
*   Integration with Razorpay/Stripe webhooks for live payment capturing.
*   WebRTC integration for live video inspection of printed parts.
*   Automated slice-time estimation using a server-side slicer engine.

---
*Designed & Developed for complex, real-time B2B/B2C interactions.*
