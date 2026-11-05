"""Tests for campus_pulse.fetch. Run with: python -m unittest discover tests

This unit test file was generated with AI help.
"""
import sys
import unittest
from datetime import timedelta, timezone
from pathlib import Path
import io
from contextlib import redirect_stdout

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from campus_pulse.fetch import fetch_new_emails, html_to_text, parse_email  # noqa: E402


def make_email(headers: dict, body: str, content_type="text/plain") -> bytes:
    """Build a raw single-part email."""
    lines = [f"{k}: {v}" for k, v in headers.items()]
    lines.append(f"Content-Type: {content_type}")
    return ("\r\n".join(lines) + "\r\n\r\n" + body).encode()


BASE = {"From": "a@iitb.ac.in", "Subject": "hi", "Date": "Mon, 3 Nov 2026 10:00:00 +0530"}


class TestLinks(unittest.TestCase):
    def test_links_extracted_from_html(self):
        raw = make_email(BASE, '<p>See <a href="https://iitb.ac.in/x">here</a></p>', "text/html")
        e = parse_email(1, raw, "INBOX")
        self.assertEqual(e["links"], ["https://iitb.ac.in/x"])
        self.assertEqual(e["body"], "See here")

    def test_non_http_links_dropped(self):
        html = '<a href="mailto:x@y.z">m</a><a href="/rel">r</a><a href="http://ok.in">ok</a>'
        e = parse_email(1, make_email(BASE, html, "text/html"), "INBOX")
        self.assertEqual(e["links"], ["http://ok.in"])

    def test_plain_text_has_no_links(self):
        e = parse_email(1, make_email(BASE, "visit https://iitb.ac.in"), "INBOX")
        self.assertEqual(e["links"], [])


class TestBody(unittest.TestCase):
    def test_unknown_charset_does_not_crash(self):
        raw = make_email(BASE, "hello", "text/plain; charset=x-bogus")
        self.assertEqual(parse_email(1, raw, "INBOX")["body"], "hello")

    def test_multipart_alternative_picks_html_only(self):
        raw = (
            "From: a@iitb.ac.in\r\nSubject: alt\r\nMIME-Version: 1.0\r\n"
            'Content-Type: multipart/alternative; boundary="B"\r\n\r\n'
            "--B\r\nContent-Type: text/plain\r\n\r\nPLAIN VERSION\r\n"
            "--B\r\nContent-Type: text/html\r\n\r\n<p>HTML VERSION</p>\r\n"
            "--B--\r\n"
        ).encode()
        self.assertEqual(parse_email(1, raw, "INBOX")["body"], "HTML VERSION")

    def test_attachment_skipped(self):
        raw = (
            "From: a@iitb.ac.in\r\nSubject: att\r\nMIME-Version: 1.0\r\n"
            'Content-Type: multipart/mixed; boundary="B"\r\n\r\n'
            "--B\r\nContent-Type: text/plain\r\n\r\nmain text\r\n"
            "--B\r\nContent-Type: text/plain\r\n"
            'Content-Disposition: attachment; filename="notes.txt"\r\n\r\nSECRET\r\n'
            "--B--\r\n"
        ).encode()
        self.assertEqual(parse_email(1, raw, "INBOX")["body"], "main text")

    def test_html_to_text_line_breaks(self):
        self.assertEqual(html_to_text("<p>one</p><p>two   <b>bold</b></p>"), "one\ntwo bold")


