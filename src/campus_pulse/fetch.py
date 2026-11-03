"""Fetch emails from the IITB IMAP server."""
import email
import hashlib
import imaplib
import os
import ssl
from email import policy
from email.utils import getaddresses
from email.utils import parsedate_to_datetime
from pathlib import Path


from bs4 import BeautifulSoup
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO_ROOT / "private" / ".env")


def connect():
    """Log in to the IITB IMAP server and return the connection."""
    context = ssl.create_default_context()
    context.set_ciphers("DEFAULT")      # IITB's server needs older ciphers
    mail = imaplib.IMAP4_SSL(os.environ["IITB_IMAP_SERVER"], 993, ssl_context=context)
    mail.login(os.environ["IITB_EMAIL"], os.environ["IITB_IMAP_ACCESS_TOKEN"])
    return mail


def email_key(msg: email.message.EmailMessage) -> str:
    """Unique ID for an email: Message-ID, or a hash if it's missing."""
    if msg["Message-ID"]:
        return str(msg["Message-ID"]).strip()
    raw = f'{msg["From"]}|{msg["Date"]}|{msg["Subject"]}'
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()


def get_body(msg: email.message.EmailMessage) -> str:
    """Return the email's text, converting HTML to plain text if needed."""
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return ""
    try:
        content = part.get_content()
    except Exception:
        content = ""
    if part.get_content_type() == "text/html":
        content = BeautifulSoup(content, "html.parser").get_text(separator="\n")
    return content.strip()


def parse_email(uid: int, raw_bytes: bytes, folder: str) -> dict:
    """Turn raw email bytes into a dictionary."""
    msg = email.message_from_bytes(raw_bytes, policy=policy.default)   # unfolds headers
    to_and_cc = msg.get_all("To", []) + msg.get_all("Cc", [])
    return {
        "message_id":  email_key(msg),
        "imap_uid":    uid,
        "imap_folder": folder,
        "subject":     str(msg["Subject"] or ""),
        "date":        parsedate_to_datetime(msg["Date"]) if msg["Date"] else None,
        "sender":      str(msg["From"] or ""),
        "recipients":  [addr.lower() for _, addr in getaddresses(to_and_cc)],
        "body":        get_body(msg),
    }


def fetch_new_emails(mail: imaplib.IMAP4_SSL, folder="INBOX", since_uid=0, limit=None):
    """Return (uidvalidity, emails) for emails with UID greater than since_uid."""
    mail.select(folder, readonly=True)                  # readonly: never change your mailbox
    _, data = mail.response("UIDVALIDITY")
    uidvalidity = int(data[0])

    _, data = mail.uid("search", None, f"UID {since_uid + 1}:*")
    uids = [int(u) for u in data[0].split()]
    uids = [u for u in uids if u > since_uid]           # IMAP quirk: "MaxUID:*" always returns the newest email
    if limit:
        uids = uids[-limit:]                            # newest N only

    emails = []
    for uid in uids:
        _, msg_data = mail.uid("fetch", str(uid), "(BODY.PEEK[])")   # PEEK: don't mark as read
        emails.append(parse_email(uid, msg_data[0][1], folder))
    return uidvalidity, emails


if __name__ == "__main__":
    mail = connect()
    try:
        uidvalidity, emails = fetch_new_emails(mail, limit=10)
    finally:
        mail.logout()                                   # always log out, even on errors

    print(f"UIDVALIDITY: {uidvalidity}")
    for e in emails:
        print(e["imap_uid"], "|", e["subject"][:70], "|", len(e["recipients"]), "recipients")
