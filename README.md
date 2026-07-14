# ProjectHub — Multi-Tenant RAG & Agile Project Intelligence Platform

ProjectHub is a multi-tenant project intelligence web application built with **FastAPI (Python)**, **PostgreSQL/pgvector**, and a responsive vanilla **HTML/CSS/JavaScript** single-page application.

It integrates two core capabilities:
1. **AI Document Chatbot (RAG)** with hybrid search (pgvector HNSW Cosine + tsvector Full-Text Keyword via Reciprocal Rank Fusion) and streaming Server-Sent Events (SSE) with citations.
2. **Jira-Style Agile Task Management** featuring AI User Story generation from documents, interactive Kanban boards with optimistic UI rendering, and role-based automated task distribution.

---

## 🛠 Cloud Infrastructure & Technologies Used

- **Backend Framework**: `FastAPI` (Python 3.10+) with Pydantic validation and asynchronous route controllers.
- **Database ORM**: Synchronous `SQLAlchemy 2.0` (`psycopg2` driver with connection pooling).
- **Database & Vector Engine (PostgreSQL / Neon Cloud)**:
  - Stores relational data tables (`users`, `projects`, `milestones`, `documents`, `project_members`, `user_stories`, `tasks`, `activity_logs`).
  - Utilizes `pgvector` (`Vector(1536)`) with high-speed **HNSW Cosine Distance** indexing (`document_chunks_hnsw_idx`) for semantic similarity search.
  - Utilizes native PostgreSQL Full-Text Keyword Search (`tsvector`) combined via Reciprocal Rank Fusion ($k=60$).
