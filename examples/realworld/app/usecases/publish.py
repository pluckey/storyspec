# @implements S-006
from app.domain.model import Article
from app.domain.rules import required, tag_list, unique_slug
from app.usecases import Deps


def publish(deps: Deps, author_id: int, fields: dict) -> Article:
    title = required("title", fields.get("title"))
    description = required("description", fields.get("description"))
    body = required("body", fields.get("body"))
    tags = tag_list(fields.get("tagList") or [])
    slug = unique_slug(title, lambda s: deps.articles.by_slug(s) is not None)
    return deps.articles.add(slug, title, description, body, author_id, tags, deps.clock.now())
