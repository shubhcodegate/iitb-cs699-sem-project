# BUG: `get_body()` gives only one part

`part = msg.get_body(preferencelist=("plain", "html"))`

The IITB IMAP email response is multipart MIME format. So it need parsing.

```python
import email
from email import policy
from campus_pulse.fetch import connect

from email.iterators import _structure
"""
To get multipart structure of the email, we need to use the private _structure function from the email.iterators module.
'_structure(msg: email.message.EmailMessage)':
multipart/mixed
    text/plain              ← part 1: usually a short note or a header added by the mailing list
    multipart/alternative   ← part 2: the actual announcement
        text/plain
        text/html
    image/jpeg              ← part 3: probably the event poster
    text/plain              ← part 4: usually the mailing-list footer
"""

mail = connect()
mail.select("INBOX", readonly=True)
_, d = mail.uid("fetch", "1601", "(BODY.PEEK[])")    # ← put the problem UID here
msg = email.message_from_bytes(d[0][1], policy=policy.default)
_structure(msg)
mail.logout()
"""
Prints:
multipart/mixed
    text/plain
    multipart/alternative
        text/plain
        text/html
    image/jpeg
    text/plain
"""
```
