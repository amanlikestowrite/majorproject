# Nyaya Sahayak — Knowledge Base Data

This directory houses the authoritative, pre-processed Department of Justice (DoJ) knowledge base assets used for vector embedding and retrieval-augmented generation (RAG).

---

## Directory Contents

- **`knowledge_base/rag_chunks.jsonl`**: 229 verified and schema-validated chunks (224,450 `cl100k_base` BPE tokens) across all 17 official PDFs and 16 JSON datasets. Each line is an independent JSON object with 20 schema fields.
- **`knowledge_base/rag_chunks.json`**: Master JSON representation containing metadata and the full array of 229 chunks.
- **`knowledge_base/sample_chunks.json`**: Representative golden benchmark chunks across the 8 core DoJ domains used for evaluation and unit testing.
- **`knowledge_base/master_metadata_index.json`**: Complete provenance and audit metadata index for all 17 PDFs and 16 structured datasets.
- **`knowledge_base/content_classification.json`**: Domain classification taxonomy and topic routing map.

---

## Data Integrity Guarantees

1. **Source Fidelity**: Primary statutory text and rules are preserved verbatim without editorial distortion.
2. **Segregated Derivations**: Mathematical reconciliations and audit explanations are strictly quarantined in `derived_analysis` and `audit_notes`.
3. **Temporal Tracking**: Each chunk contains `publication_date`, `data_as_of`, and `collection_timestamp` to prevent temporal hallucination.
