"""Builds the app's dependencies: Postgres when DATABASE_URL is set, memory otherwise."""
import os

from app.adapters.memory import MemoryArticles, MemoryComments, MemoryFollows, MemoryUsers
from app.adapters.system import JwtTokens, ScryptPasswords, SystemClock
from app.usecases import Deps


def memory_deps(secret: str = "local-secret-for-development-only-32b") -> Deps:
    clock = SystemClock()
    articles = MemoryArticles()
    return Deps(MemoryUsers(), MemoryFollows(), articles, MemoryComments(articles), clock, ScryptPasswords(), JwtTokens(secret, clock))


def postgres_deps(url: str, secret: str) -> Deps:
    from app.adapters.postgres import Database, PostgresArticles, PostgresComments, PostgresFollows, PostgresUsers

    db = Database(url)
    db.migrate()
    clock = SystemClock()
    return Deps(PostgresUsers(db), PostgresFollows(db), PostgresArticles(db), PostgresComments(db), clock, ScryptPasswords(), JwtTokens(secret, clock))


def deps_from_env() -> Deps:
    secret = os.environ.get("JWT_SECRET", "local-secret-for-development-only-32b")
    url = os.environ.get("DATABASE_URL")
    return postgres_deps(url, secret) if url else memory_deps(secret)
