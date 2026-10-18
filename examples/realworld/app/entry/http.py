"""The RealWorld HTTP API (FastAPI). Routes parse requests, call a use case and render its view."""
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from app.domain.errors import AppError, Invalid, Unauthorized
from app.domain.model import Page
from app.entry import views
from app.entry.composition import deps_from_env
from app.usecases import Deps
from app.usecases.comments import add_comment, comments, delete_comment
from app.usecases.delete_article import delete_article
from app.usecases.edit_article import edit_article
from app.usecases.favorite import favorite, unfavorite
from app.usecases.feed import feed
from app.usecases.follow import follow, unfollow
from app.usecases.list_articles import list_articles
from app.usecases.profiles import profile
from app.usecases.publish import publish
from app.usecases.read_article import read_article
from app.usecases.register import register
from app.usecases.settings import current_user, update_settings
from app.usecases.sign_in import sign_in
from app.usecases.tags import tags


def create_app(deps: Deps | None = None) -> FastAPI:
    deps = deps or deps_from_env()
    app = FastAPI(title="RealWorld (storyspec example)")

    @app.exception_handler(AppError)
    def app_error(_: Request, e: AppError):
        return JSONResponse({"errors": {e.field: [e.message]}}, status_code=e.status)

    @app.exception_handler(RequestValidationError)
    def bad_request(_: Request, e: RequestValidationError):
        return JSONResponse({"errors": {"body": ["is invalid"]}}, status_code=422)

    def token(request: Request) -> str | None:
        header = request.headers.get("authorization", "")
        scheme, _, value = header.partition(" ")
        return value.strip() if scheme.lower() in ("token", "bearer") and value.strip() else None

    def viewer(request: Request) -> int | None:
        """The signed-in user, if any. A token that doesn't read is rejected even where signing in is optional."""
        raw = token(request)
        if raw is None:
            return None
        user_id = deps.tokens.read(raw)
        if user_id is None or deps.users.by_id(user_id) is None:
            raise Unauthorized("token", "is invalid")
        return user_id

    def signed_in(request: Request) -> int:
        user_id = viewer(request)
        if user_id is None:
            raise Unauthorized("token", "is missing")
        return user_id

    async def payload(request: Request, key: str) -> dict:
        try:
            data = await request.json()
        except ValueError:
            data = None
        inner = data.get(key) if isinstance(data, dict) else None
        if not isinstance(inner, dict):
            raise Invalid(key, "is missing")
        return inner

    def page(limit: int = 20, offset: int = 0) -> Page:
        return Page(limit=max(0, min(limit, 100)), offset=max(0, offset))

    # Accounts
    @app.post("/api/users", status_code=201)
    async def post_users(request: Request):
        u = await payload(request, "user")
        return views.user_view(deps, register(deps, u.get("username"), u.get("email"), u.get("password")))

    @app.post("/api/users/login")
    async def post_login(request: Request):
        u = await payload(request, "user")
        return views.user_view(deps, sign_in(deps, u.get("email"), u.get("password")))

    @app.get("/api/user")
    def get_user(user_id: int = Depends(signed_in)):
        return views.user_view(deps, current_user(deps, user_id))

    @app.put("/api/user")
    async def put_user(request: Request, user_id: int = Depends(signed_in)):
        return views.user_view(deps, update_settings(deps, user_id, await payload(request, "user")))

    # Profiles
    @app.get("/api/profiles/{username}")
    def get_profile(username: str, viewer_id: int | None = Depends(viewer)):
        return {"profile": views.profile(deps, profile(deps, username), viewer_id)}

    @app.post("/api/profiles/{username}/follow")
    def post_follow(username: str, user_id: int = Depends(signed_in)):
        return {"profile": views.profile(deps, follow(deps, user_id, username), user_id)}

    @app.delete("/api/profiles/{username}/follow")
    def delete_follow(username: str, user_id: int = Depends(signed_in)):
        return {"profile": views.profile(deps, unfollow(deps, user_id, username), user_id)}

    # Articles
    @app.get("/api/articles")
    def get_articles(tag: str | None = None, author: str | None = None, favorited: str | None = None,
                     p: Page = Depends(page), viewer_id: int | None = Depends(viewer)):
        found, total = list_articles(deps, p, tag=tag, author=author, favorited=favorited)
        return views.articles(deps, found, total, viewer_id)

    @app.get("/api/articles/feed")
    def get_feed(p: Page = Depends(page), user_id: int = Depends(signed_in)):
        found, total = feed(deps, user_id, p)
        return views.articles(deps, found, total, user_id)

    @app.post("/api/articles", status_code=201)
    async def post_article(request: Request, user_id: int = Depends(signed_in)):
        return {"article": views.article(deps, publish(deps, user_id, await payload(request, "article")), user_id)}

    @app.get("/api/articles/{slug}")
    def get_article(slug: str, viewer_id: int | None = Depends(viewer)):
        return {"article": views.article(deps, read_article(deps, slug), viewer_id)}

    @app.put("/api/articles/{slug}")
    async def put_article(slug: str, request: Request, user_id: int = Depends(signed_in)):
        return {"article": views.article(deps, edit_article(deps, user_id, slug, await payload(request, "article")), user_id)}

    @app.delete("/api/articles/{slug}", status_code=204)
    def remove_article(slug: str, user_id: int = Depends(signed_in)):
        delete_article(deps, user_id, slug)
        return Response(status_code=204)

    @app.post("/api/articles/{slug}/favorite")
    def post_favorite(slug: str, user_id: int = Depends(signed_in)):
        return {"article": views.article(deps, favorite(deps, user_id, slug), user_id)}

    @app.delete("/api/articles/{slug}/favorite")
    def delete_favorite(slug: str, user_id: int = Depends(signed_in)):
        return {"article": views.article(deps, unfavorite(deps, user_id, slug), user_id)}

    # Comments
    @app.post("/api/articles/{slug}/comments", status_code=201)
    async def post_comment(slug: str, request: Request, user_id: int = Depends(signed_in)):
        body = (await payload(request, "comment")).get("body")
        return {"comment": views.comment(deps, add_comment(deps, user_id, slug, body), user_id)}

    @app.get("/api/articles/{slug}/comments")
    def get_comments(slug: str, viewer_id: int | None = Depends(viewer)):
        return {"comments": [views.comment(deps, c, viewer_id) for c in comments(deps, slug)]}

    @app.delete("/api/articles/{slug}/comments/{comment_id}", status_code=204)
    def remove_comment(slug: str, comment_id: int, user_id: int = Depends(signed_in)):
        delete_comment(deps, user_id, slug, comment_id)
        return Response(status_code=204)

    # Tags
    @app.get("/api/tags")
    def get_tags():
        return {"tags": tags(deps)}

    return app
