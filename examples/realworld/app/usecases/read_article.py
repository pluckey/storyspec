# @implements S-007
from app.domain.errors import NotFound
from app.domain.model import Article
from app.usecases import Deps


def read_article(deps: Deps, slug: str) -> Article:
    article = deps.articles.by_slug(slug)
    if not article:
        raise NotFound("article")
    return article
