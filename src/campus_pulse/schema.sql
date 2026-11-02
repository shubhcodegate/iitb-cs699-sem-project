CREATE TABLE IF NOT EXISTS users (
    id    INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name  TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    message_id TEXT NOT NULL,
    title      TEXT NOT NULL,
    start_time TEXT,
    end_time   TEXT,
    venue      TEXT,
    organizer  TEXT,
    category   TEXT,
    links      TEXT,
    recipients TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, message_id)
);