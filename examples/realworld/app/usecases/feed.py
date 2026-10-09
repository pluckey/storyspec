# @implements S-011
from app.domain.model import Article, Page
from app.usecases import Deps


def feed(deps: Deps, user_id: int, page: Page) -> tuple[list[Article], int]:
    return deps.articles.list(page, author_ids=deps.follows.followees(user_id))
