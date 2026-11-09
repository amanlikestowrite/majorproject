# Nyaya Sahayak — API Specification & Service Contract

This document specifies the internal HTTP API contract between the **Express Application Gateway** (Port 3000) and the **Python AI Service** (Port 8000).

---

## 1. Endpoints Overview

| Method | Endpoint | Purpose | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service status, model readiness, vector DB health | Internal / Diagnostics |
| `POST` | `/api/v1/retrieve` | Semantic & hybrid chunk retrieval with metadata filters | Internal / Evaluation |
| `POST` | `/api/v1/chat` | End-to-end RAG answer generation with citations | Express Gateway only |

---

## 2. API Contract: `POST /api/v1/chat`

### Request Headers
```http
Content-Type: application/json
Accept: application/json
```

### Request Body
```json
{
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "message": "What matters cannot be live-streamed in court proceedings?",
  "language": "en",
  "topic": "Live-streaming rules",
  "top_k": 3
}
```

#### Request Schema Attributes:
- `userId` *(string, optional)*: Active conversation UUID from PostgreSQL `User.id`.
- `message` *(string, mandatory)*: User's query text.
- `language` *(string, optional, default: `"en"`)*: Target ISO language code (`"en"`, `"hi"`).
- `topic` *(string, optional)*: Optional domain constraint across the 8 DoJ topics.
- `top_k` *(integer, optional, default: 3)*: Number of supporting context chunks.

---

### Response Body (200 OK)
```json
{
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "summary": "Live streaming of court proceedings is governed by the Model Rules for Live Streaming and Recording of Court Proceedings. Under Rule 5.1, live streaming is permissible for all proceedings subject to 11 statutory categories of absolute exclusion.",
  "steps": [
    "Matrimonial disputes, child custody, and POCSO matters are strictly excluded under Rule 5.1(i)-(ii).",
    "Under Rule 8.3(ii), live streaming is subjected to a statutory delay buffer of ten minutes.",
    "Under Rule 9.2, unauthorized recording, sharing, or broadcasting is strictly prohibited and punishable under the Copyright Act, 1957, IT Act, 2000, and Contempt of Court laws."
  ],
  "important": "Authorisation for live streaming does not grant litigants or viewers any right to copy, edit, or broadcast footage on social media.",
  "portal": {
    "title": "eCourts Live Streaming Portal",
    "url": "https://ecourts.gov.in/livestream",
    "domain": "ecourts.gov.in"
  },
  "source": "Model Rules for Live Streaming and Recording of Court Proceedings (e-Committee, Supreme Court of India)",
  "followUps": [
    "What matters are excluded from live streaming under Rule 5.1?",
    "What are the penalties for unauthorized recording under Rule 9.2?"
  ],
  "citations": [
    {
      "chunk_id": "DOJ_STAT_RULE_LIVESTREAM_R005",
      "document": "Model Rules for Live Streaming and Recording of Court Proceedings",
      "page_range": "5-7",
      "source_url": "https://cdnbbsr.s3waas.gov.in/s388ef51f0bf911e452e8dbb1d807a81ab/uploads/2021/06/2022091599.pdf",
      "fidelity_classification": "verbatim",
      "data_as_of": "2021-06-01"
    }
  ],
  "audit": {
    "information_type": "static",
    "publication_date": "2021-06-01",
    "derived_analysis": null,
    "audit_notes": null
  }
}
```

---

## 3. API Contract: `POST /api/v1/retrieve`

### Request Body
```json
{
  "query": "Supreme Court judge vacancy sanctioned strength",
  "top_k": 3,
  "topic": "Supreme Court and High Court appointments and vacancies",
  "information_type": "dynamic",
  "min_score": 0.40
}
```

### Response Body (200 OK)
```json
{
  "total": 3,
  "query": "Supreme Court judge vacancy sanctioned strength",
  "results": [
    {
      "chunk_id": "DOJ_DYN_STAT_VACANCY_SC_HC_20260801",
      "score": 0.892,
      "source_document": "doj_vacancy_statement_august_2026.pdf",
      "page_number": "1",
      "topic": "Supreme Court and High Court appointments and vacancies",
      "information_type": "dynamic",
      "publication_date": "2026-08-01",
      "data_as_of": "2026-08-01",
      "fidelity_classification": "derived_with_audit_note",
      "source_content": "Sanctioned Strength: 34, Working Strength: 33, Vacancies: 1...",
      "derived_analysis": "Calculated total permanent HC vacancies reconciled to 163...",
      "audit_notes": "Printed circular omitted Sikkim permanent vacancy row in total sum..."
    }
  ]
}
```

---

## 4. API Contract: `GET /api/v1/health`

### Response Body (200 OK)
```json
{
  "status": "healthy",
  "service": "nyaya-sahayak-ai-service",
  "version": "1.0.0",
  "vector_store": {
    "engine": "qdrant",
    "mode": "embedded",
    "collection": "doj_knowledge_base",
    "total_indexed_chunks": 229,
    "status": "ready"
  },
  "embedding_model": {
    "name": "BAAI/bge-m3",
    "device": "cpu",
    "dimension": 1024,
    "status": "loaded"
  }
}
```

---

## 5. Gateway Integration Recipe (Express Node.js)

To connect the Express gateway route [`src/routes/userInput.route.js`](file:///Users/hrudhay_gubba/major/src/routes/userInput.route.js):

```javascript
// Example Express Forwarding Snippet
const response = await fetch("http://127.0.0.1:8000/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        userId: user.id,
        message: content.trim()
    })
});
const aiData = await response.json();

// Save AI message to PostgreSQL
await prisma.message.create({
    data: {
        userId: user.id,
        role: "ai",
        content: aiData.summary
    }
});

// Return complete response to frontend
return res.status(200).json({
    userId: user.id,
    response: aiData
});
```

