# Nyaya Sahayak (न्याय सहायक)
### Citizen Judicial Guidance & eCourts Service Discovery Platform
**Department of Justice, Ministry of Law & Justice, Government of India**

[![Production Status](https://img.shields.io/badge/Status-Live%20on%20Vercel-success?style=flat-square)](https://justice-ai-gamma.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-blue?style=flat-square&logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-black?style=flat-square&logo=express)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Supabase)-336791?style=flat-square&logo=postgresql)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 🏛️ Project Overview

**Nyaya Sahayak** is an official citizen-centric, AI-powered interactive virtual assistant designed for the Department of Justice (Ministry of Law & Justice, Govt. of India). It bridges the information divide in the Indian judicial ecosystem by helping citizens, litigants, students, and advocates understand complex judicial procedures, access court services, verify case statuses, and connect with statutory legal aid initiatives.

### Live Production Deployment
- **Official Live Web Application:** [https://justice-ai-gamma.vercel.app](https://justice-ai-gamma.vercel.app)
- **API Health Check:** [https://justice-ai-gamma.vercel.app/api/health](https://justice-ai-gamma.vercel.app/api/health)

---

## 🌟 What We Are Providing

### 1. Grounded Legal Guidance & RAG Synthesis
- **Authoritative Procedural Walkthroughs:** Step-by-step sequential guidance on filing police complaints, First Information Reports (FIRs), POCSO cases (Protection of Children from Sexual Offences Act, 2012), domestic violence reports, bail procedures, consumer disputes, RTI filings, and virtual traffic challan resolution.
- **Statutory Safeguards & Caveats:** Highlighted legal protections, mandatory reporting mandates (e.g., Section 19 of POCSO Act), child/victim identity non-disclosure laws (Section 23 of POCSO Act), and 24/7 national helpline directories (**Childline 1098**, **National Emergency 112**, **Women Helpline 181**, **Cyber Crime 1930**).
- **Official Statutory Citations:** Every answer references verified sections of Indian Acts, Gazette publications, and direct links to official government portals.
- **Canonical Portal Discovery Cards:** Direct clickable links to:
  - **eCourts Services** (`services.ecourts.gov.in`) — Case status, CNR search, court cause lists.
  - **eFiling 3.0** (`efiling.ecourts.gov.in`) — Electronic petition filing and court fee payments.
  - **Virtual Courts** (`vcourts.gov.in`) — Online traffic challan disposal and compounding.
  - **National Judicial Data Grid (NJDG)** (`njdg.ecourts.gov.in`) — Judicial pendency statistics.
  - **Tele-Law (DISHA Scheme)** (`tele-law.in`) — Pre-litigation free legal advice via CSCs.
  - **NALSA & DLSA** (`nalsa.gov.in`) — Free legal aid under Section 12 of the Legal Services Authorities Act, 1987.

### 2. Dual-Engine Resilient AI Architecture
- **Cloud-Native Direct Gemini 2.5 Flash Engine:** High-speed, structured legal response synthesis running directly in Express / Vercel Serverless without requiring a local Python runtime.
- **Python FastAPI Local RAG Microservice:** High-dimensional dense semantic search using `BAAI/bge-m3` (1024-dimension embeddings) and Qdrant vector database for departmental document retrieval.
- **Offline Resilient Knowledge Cache:** Client-side statutory fallback database with fuzzy token matching and typo tolerance (e.g., automatically matching `posco` → `pocso`).

### 3. Citizen Authentication & Persistent Identity
- **Google OAuth 2.0 (GIS):** 1-click official citizen login using verified Google identity credentials.
- **Email & Password Authentication:** Secure registration and login using cryptographic password hashing (SHA-256 + salt).
- **Seamless Account Linking:** Google OAuth accounts can link a custom password at any time without creating duplicate profiles.
- **Zero-Flicker Session Persistence:** Instant synchronous local storage hydration paired with server-side validation (`GET /api/auth/me`).
- **24-Hour Ephemeral Citizen Guest Mode:** Full access for citizens who prefer privacy without creating an account.

### 4. Conversation Threads & Audit Trail
- **Persistent Conversation History:** Sidebar drawer listing prior inquiries with instant resumption.
- **Message & Citation Audit Logging:** Complete statutory traceability linking assistant answers to specific citations stored in PostgreSQL.

### 5. Accessibility & Multilingual Inclusivity
- **Bilingual Interface:** Supports English and Hindi (हिंदी).
- **Voice-to-Text Dictation:** Built-in Web Speech Recognition API for spoken citizen queries.
- **Text-to-Speech (Audio Read-Aloud):** SpeechSynthesis API for accessible auditory playback of procedural steps.
- **Government Compliance:** Aligned with GIGW 3.0 (Guidelines for Indian Government Websites) and WCAG 2.1 AA accessibility guidelines.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend UI** | HTML5, Modern CSS3 (Variables, Grid, Flexbox, Glassmorphism), Vanilla JavaScript (ES6+ modular architecture), Web Speech API |
| **Backend Gateway** | Node.js (v18+), Express.js, Serverless Functions (Vercel) |
| **Database & ORM** | PostgreSQL (Supabase with PgBouncer connection pooling), Prisma ORM 7 (`@prisma/client`) |
| **AI & Synthesis** | Google Gemini 2.5 Flash (`generativelanguage.googleapis.com`), Python 3.11 + FastAPI (Microservice), Qdrant Vector Store, `BAAI/bge-m3` |
| **Security & Auth** | Google Identity Services (OAuth 2.0), HttpOnly Secure Cookies, Express Rate Limiting, Request ID tracing |
| **Testing** | Node.js Native Test Runner (`node:test`, `node:assert/strict`) — 31 automated integration tests |
| **Deployment** | Vercel Serverless Edge, GitHub CI/CD, Docker/Render ready |

---

## 📂 Repository Structure

```
justice-ai/
├── api/
│   └── index.js                   # Vercel serverless entrypoint for Express
├── assets/
│   ├── brand/                     # National emblem, DoJ logos, SVG icons
│   └── illustrations/             # High-res SVG courthouse artwork
├── css/
│   ├── base.css                   # CSS design tokens, typography, reset
│   ├── components.css             # Navigation, cards, modal, chat bubbles, buttons
│   └── layout.css                 # Responsive grid and media queries
├── js/
│   ├── api.js                     # Centralized API fetch client
│   ├── auth.js                    # Citizen authentication & session management
│   ├── chatbot.js                 # Offline statutory knowledge base (English + Hindi)
│   ├── conversations.js           # Conversation sidebar & history manager
│   ├── interactions.js            # Accessibility, mobile menu, toast notifications
│   └── main.js                    # Chat UI controller, speech recognition & synthesis
├── prisma/
│   └── schema.prisma              # Database schema (User, Sessions, Messages, Citations)
├── src/
│   ├── app.js                     # Express application setup & middleware stack
│   ├── config/env.js              # Environment variable parsing and validation
│   ├── controllers/               # Auth, Chat, Conversation, Health controllers
│   ├── middleware/                # Rate limiters, validators, error handlers
│   ├── routes/                    # Express route definitions (/api/*)
│   ├── services/                  # Gemini AI service, Google OAuth, Session service
│   └── utils/                     # Cryptographic helpers, structured logger
├── ai-service/                    # (Optional) Python FastAPI RAG microservice
│   ├── app/                       # FastAPI routes, retriever, vector store, generator
│   └── requirements.txt           # Python dependencies
├── tests/                         # Node.js automated test suites (Auth, Chat, DB)
├── index.html                     # Main citizen portal single-page application
├── server.js                      # Local Node.js development server
├── vercel.json                    # Vercel serverless routing configuration
└── README.md                      # Comprehensive project documentation
```

---

## 🚀 How to Use & Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL Database**: Local PostgreSQL or cloud instance (e.g., Supabase / Neon)
- **Google Gemini API Key**: Obtainable from [Google AI Studio](https://aistudio.google.com/)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/amanlikestowrite/majorproject.git justice-ai
cd justice-ai
```

---

### Step 2: Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000

# PostgreSQL Connection (Supabase / Neon / Local)
DATABASE_URL="postgres://username:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://username:password@host:5432/postgres"

# AI Service Configuration
AI_SERVICE_URL=http://127.0.0.1:8000
GEMINI_API_KEY=your_gemini_api_key_here

# Authentication
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
GUEST_SESSION_TTL_HOURS=24
AUTH_SESSION_TTL_DAYS=7
```

---

### Step 3: Install Dependencies & Setup Database

```bash
# Install Node dependencies
npm install

# Generate Prisma Client & push schema to database
npx prisma generate
npx prisma db push
```

---

### Step 4: Run the Application Locally

```bash
# Start the Express server
npm run dev

# Or with standard node
node server.js
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

### Step 5: (Optional) Run the Python AI Microservice

If you wish to use the local Python RAG pipeline with Qdrant vector store instead of direct Gemini serverless synthesis:

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 🧪 Running Automated Tests

The repository includes a comprehensive integration test suite covering authentication, session validation, chat gateway handling, database operations, and rate limiting:

```bash
npm test
```

**Test Coverage Summary:**
- `tests/auth.test.js`: Google OAuth, email registration, password login, token revocation.
- `tests/guest.test.js`: Ephemeral guest tokens, cookie validation, expiration checks.
- `tests/chat.test.js`: Chat schema validation, message storage, statutory citation recording, 503 fallback.
- `tests/conversation.test.js`: Conversation ownership enforcement, unauthorized access prevention (403), deletion.

---

## ☁️ Deployment (Vercel)

The application is architected to deploy seamlessly to **Vercel**:

1. Link project with Vercel CLI:
   ```bash
   vercel link
   ```
2. Configure environment variables in Vercel:
   ```bash
   vercel env add DATABASE_URL production
   vercel env add DIRECT_URL production
   vercel env add GEMINI_API_KEY production
   vercel env add GOOGLE_CLIENT_ID production
   vercel env add NODE_ENV production
   ```
3. Deploy to production:
   ```bash
   vercel --prod
   ```

---

## 📖 Citizen User Guide

1. **Ask Any Legal Inquiry:**
   - Type in natural English or Hindi in the prompt box (e.g., *"How to file a case against POCSO?"*, *"पोक्सो में एफआईआर कैसे दर्ज करें?"*, *"How can I check my case status with CNR number?"*).
   - Alternatively, click the **microphone icon** to speak your question aloud.
2. **Review Verified Guidance:**
   - View step-by-step procedural directions.
   - Read crucial statutory caveats and emergency helpline numbers.
   - Click the **Portal Cards** to navigate directly to official government portals.
   - Click **Verify on Official Portal** to inspect primary source sections.
3. **Listen to Responses:**
   - Click the **Listen** button on any assistant card to hear the guidance read aloud in English or Hindi.
4. **Sign In or Continue as Guest:**
   - Click **Sign In with Google** or register with email to keep a persistent record of all inquiries across devices.
   - Or click **Guest Mode** for immediate private access.

---

## ⚖️ Legal Disclaimer

> **Official Department of Justice Notice:**
> *Nyaya Sahayak is an informational guidance assistant built for educational, procedural awareness, and judicial service discovery. It does not constitute formal legal representation, judicial adjudication, or formal legal advice. For formal filings, certified orders, or legal representation, citizens should consult a licensed advocate or contact their nearest District Legal Services Authority (DLSA / NALSA).*

---

## 👥 Contributors & Acknowledgments
- **Ministry of Law & Justice, Government of India**
- **eCommittee, Supreme Court of India**
- **National Informatics Centre (NIC)**
- **National Legal Services Authority (NALSA)**
