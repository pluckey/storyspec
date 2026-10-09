# @implements S-009
from app.usecases import Deps
from app.usecases.edit_article import own_article


def delete_article(deps: Deps, user_id: int, slug: str) -> None:
    deps.articles.delete(own_article(deps, user_id, slug).id)
