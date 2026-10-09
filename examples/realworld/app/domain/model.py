"""The domain's records. Timestamps are UTC datetimes; the HTTP layer formats them."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class User:
    id: int
    username: str
    email: str
    password_hash: str
    bio: str | None = None
    image: str | None = None


@dataclass(frozen=True)
class Article:
    id: int
    slug: str
    title: str
    description: str
    body: str
    author_id: int
    created_at: datetime
    updated_at: datetime
    tags: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Comment:
    id: int
    article_id: int
    author_id: int
    body: str
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class Page:
    """Which articles to list: newest first, `limit` of them after skipping `offset`."""
    limit: int = 20
    offset: int = 0
