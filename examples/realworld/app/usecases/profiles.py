# @implements S-004
from app.domain.errors import NotFound
from app.domain.model import User
from app.usecases import Deps


def profile(deps: Deps, username: str) -> User:
    user = deps.users.by_username(username)
    if not user:
        raise NotFound("profile")
    return user
