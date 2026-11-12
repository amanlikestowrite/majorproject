# Nyaya Sahayak — Express Backend REST API Documentation

**Service:** Express Application Gateway  
**Base URL:** `http://127.0.0.1:3000` (or configured gateway host)  
**Authentication Modes:**
- **Guest Session:** Token via `x-guest-token` header, `Authorization: Bearer <token>`, or `nyaya_guest_token` HttpOnly cookie.
- **Authenticated User Session:** Token via `Authorization: Bearer <token>`, `x-auth-token` header, or `nyaya_auth_token` HttpOnly cookie.

---

## 1. Authentication Endpoints

### `POST /api/auth/google`
Authenticate using Google OAuth 2.0 / OpenID Connect ID token. Validates token cryptographically on the backend.

- **Rate Limit:** 30 requests / 15 minutes
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "idToken": "eyJhbGciOiJSUzI1NiIs..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "c1f7a0b2-...",
        "email": "advocate@example.com",
        "name": "Sneha Sen",
        "avatarUrl": "https://lh3.googleusercontent.com/...",
        "createdAt": "2026-11-12T14:00:00.000Z"
      },
      "session": {
        "id": "s8e91c-...",
        "token": "4a7b9c...",
        "expiresAt": "2026-11-19T14:00:00.000Z"
      }
    }
  }
  ```
- **Cookies Set:** `nyaya_auth_token` (`HttpOnly`, `SameSite=Lax`, `Max-Age=7d`).

---

### `POST /api/auth/logout`
Revoke the current authenticated user session in the database and clear the auth cookie.

- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "message": "Successfully logged out."
  }
  ```

---

### `GET /api/auth/me`
Retrieve profile of currently authenticated user.

- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "id": "c1f7a0b2-...",
      "email": "advocate@example.com",
      "name": "Sneha Sen",
      "avatarUrl": "https://lh3.googleusercontent.com/...",
      "createdAt": "2026-11-12T14:00:00.000Z",
      "updatedAt": "2026-11-12T14:00:00.000Z"
    }
  }
  ```

---

## 2. Guest Session Endpoints

### `POST /api/guest/session`
Initialize a secure, ephemeral guest session without login. Returns a raw 64-character token; only the SHA-256 hash is persisted.

- **Response (201 Created):**
  ```json
  {
    "status": "success",
    "data": {
      "sessionId": "g91a-...",
      "token": "8f3b...",
      "expiresAt": "2026-11-13T14:00:00.000Z",
      "createdAt": "2026-11-12T14:00:00.000Z"
    }
  }
  ```
- **Cookies Set:** `nyaya_guest_token` (`HttpOnly`, `SameSite=Lax`, `Max-Age=24h`).

---

### `GET /api/guest/session`
Validate the current guest session token.

- **Headers:** `x-guest-token: <rawToken>` or `Authorization: Bearer <rawToken>`
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "sessionId": "g91a-...",
      "expiresAt": "2026-11-13T14:00:00.000Z",
      "lastActivityAt": "2026-11-12T14:05:00.000Z",
      "active": true
    }
  }
  ```

---

## 3. Public Chat Endpoint

### `POST /api/chat`
Public conversational guidance endpoint. Connects `Frontend → Express → FastAPI → Express → Frontend`. Automatically persists user and assistant messages, citations, and operational metadata.

- **Rate Limit:** 100 requests / 15 minutes
- **Headers:**
  - `Content-Type: application/json`
  - Optional `Authorization: Bearer <userToken>` or `x-guest-token: <guestToken>`
