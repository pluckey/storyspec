# @implements S-010
from app.domain.model import Article, Page
from app.usecases import Deps


def list_articles(deps: Deps, page: Page, tag: str | None = None, author: str | None = None, favorited: str | None = None) -> tuple[list[Article], int]:
    """An author or favoriter who doesn't exist matches nothing."""
    author_ids = None
    if author is not None:
        user = deps.users.by_username(author)
        author_ids = [user.id] if user else []
    favorited_by = None
    if favorited is not None:
        user = deps.users.by_username(favorited)
        if not user:
            return [], 0
        favorited_by = user.id
    return deps.articles.list(page, tag=tag, author_ids=author_ids, favorited_by=favorited_by)
