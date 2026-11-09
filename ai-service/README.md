# Nyaya Sahayak — AI & Knowledge Retrieval Service

Dedicated Python FastAPI service providing vector retrieval, hybrid dense/sparse search, and authoritative response generation for the Department of Justice (DoJ) virtual assistant.

---

## 1. Directory Structure

```
ai-service/
├── app/
│   ├── main.py                  # FastAPI application entry point
│   ├── config.py                # Environment settings & configuration
│   ├── models/                  # Pydantic request & response schemas
│   ├── services/                # Embedder, Vector Store, Retriever, Generator
│   └── api/v1/                  # REST API endpoints (health, retrieve, chat)
├── data/
│   └── knowledge_base/          # 229 verified chunks, metadata indices
├── docs/
│   ├── INTEGRATION_ASSESSMENT.md # Architectural integration assessment
│   ├── API_SPECIFICATION.md     # Express ↔ FastAPI service contract
│   └── CHUNKING_SPECIFICATION.md# Phase 2 chunking audit & report
├── scripts/
│   ├── build_vector_index.py    # Offline embedding generation & indexing
│   └── evaluate_retrieval.py    # Benchmark retrieval evaluation
├── tests/                       # Unit and integration test suite
├── .env.example
├── .gitignore
└── requirements.txt
```

---

## 2. Setup & Installation

### Prerequisites
- Python 3.9+ (or 3.10+)

### Create Virtual Environment
```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Configuration
```bash
cp .env.example .env
```

---

## 3. Knowledge Base & Vector Indexing

The knowledge base in `data/knowledge_base/` contains:
- **229 verified RAG chunks** across all 17 official PDFs and 16 JSON datasets.
- Clean separation between verbatim source text (`source_content`), mathematical derivations (`derived_analysis`), and audit explanations (`audit_notes`).
- Tripartite temporal attribution (`publication_date`, `data_as_of`, `collection_timestamp`).

To populate the local vector store:
```bash
python scripts/build_vector_index.py
```

---

## 4. Running the Service

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

---

## 5. Testing

```bash
pytest tests/
```

