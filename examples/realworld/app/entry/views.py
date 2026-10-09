"""Domain records → RealWorld's JSON, as seen by the viewer (following, favorited)."""
from datetime import datetime

from app.domain.model import Article, Comment, User
from app.usecases import Deps


def stamp(at: datetime) -> str:
    return at.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def user_view(deps: Deps, user: User) -> dict:
    return {"user": {"email": user.email, "token": deps.tokens.issue(user.id), "username": user.username, "bio": user.bio, "image": user.image}}


def profile(deps: Deps, user: User, viewer_id: int | None) -> dict:
    following = viewer_id is not None and deps.follows.follows(viewer_id, user.id)
    return {"username": user.username, "bio": user.bio, "image": user.image, "following": following}


def article(deps: Deps, a: Article, viewer_id: int | None, with_body: bool = True) -> dict:
    author = deps.users.by_id(a.author_id)
    view = {
        "slug": a.slug, "title": a.title, "description": a.description,
        "tagList": list(a.tags), "createdAt": stamp(a.created_at), "updatedAt": stamp(a.updated_at),
        "favorited": viewer_id is not None and deps.articles.favorited(viewer_id, a.id),
        "favoritesCount": deps.articles.favorites_count(a.id),
        "author": profile(deps, author, viewer_id),
    }
    if with_body:
        view["body"] = a.body
    return view


def articles(deps: Deps, found: list[Article], total: int, viewer_id: int | None) -> dict:
    # Lists leave out each article's body.
    return {"articles": [article(deps, a, viewer_id, with_body=False) for a in found], "articlesCount": total}


def comment(deps: Deps, c: Comment, viewer_id: int | None) -> dict:
    return {"id": c.id, "createdAt": stamp(c.created_at), "updatedAt": stamp(c.updated_at), "body": c.body,
            "author": profile(deps, deps.users.by_id(c.author_id), viewer_id)}