- **Request Body:**
  ```json
  {
    "message": "Who is eligible for free legal aid under Section 12?",
    "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "language": "en",
    "topic": "Tele-Law",
    "top_k": 3
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "conversationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "messageId": "m1a2b3-...",
      "summary": "Under Section 12 of the Legal Services Authorities Act, 1987, free legal aid is guaranteed to marginalized citizens...",
      "steps": [
        "Visit your District Legal Services Authority (DLSA) office.",
        "Provide income or identity documentation.",
        "A panel advocate is assigned free of cost."
      ],
      "important": "Point-in-Time Statistic: This metric reflects official data as of 2026-11-08.",
      "portal": {
        "title": "National Legal Services Authority (NALSA)",
        "url": "https://nalsa.gov.in",
        "domain": "nalsa.gov.in"
      },
      "source": "Legal Services Authorities Act, 1987 — Ministry of Law & Justice",
      "followUps": [
        "What is the income ceiling for legal aid in my state?",
        "How do I apply for legal aid via the 15100 helpline?"
      ],
      "citations": [
        {
          "chunk_id": "DOJ_STAT_ACT_LSA_SEC12_ELIGIBILITY",
          "document": "Legal Services Authorities Act, 1987",
          "page_range": "Section 12",
          "source_url": "https://nalsa.gov.in/act",
          "fidelity_classification": "verbatim",
          "data_as_of": "1987-10-11"
        }
      ],
      "audit": {
        "information_type": "static",
        "publication_date": "1987-10-11",
        "derived_analysis": null,
        "audit_notes": null
      },
      "createdAt": "2026-11-12T14:10:00.000Z"
    }
  }
  ```

---

## 4. Conversation Endpoints

### `GET /api/conversations`
List all conversations belonging to the caller (User or Guest). Strict exclusive ownership filter applied.

- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "total": 3,
    "data": [
      {
        "id": "c1a2-...",
        "title": "Bail Inquiry under POCSO",
        "messageCount": 4,
        "lastMessage": {
          "id": "m4-...",
          "role": "assistant",
          "content": "Bail applications under Section 439...",
          "createdAt": "2026-11-12T14:15:00.000Z"
        },
        "createdAt": "2026-11-12T14:00:00.000Z",
        "updatedAt": "2026-11-12T14:15:00.000Z",
        "expiresAt": null
      }
    ]
  }
  ```

---

### `POST /api/conversations`
Create a new blank conversation thread.

- **Request Body:**
  ```json
  {
    "title": "eFiling 3.0 Registration Guide"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "status": "success",
    "data": {
      "id": "c8f2-...",
      "userId": "usr-123",
      "guestSessionId": null,
      "title": "eFiling 3.0 Registration Guide",
      "createdAt": "2026-11-12T14:20:00.000Z",
      "updatedAt": "2026-11-12T14:20:00.000Z"
    }
  }
  ```

---

### `GET /api/conversations/:id`
Retrieve full conversation history, messages, and citations. Enforces 403 Forbidden if not owned by caller.

- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "id": "c8f2-...",
      "title": "eFiling 3.0 Registration Guide",
      "createdAt": "2026-11-12T14:20:00.000Z",
      "updatedAt": "2026-11-12T14:22:00.000Z",
      "messages": [
        {
          "id": "msg-1",
          "role": "user",
          "content": "How do I register for eFiling 3.0?",
          "citations": [],
          "createdAt": "2026-11-12T14:20:05.000Z"
        },
        {
          "id": "msg-2",
          "role": "assistant",
          "content": "Advocates must register using verified mobile and Bar Council details...",
          "citations": [
            {
              "id": "cit-1",
              "chunkId": "DOJ_STAT_PROC_EFILING_REGISTRATION",
              "sourceDocument": "eFiling 3.0 User Manual",
              "sourceUrl": "https://efiling.ecourts.gov.in"
            }
          ],
          "createdAt": "2026-11-12T14:20:07.000Z"
        }
      ]
    }
  }
  ```

---

### `DELETE /api/conversations/:id`
Delete a conversation owned by the caller. Cascades to messages and citations.

- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "message": "Conversation deleted successfully."
  }
  ```

---

## 5. Health & Diagnostic Endpoints

### `GET /api/health` and `GET /health`
Comprehensive health check reporting database status and internal FastAPI status.

- **Response (200 OK):**
  ```json
  {
    "status": "operational",
    "service": "nyaya-sahayak-express-gateway",
    "version": "1.0.0",
    "database": "healthy",
    "aiService": "healthy",
    "timestamp": "2026-11-12T14:30:00.000Z"
  }
  ```
