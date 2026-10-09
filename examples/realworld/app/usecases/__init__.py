"""One module per story; each says which story it implements. They take their ports in `Deps`."""
from dataclasses import dataclass

from app.ports import ArticleStore, Clock, CommentStore, FollowStore, Passwords, Tokens, UserStore


@dataclass(frozen=True)
class Deps:
    users: UserStore
    follows: FollowStore
    articles: ArticleStore
    comments: CommentStore
    clock: Clock
    passwords: Passwords
    tokens: Tokens
