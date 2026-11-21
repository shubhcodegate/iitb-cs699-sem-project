import sqlite3
from pathlib import Path

# Build paths relative to this file, so they work from any folder
HERE = Path(__file__).resolve().parent          # .../src/campus_pulse
DB_PATH = HERE.parent.parent / "data" / "campus_pulse.db"
SCHEMA_PATH = HERE / "schema.sql"


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row      # rows behave like dicts: row["title"]
    conn.execute("PRAGMA foreign_keys = ON")   # make SQLite enforce REFERENCES
    return conn


def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA_PATH.read_text())
    print(f"Database ready at {DB_PATH}")


if __name__ == "__main__":
    init_db()