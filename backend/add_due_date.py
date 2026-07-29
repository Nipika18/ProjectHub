import asyncio
import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.database import engine
from sqlalchemy import text

def main():
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE projects ADD COLUMN due_date TIMESTAMP;"))
            print("Successfully added due_date column to projects table.")
    except Exception as e:
        print(f"Error adding column (it might already exist): {e}")

if __name__ == "__main__":
    main()
