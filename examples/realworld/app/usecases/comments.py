# @implements S-013
from app.domain.errors import Forbidden, NotFound
from app.domain.model import Comment
from app.domain.rules import required
from app.usecases import Deps
from app.usecases.read_article import read_article


def add_comment(deps: Deps, author_id: int, slug: str, body: object) -> Comment:
    article = read_article(deps, slug)
    return deps.comments.add(article.id, author_id, required("body", body), deps.clock.now())


def comments(deps: Deps, slug: str) -> list[Comment]:
    return deps.comments.for_article(read_article(deps, slug).id)


def delete_comment(deps: Deps, user_id: int, slug: str, comment_id: int) -> None:
    article = read_article(deps, slug)
    comment = deps.comments.by_id(comment_id)
    if not comment or comment.article_id != article.id:
        raise NotFound("comment")
    if comment.author_id != user_id:
        raise Forbidden("comment")
    deps.comments.delete(comment.id)
