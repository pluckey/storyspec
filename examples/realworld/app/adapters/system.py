"""Clock, password hashing (scrypt, from the standard library) and JWT tokens."""
import hashlib
import hmac
import os
from datetime import UTC, datetime, timedelta

import jwt


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


class ScryptPasswords:
    def hash(self, password: str) -> str:
        salt = os.urandom(16)
        digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        return f"scrypt${salt.hex()}${digest.hex()}"

    def verify(self, password: str, hashed: str) -> bool:
        try:
            _, salt, digest = hashed.split("$")
        except ValueError:
            return False
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
        return hmac.compare_digest(actual.hex(), digest)


class JwtTokens:
    def __init__(self, secret: str, clock, lifetime: timedelta = timedelta(days=7)):
        self.secret, self.clock, self.lifetime = secret, clock, lifetime

    def issue(self, user_id: int) -> str:
        now = self.clock.now()
        return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + self.lifetime}, self.secret, algorithm="HS256")

    def read(self, token: str) -> int | None:
        try:
            return int(jwt.decode(token, self.secret, algorithms=["HS256"])["sub"])
        except (jwt.PyJWTError, KeyError, ValueError):
            return None
