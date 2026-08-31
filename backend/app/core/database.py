from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from backend.app.core.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Setup the SQLAlchemy Database Engine
# NullPool ensures connections are fully closed after each request,
# allowing serverless databases (like Neon) to scale to zero when idle.
# Note: pool_pre_ping is not used with NullPool (no pool to ping).
engine = create_engine(
    db_url,
    poolclass=NullPool
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    FastAPI dependency to yield a database session and close it afterwards.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initializes the database:
    1. Creates pgvector extension if not exists.
    2. Creates all tables declared in models.
    3. Runs safe migrations for any new columns.
    4. Creates HNSW index for pgvector similarity searches.
    
    Uses a single connection to avoid multiple cold starts on serverless databases.
    """
    # Create extension first since models may use the VECTOR column type
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    
    # Import models here to register them with Base metadata
    from backend.app import models
    Base.metadata.create_all(bind=engine)

    # Run all safe migrations and index creation in a single connection
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE user_stories ADD COLUMN IF NOT EXISTS is_on_hold BOOLEAN DEFAULT FALSE;"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;"))
        except Exception:
            pass
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS document_chunks_hnsw_idx "
            "ON document_chunks USING hnsw (embedding vector_cosine_ops);"
        ))
        conn.commit()