- **Cloud Object Storage (Supabase Storage)**:
  - Uploaded physical document files (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.html`, `.txt`) are stored in a private cloud bucket named **`documents`** organized by project folder (`proj_{project_id}/{hash[:16]}_{filename}`).
  - Automatically falls back to local filesystem storage (`settings.UPLOAD_DIR`) if Supabase credentials are not configured in `.env`.
- **AI & LLM Services (OpenAI API / OpenRouter)**:
  - `text-embedding-3-small` (1536 dimensions) for document chunk embeddings.
  - `gpt-4o-mini` (or configured model) for streaming RAG chat responses, contextual query reformulation, intent classification, and AI Agile User Story generation.
- **Document Parsers**:
  - `pdfplumber` (PDF text and tabular matrix extraction).
  - `python-docx` (Word processing).
  - `pandas` / `openpyxl` (Excel & CSV spreadsheets).
  - `BeautifulSoup4` (HTML files).
  - `tiktoken` (`cl100k_base`) for sentence-aware token chunking up to 400 tokens per chunk.

---

## 👥 Role-Based Access Control (RBAC): Admin vs. Non-Admin

ProjectHub separates workspace administrative governance from team collaboration.

| Feature / Action | Workspace Admin (`is_admin = True`) | Team Member / Non-Admin (`is_admin = False`) |
| :--- | :---: | :---: |
| **Create / Delete Projects** | ✅ Allowed | ❌ Forbidden |
| **Create / Delete Milestones** | ✅ Allowed | ❌ Forbidden |
| **Upload / Delete Documents** | ✅ Allowed | ❌ Forbidden |
| **Chat with AI Chatbot (RAG)** | ✅ Allowed | ✅ Allowed |
| **Generate AI User Stories** | ✅ Allowed | ✅ Allowed |
| **Move Ticket Status** (`To Do` $\rightarrow$ `In Progress` $\rightarrow$ `Complete`) | ✅ Allowed | ✅ Allowed |
| **Update Ticket Assignee / Reporter** | ✅ Allowed | ❌ Read-Only |
| **Update Ticket Priority & Story Points** | ✅ Allowed | ❌ Read-Only |
| **Update Ticket Due Date** | ✅ Allowed | ❌ Read-Only |
| **Manage Team Member Roles** (`Frontend`, `Backend`, `AI`, `Manager`) | ✅ Allowed | ❌ Read-Only |
| **Trigger Auto-Assignment Engine** | ✅ Allowed | ❌ Forbidden |
| **View Activity Logs** | ✅ Allowed | ✅ Allowed |

### Team Roles & Automatic Task Distribution
Team members within a project hold one of four technical roles (`project_members.role`):
- **`Frontend`**: Assigned UI/UX subtasks.
- **`Backend`**: Assigned API, database, and server-side subtasks.
- **`AI`**: Assigned RAG, vector, and prompt subtasks.
- **`Manager`**: Serves as the default assignee for parent User Stories.

When an Admin updates a team member's role, the backend automatically unassigns tickets from their previous role and runs auto-assignment (`POST /api/projects/{id}/team/auto-assign`) to redistribute matching tasks.

---

## ✨ Key Implemented Capabilities

### 1. Hybrid RAG Engine (`backend/app/services/rag.py`)
- **Sentence-Aware Chunking**: Uses `tiktoken` to group complete sentences up to 400 tokens with a 3-sentence overlap.
- **Table Extraction**: Employs `pdfplumber` to extract structured matrices into pipe-delimited (` | `) table blocks under `[TABLE DATA]`.
- **Hybrid Search (RRF)**: Combines HNSW Cosine Distance (`pgvector`) and Full-Text Keyword Search (`tsvector`) via Reciprocal Rank Fusion ($k=60$).
- **Contextual Query Reformulation**: Rewrites pronouns and conversational references using session history before searching.

### 2. Document Ingestion & Deduplication (`backend/app/services/storage.py`)
- **SHA-256 Fingerprinting**: Calculates a digital content hash (`file_hash[:16]`) before storage. Duplicate uploads are bypassed to prevent redundant storage.
- **Upload Abort Controller**: Active HTTP uploads can be cancelled instantly via `AbortController`, triggering server-side cleanup.

### 3. Agile Kanban & User Story Board (`frontend/js/app.js`)
- **AI User Story Generator**: Generates User Stories (`user_stories`) and nested Subtasks (`tasks`) from uploaded specification files.
- **Optimistic Drag-and-Drop**: Moving Kanban cards or changing status dropdowns updates the DOM instantly (`0ms latency`) while updating the backend asynchronously, rolling back if an error occurs.
- **Default Assignee**: Parent User Stories default to the project `Manager` (`sirat`) or display `Unassigned`.

---

## 🗄️ Database Schema (`backend/app/models.py`)

The PostgreSQL database maintains 8 tables:
1. `users`: Authentication & profile (`id`, `email`, `hashed_password`, `full_name`, `is_admin`, `created_at`).
2. `projects`: Workspace container (`id`, `name`, `description`, `owner_id`, `created_at`).
3. `milestones`: Target deadlines (`id`, `title`, `description`, `due_date`, `status`, `project_id`, `created_at`).
4. `documents`: Uploaded file metadata (`id`, `name`, `file_path`, `file_type`, `file_size`, `category`, `project_id`, `milestone_id`, `uploaded_by`, `created_at`).
5. `document_chunks`: RAG vector chunks (`id`, `document_id`, `content`, `chunk_index`, `document_name`, `embedding` (`Vector(1536)`), `metadata_json`).
6. `project_members`: Workspace team members (`id`, `project_id`, `user_id`, `role`, `created_at`).
7. `user_stories`: Agile stories (`id`, `project_id`, `document_id`, `title`, `description`, `acceptance_criteria`, `priority`, `story_points`, `status`, `is_on_hold`, `comments`, `due_date`, `created_at`).
8. `tasks`: Technical subtasks (`id`, `story_id`, `title`, `task_type`, `status`, `assigned_to`, `due_date`, `created_at`).

*(Note: Chat logs are session-only in browser RAM and are never persisted to the database).*

---

## 🚀 Setup & Installation Guide

### Step 1: Install PostgreSQL & pgvector
Ensure PostgreSQL 16+ is installed and enable the `vector` extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 2: Configure Environment (`.env`)
Copy `.env.example` to `.env` and configure:
```bash
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Run the Server
```bash
uvicorn backend.app.main:app --reload
```
Open your browser at **`http://localhost:8000`**.