class TestHeaders(unittest.TestCase):
    def test_empty_recipients_filtered(self):
        raw = make_email({**BASE, "To": "X@Y.Z, undisclosed-recipients:;", "Cc": "c@d.e"}, "x")
        self.assertEqual(parse_email(1, raw, "INBOX")["recipients"], ["x@y.z", "c@d.e"])

    def test_date_keeps_timezone(self):
        d = parse_email(1, make_email(BASE, "x"), "INBOX")["date"]
        self.assertEqual(d.utcoffset(), timedelta(hours=5, minutes=30))

    def test_date_without_timezone_becomes_utc(self):
        raw = make_email({**BASE, "Date": "Mon, 3 Nov 2026 10:00:00 -0000"}, "x")
        self.assertEqual(parse_email(1, raw, "INBOX")["date"].tzinfo, timezone.utc)

    def test_bad_or_missing_date_is_none(self):
        self.assertIsNone(parse_email(1, make_email({**BASE, "Date": "garbage"}, "x"), "INBOX")["date"])
        no_date = {k: v for k, v in BASE.items() if k != "Date"}
        self.assertIsNone(parse_email(1, make_email(no_date, "x"), "INBOX")["date"])

    def test_message_id_used_when_present(self):
        raw = make_email({**BASE, "Message-ID": " <abc@iitb.ac.in> "}, "x")
        self.assertEqual(parse_email(1, raw, "INBOX")["message_id"], "<abc@iitb.ac.in>")

    def test_hash_fallback_is_stable(self):
        a = parse_email(1, make_email(BASE, "x"), "INBOX")["message_id"]
        b = parse_email(2, make_email(BASE, "different body"), "INBOX")["message_id"]
        self.assertTrue(a.startswith("sha256:"))
        self.assertEqual(a, b)          # same From/Date/Subject -> same key


class FakeIMAP:
    """Minimal stand-in for imaplib.IMAP4_SSL."""

    def __init__(self, messages: dict, uidvalidity=42):
        self.messages = messages        # uid -> raw bytes
        self.uidvalidity = uidvalidity
        self.fetched = []

    def select(self, folder, readonly=False):
        assert readonly, "fetch must open the mailbox read-only"
        return "OK", [str(len(self.messages)).encode()]

    def response(self, code):
        return code, [str(self.uidvalidity).encode()]

    def uid(self, command, *args):
        if command == "search":
            start = int(args[1].split()[1].split(":")[0])
            # Real IMAP quirk: "N:*" with N > max UID still returns the max UID.
            hits = [u for u in self.messages if u >= start] or [max(self.messages)]
            return "OK", [" ".join(map(str, hits)).encode()]
        if command == "fetch":
            uid, spec = int(args[0]), args[1]
            assert "PEEK" in spec, "fetch must not mark emails as read"
            self.fetched.append(uid)
            return "OK", [(b"header", self.messages[uid]), b")"]
        raise AssertionError(command)


class TestFetchNewEmails(unittest.TestCase):
    def setUp(self):
        self.mail = FakeIMAP({u: make_email({**BASE, "Subject": f"s{u}"}, "x") for u in (3, 5, 9)})

    def test_returns_all_in_uid_order(self):
        uv, emails = fetch_new_emails(self.mail)
        self.assertEqual(uv, 42)
        self.assertEqual([e["imap_uid"] for e in emails], [3, 5, 9])
        self.assertEqual(emails[0]["subject"], "s3")

    def test_since_uid(self):
        _, emails = fetch_new_emails(self.mail, since_uid=5)
        self.assertEqual([e["imap_uid"] for e in emails], [9])

    def test_no_new_mail_despite_imap_quirk(self):
        _, emails = fetch_new_emails(self.mail, since_uid=9)
        self.assertEqual(emails, [])

    def test_limit_takes_oldest(self):
        _, emails = fetch_new_emails(self.mail, limit=2)
        self.assertEqual([e["imap_uid"] for e in emails], [3, 5])

    def test_bad_message_skipped(self):
        self.mail.messages[5] = None    # parse_email will raise on this
        out = io.StringIO()
        with redirect_stdout(out):
            _, emails = fetch_new_emails(self.mail)
        self.assertEqual([e["imap_uid"] for e in emails], [3, 9])
        self.assertIn("UID 5", out.getvalue())


if __name__ == "__main__":
    unittest.main()
