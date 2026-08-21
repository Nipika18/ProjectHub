import asyncio
from sqlalchemy.orm import Session
from backend.app.core.database import SessionLocal
from backend.app.models import Document
from backend.app.services.rag import rag_service
from backend.app.core.websockets import manager

async def process_document_background(document_id: int):
    """
    Safely process a single document in a background task, 
    with its own database session.
    """
    db = SessionLocal()
    try:
        # Check if it actually exists and is processing
        doc = db.query(Document).filter(Document.id == document_id, Document.status == "processing").first()
        if not doc:
            return

        try:
            print(f"[Worker] Starting ingestion for document {document_id}...")
            # We must pass the DB session. Notice request is removed.
            success = await rag_service.ingest_document(db, document_id)
            if success:
                doc.status = "ready"
                print(f"[Worker] Successfully ingested document {document_id}")
            else:
                doc.status = "failed"
                print(f"[Worker] Failed to ingest document {document_id}")
            
            db.commit()

            # Notify the user via WebSocket
            await manager.send_personal_message({
                "type": "document_processed",
                "document_id": document_id,
                "status": doc.status,
                "name": doc.name
            }, doc.uploaded_by)

        except Exception as e:
            db.rollback()
            doc.status = "failed"
            db.commit()
            print(f"[Worker] Exception processing document {document_id}: {str(e)}")
            # Notify the user via WebSocket on exception
            await manager.send_personal_message({
                "type": "document_processed",
                "document_id": document_id,
                "status": "failed",
                "name": doc.name,
                "error": str(e)
            }, doc.uploaded_by)
    finally:
        db.close()


async def start_document_worker():
    """
    Infinite background loop that polls the database for "processing" documents.
    This acts as a completely native queue without Redis.
    Limits concurrency using asyncio.Semaphore to prevent out-of-memory crashes.
    """
    print("[Worker] Starting native Postgres document worker...")
    semaphore = asyncio.Semaphore(2)  # Process max 2 documents simultaneously

    while True:
        try:
            db = SessionLocal()
            try:
                # Find documents stuck in 'processing' status
                # (e.g. from a fresh upload or a server crash recovery)
                processing_docs = db.query(Document).filter(
                    Document.status == "processing"
                ).limit(10).all()
                
                doc_ids = [doc.id for doc in processing_docs]
            finally:
                db.close()

            if doc_ids:
                # We found documents! Process them up to 2 at a time.
                async def bounded_process(doc_id):
                    async with semaphore:
                        await process_document_background(doc_id)
                
                tasks = [bounded_process(doc_id) for doc_id in doc_ids]
                # Wait for this batch to finish
                await asyncio.gather(*tasks)
            
        except Exception as e:
            print(f"[Worker] Loop error: {str(e)}")
        
        # Poll every 5 seconds if idle, or immediately if we just processed a batch
        await asyncio.sleep(5)
