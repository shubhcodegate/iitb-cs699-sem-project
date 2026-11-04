"""Fetch emails from the IITB IMAP server."""
import email
import hashlib
import imaplib
import os
import re
import ssl
from email import policy
from email.utils import getaddresses
from email.utils import parsedate_to_datetime
from pathlib import Path
from datetime import timezone


from bs4 import BeautifulSoup
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO_ROOT / "private" / ".env")

BLOCK_TAGS = ["p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "table"]

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

def get_text_from_part(part: email.message.EmailMessage) -> list:
    """Walk the MIME tree and collect every text part that's part of the message."""
    ctype = part.get_content_type()
    
    if ctype == "message/rfc822":                       # forwarded email: look inside
        return get_text_from_part(part.get_content())
    
    if part.get_content_disposition() == "attachment":  # PDFs, images, etc.
        return []
    
    if ctype == "multipart/alternative":                # same content in 2 formats: pick one
        best = part.get_body(preferencelist=("html", "plain"))
        return get_text_from_part(best) if best is not None else []
    
    if part.is_multipart():                             # several real parts: collect all
        parts = []
        for sub in part.iter_parts():
            parts += get_text_from_part(sub)
        return parts
    
    if ctype in ("text/plain", "text/html"):
        return [part]
    return []

def html_to_text(html: str) -> str:
    """Convert HTML to text, with line breaks only after block elements."""
    soup = BeautifulSoup(html, "html.parser")
    
    for tag in soup.find_all(BLOCK_TAGS):
        tag.insert_after("\n")
    
    text = soup.get_text()
    text = re.sub(r"[ \t]+", " ", text)                 # collapse runs of spaces
    
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()    # collapse blank lines

def get_links(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    return [a["href"] for a in soup.find_all("a", href=True) if a["href"].startswith("http")]


def get_body(msg: email.message.EmailMessage) -> tuple[str, list[str]]:
    """Return all of the email's text, joined together."""

    texts = []
    links = []
    for part in get_text_from_part(msg):
        try:
            content = part.get_content()
        except Exception:
            payload = part.get_payload(decode=True) or b""
            try:
                content = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
            except LookupError:
                content = payload.decode("utf-8", errors="replace")
    
        if part.get_content_type() == "text/html":
            links.extend(get_links(content))   # needs the raw HTML
            content = html_to_text(content)
        
        texts.append(content.strip())
    return "\n\n".join(t for t in texts if t), links

def safe_date(value):
    try:
        d = parsedate_to_datetime(value) if value else None
    except (ValueError, TypeError):
        return None
    if d is not None and d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d

def parse_email(uid: int, raw_bytes: bytes, folder: str) -> dict:
    """Turn raw email bytes into a dictionary."""
    msg = email.message_from_bytes(raw_bytes, policy=policy.default)   # unfolds headers
    to_and_cc = msg.get_all("To", []) + msg.get_all("Cc", [])
    b, l = get_body(msg)
    return {
        "message_id":  email_key(msg),
        "imap_uid":    uid,
        "imap_folder": folder,
        "subject":     str(msg["Subject"] or ""),
        "date":        safe_date(msg["Date"]),
        "sender":      str(msg["From"] or ""),
        "recipients":  [addr.lower() for _, addr in getaddresses(to_and_cc) if addr],
        "body":        b,
        "links":       l,
    }


def fetch_new_emails(mail: imaplib.IMAP4_SSL, folder="INBOX", since_uid=0, limit=None):
    """Return (uidvalidity, emails) for emails with UID greater than since_uid."""
    mail.select(folder, readonly=True)                  # readonly: never change your mailbox
    _, data = mail.response("UIDVALIDITY")
    uidvalidity = int(data[0]) # UIDVALIDITY is a constant for a mailbox; 
                               # if it changes, all UIDs are invalidated

    _, data = mail.uid("search", None, f"UID {since_uid + 1}:*")
    uids = [int(u) for u in data[0].split()]
    uids = [u for u in uids if u > since_uid]           # IMAP quirk: "MaxUID:*" always returns the newest email
    uids.sort()

    if limit:
        uids = uids[:limit]                            # oldest N only

    emails = []
    for uid in uids:
        try:
            _, msg_data = mail.uid("fetch", str(uid), "(BODY.PEEK[])") # PEEK: don't mark as read
            emails.append(parse_email(uid, msg_data[0][1], folder))
        except Exception as e:
            print(f"fetch_new_emails: Error occurred while fetching UID {uid}: {e}")

    return uidvalidity, emails


if __name__ == "__main__":
    mail = connect()
    try:
        uidvalidity, emails = fetch_new_emails(mail, limit=10, since_uid=0)
    finally:
        mail.logout()                                   # always log out, even on errors

    print(f"UIDVALIDITY: {uidvalidity}")
    for e in emails:
        print(e["imap_uid"], "|", e["subject"][:70], "|", len(e["recipients"]), "recipients", e["links"])
