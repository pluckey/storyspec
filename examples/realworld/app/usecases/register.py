# @implements S-001
from app.domain.errors import Taken
from app.domain.model import User
from app.domain.rules import password, required
from app.usecases import Deps


def register(deps: Deps, username: object, email: object, secret: object) -> User:
    name, mail = required("username", username), required("email", email)
    plain = password(secret)
    if deps.users.by_username(name):
        raise Taken("username")
    if deps.users.by_email(mail):
        raise Taken("email")
    return deps.users.add(name, mail, deps.passwords.hash(plain))
