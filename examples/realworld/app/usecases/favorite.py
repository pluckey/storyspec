# @implements S-012
from app.domain.model import Article
from app.usecases import Deps
from app.usecases.read_article import read_article


def favorite(deps: Deps, user_id: int, slug: str) -> Article:
    article = read_article(deps, slug)
    deps.articles.favorite(user_id, article.id)
    return article


def unfavorite(deps: Deps, user_id: int, slug: str) -> Article:
    article = read_article(deps, slug)
    deps.articles.unfavorite(user_id, article.id)
    return article
