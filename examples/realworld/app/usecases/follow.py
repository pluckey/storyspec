# @implements S-005
from app.domain.model import User
from app.usecases import Deps
from app.usecases.profiles import profile


def follow(deps: Deps, follower_id: int, username: str) -> User:
    author = profile(deps, username)
    deps.follows.follow(follower_id, author.id)
    return author


def unfollow(deps: Deps, follower_id: int, username: str) -> User:
    author = profile(deps, username)
    deps.follows.unfollow(follower_id, author.id)
    return author
