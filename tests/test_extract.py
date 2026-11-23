"""Tests for campus_pulse.extract."""
"""Tests for campus_pulse.extract. Run with: python -m unittest discover tests

This unit test file was generated with AI help.
"""

import json
import sqlite3
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from campus_pulse.extract import (  
    create_database,
    extract_event,
    parse_json,
    save_events,
)


class TestParseJson(unittest.TestCase):
    def test_extracts_supported_fields_and_normalizes_category(self):
        event = parse_json(
            'Result: {"title": "Talk", "venue": "Room 1", "extra": "ignored", '
            '"category": "unknown"}'
        )

        assert event is not None
        self.assertEqual(event["title"], "Talk")
        self.assertEqual(event["venue"], "Room 1")
        self.assertIsNone(event["category"])
        self.assertNotIn("extra", event)

    def test_non_object_or_invalid_json_is_rejected(self):
        self.assertIsNone(parse_json("No event details"))
        self.assertIsNone(parse_json('["not", "an", "event"]'))


class TestExtractEvent(unittest.TestCase):
    @patch("campus_pulse.extract.ChatGroq")
    def test_sends_only_the_first_5000_body_characters_to_model(self, chat_groq):
        model = chat_groq.return_value
        model.invoke.return_value.content = json.dumps(
            {"title": "Talk", "category": "Public"}
        )
        mail_data = {
            "subject": "Talk",
            "sender": "organizer@iitb.ac.in",
            "date": "2026-11-22",
            "body": "x" * 5001,
        }

        event = extract_event(mail_data)

        assert event is not None
        self.assertEqual(event["title"], "Talk")
        prompt = model.invoke.call_args.args[0][1].content
        self.assertEqual(prompt.count("x"), 5000)
        chat_groq.assert_called_once_with(model="openai/gpt-oss-20b", temperature=0)


class TestSaveEvents(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.execute("PRAGMA foreign_keys = ON")
        create_database(self.conn)
        self.conn.execute("INSERT INTO users (email) VALUES (?)", ("student@iitb.ac.in",))
        self.user_id = self.conn.execute(
            "SELECT id FROM users WHERE email = ?", ("student@iitb.ac.in",)
        ).fetchone()[0]
        self.email = {
            "message_id": "<event@iitb.ac.in>",
            "imap_uid": 12,
            "imap_folder": "INBOX",
            "subject": "Talk",
            "links": ["https://iitb.ac.in/event"],
            "recipients": ["student@iitb.ac.in"],
        }

    def tearDown(self):
        self.conn.close()

    def test_empty_email_list_does_not_create_model(self):
        self.assertEqual(save_events(self.conn, self.user_id, []), 0)

    @patch(
        "campus_pulse.extract.extract_event",
        return_value={
            "title": "Research talk",
            "start_time": None,
            "end_time": None,
            "venue": None,
            "organizer": None,
            "category": "Public",
        },
    )
    def test_saves_event_and_ignores_duplicate_message(self, _extract_event):
        self.assertEqual(save_events(self.conn, self.user_id, [self.email]), 1)
        self.assertEqual(save_events(self.conn, self.user_id, [self.email]), 0)
        self.assertEqual(_extract_event.call_count, 2)
        self.assertEqual(
            self.conn.execute("SELECT COUNT(*) FROM events").fetchone()[0], 1
        )
        row = self.conn.execute("SELECT links, recipients FROM events").fetchone()
        self.assertEqual(json.loads(row[0]), self.email["links"])
        self.assertEqual(json.loads(row[1]), self.email["recipients"])


if __name__ == "__main__":
    unittest.main()
