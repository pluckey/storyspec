# @implements S-003
from dataclasses import replace

from app.domain.errors import NotFound, Taken
from app.domain.model import User
from app.domain.rules import optional_text, password, required
from app.usecases import Deps


def current_user(deps: Deps, user_id: int) -> User:
    user = deps.users.by_id(user_id)
    if not user:
        raise NotFound("user")
    return user


def update_settings(deps: Deps, user_id: int, changes: dict) -> User:
    """Only the fields present change. Username and email can't be blank; bio and image may be cleared."""
    user = current_user(deps, user_id)
    if "username" in changes:
        name = required("username", changes["username"])
        other = deps.users.by_username(name)
        if other and other.id != user.id:
            raise Taken("username")
        user = replace(user, username=name)
    if "email" in changes:
        mail = required("email", changes["email"])
        other = deps.users.by_email(mail)
        if other and other.id != user.id:
            raise Taken("email")
        user = replace(user, email=mail)
    if "password" in changes:
        user = replace(user, password_hash=deps.passwords.hash(password(changes["password"])))
    for field in ("bio", "image"):
        if field in changes:
            user = replace(user, **{field: optional_text(changes[field])})
    return deps.users.save(user)
