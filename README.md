# Jamstream

A production-ready, full-stack real-time collaborative music streaming platform. Jamstream allows users to create decentralized listening rooms, search YouTube tracks dynamically, queue media collectively, and enjoy frame-accurate synchronized audio playback across multiple cross-network devices (desktop, mobile, tablet) simultaneously.

---

## 🚀 Architecture Overview

Jamstream utilizes a decoupled client-server architecture designed to handle low-latency events over persistent state pipelines:


```

[ Mobile / Desktop Clients ]
│  ▲
▼  │  (Real-Time Engine: WebSockets / Polling Upgrade)
┌────────────────────────────────────────────────────────┐
│                   NODE.JS BACKEND                      │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │   Socket.io Hub      │    │  Express REST API    │  │
│  │  (Room Sync Loop)    │    │ (yt-search Interface)│  │
│  └──────────────────────┘    └──────────────────────┘  │
└────────────────────────────┬───────────────────────────┘
▼
[ YouTube IFrame API ]

```

### 🛠️ Tech Stack
*   **Frontend:** React, Tailwind CSS, Lucide Icons, Vite
*   **Media Middleware:** YouTube Player IFrame API API Reference 
*   **Backend:** Node.js, Express, Socket.io
*   **Scraping Core:** `yt-search` (Dynamic metadata parsing)

---

## ✨ Key Features

*   **Dynamic Room Sync System:** Instant multi-room isolation. Users entering the same room parameter link share a centralized, real-time audio canvas.
*   **Network Independent Interoperability:** Client runtime dynamically parses network boundaries (`localhost`, internal LAN Wi-Fi IPs, or cloud endpoints) ensuring plug-and-play local network or internet functionality.
*   **Interactive Timeline Scrubbing:** High-accuracy seek events mirrored instantly to all listening peers inside the room.
*   **Automated Garbage Collection (GC):** Server automatically tears down high-frequency intervals and releases system memory resources as soon as rooms become empty.
*   **Circular Reference Immunity:** Node-level timer protocols are completely isolated from serialization pipes, eliminating `socket.io-parser` call stack overflows.

---

## 📦 Project Directory Tree

```text
jam-stream/
├── backend/
│   ├── package-lock.json
│   ├── package.json
│   └── server.js          # Unified Socket engine & API search routes
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Sync Player Core Component
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   └── tailwind.config.js
└── README.md

```

---

## 🛠️ Installation & Local Setup

### 1. Pre-requisites

Ensure you have **Node.js (v18+)** installed.

### 2. Backend Initialization

```bash
cd backend
npm install
npm start

```

*Server will initialize on port `4000`.*

### 3. Frontend Initialization

```bash
cd ../frontend
npm install
npm run dev -- --host

```

*Using `--host` exposes the client application directly to your local Wi-Fi network for mobile cross-testing.*

---

## 🌐 Production Deployment Guide (Render)

This application is engineered to deploy seamlessly to cloud architectures utilizing dynamic port binding configurations.

### 1. Backend Web Service

* **Service Type:** Web Service
* **Build Command:** `npm install`
* **Start Command:** `node server.js`

### 2. Frontend Static Site

* **Service Type:** Static Site
* **Build Command:** `npm run build`
* **Publish Directory:** `dist`
* **Environment Variables:**
* Set `VITE_API_URL` to your production Render Backend Web Service link (e.g., `https://your-backend.onrender.com`).



### 3. Client Routing Rewrite Rule (Crucial)

To handle declarative browser route lookups cleanly on the edge CDN, navigate to your Render Frontend Static Site dashboard under **Redirects/Rewrites**, and add the following rule:

* **Source:** `/*`
* **Destination:** `/index.html`
* **Action:** `Rewrite`

---

## 📱 Mobile Autoplay & Security Protocol Notes

Due to strict **Web Audio API Autoplay Policies** on modern mobile web browsers (iOS Safari/Android Chrome), background network streams are blocked until high-trust direct interaction occurs.

* **Activation:** Upon joining a room via mobile, tap any execution control button (such as the primary **Play / Pause** toggle HUD bar) once manually. This interacts with the underlying AudioContext, allowing subsequent networked track-sync changes to play completely uninterrupted.
