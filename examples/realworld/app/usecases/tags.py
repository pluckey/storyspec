# @implements S-014
from app.usecases import Deps


def tags(deps: Deps) -> list[str]:
    return deps.articles.tags()
