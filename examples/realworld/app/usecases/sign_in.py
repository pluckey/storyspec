# @implements S-002
from app.domain.errors import Unauthorized
from app.domain.model import User
from app.domain.rules import required
from app.usecases import Deps


def sign_in(deps: Deps, email: object, secret: object) -> User:
    mail, plain = required("email", email), required("password", secret)
    user = deps.users.by_email(mail)
    if not user or not deps.passwords.verify(plain, user.password_hash):
        raise Unauthorized("credentials", "invalid")
    return user
