"""Pure rules shared by the use cases."""
import re
import unicodedata
from datetime import datetime, timedelta

from app.domain.errors import Invalid, blank

MIN_PASSWORD = 8  # NIST 800-63B: at least 8 characters, at least 64 accepted, no composition rules
MAX_PASSWORD = 128


def required(field: str, value: object) -> str:
    """A field that must be a non-blank string."""
    if not isinstance(value, str) or not value.strip():
        raise blank(field)
    return value


def password(value: object) -> str:
    text = required("password", value)
    if len(text) < MIN_PASSWORD:
        raise Invalid("password", f"is too short (minimum is {MIN_PASSWORD} characters)")
    if len(text) > MAX_PASSWORD:
        raise Invalid("password", f"is too long (maximum is {MAX_PASSWORD} characters)")
    return text


def optional_text(value: str | None) -> str | None:
    """Bio and image: an empty string means none."""
    return value or None


def slugify(title: str) -> str:
    ascii_title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_title.lower()).strip("-")
    return slug or "article"


def unique_slug(title: str, taken) -> str:
    """The title's slug, or the slug with -2, -3, … when an article already has it. `taken(slug)` says which exist."""
    base = slugify(title)
    slug, n = base, 1
    while taken(slug):
        n += 1
        slug = f"{base}-{n}"
    return slug


def tag_list(value: object) -> tuple[str, ...]:
    """Tags in the order given, blanks and repeats dropped."""
    if not isinstance(value, list) or not all(isinstance(t, str) for t in value):
        raise Invalid("tagList", "must be a list of strings")
    seen: list[str] = []
    for tag in (t.strip() for t in value):
        if tag and tag not in seen:
            seen.append(tag)
    return tuple(seen)


def later(now: datetime, previous: datetime) -> datetime:
    """An update's time: now, but at least a millisecond after the previous one (times are shown to the millisecond),
    so two quick writes still differ."""
    step = timedelta(milliseconds=1)
    return now if now - previous >= step else previous + step
