# @implements S-008
from dataclasses import replace

from app.domain.errors import Forbidden, Invalid
from app.domain.model import Article
from app.domain.rules import later, required, tag_list
from app.usecases import Deps
from app.usecases.read_article import read_article


def own_article(deps: Deps, user_id: int, slug: str) -> Article:
    article = read_article(deps, slug)
    if article.author_id != user_id:
        raise Forbidden("article")
    return article


def edit_article(deps: Deps, user_id: int, slug: str, changes: dict) -> Article:
    """Only the fields present change. The slug stays, so links to the article keep working."""
    article = own_article(deps, user_id, slug)
    updates: dict = {}
    for field in ("title", "description", "body"):
        if field in changes:
            updates[field] = required(field, changes[field])
    if "tagList" in changes:
        if changes["tagList"] is None:
            raise Invalid("tagList", "can't be null; send [] to remove every tag")
        updates["tags"] = tag_list(changes["tagList"])
    return deps.articles.save(replace(article, **updates, updated_at=later(deps.clock.now(), article.updated_at)))
