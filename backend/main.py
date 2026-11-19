import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from pydantic import BaseModel

project_root = Path(__file__).resolve().parents[1]
load_dotenv(project_root / "private" / ".env")
database_url = os.environ["DATABASE_URL"]

app = FastAPI(title="Campus Pulse API")

class UserProfile(BaseModel):
    google_sub: str
    display_name: str

@app.get("/health")
def health_check():
    return {"status": "OK"}

@app.get("/health/db")
def database_health():
    try:
        with psycopg.connect(database_url, sslmode="require", connect_timeout=5) as db:
            db.execute("SELECT 1").fetchone()
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database connection failed")

    return {"database": "connected"}

def save_user(google_sub: str, display_name: str): 
    with psycopg.connect(database_url, sslmode="require", connect_timeout=5) as db: 
        row = db.execute(
            """
            INSERT INTO private.app_users (google_sub, display_name)
            VALUES (%s, %s)
            ON CONFLICT (google_sub) DO UPDATE
            SET display_name = EXCLUDED.display_name
            RETURNING google_sub, display_name
            """,
            (google_sub, display_name),
        ).fetchone()

    return {"google_sub": row[0], "display_name": row[1]}


@app.post("/api/users")
def save_profile(profile: UserProfile):
    return save_user(profile.google_sub, profile.display_name)
