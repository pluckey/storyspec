"""Postgres adapters (psycopg 3). The deployed tier runs every story against these."""
from datetime import datetime

import psycopg
from psycopg.rows import dict_row

from app.domain.model import Article, Comment, Page, User

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, bio TEXT, image TEXT);
CREATE TABLE IF NOT EXISTS follows (
  follower_id INT NOT NULL REFERENCES users ON DELETE CASCADE, followee_id INT NOT NULL REFERENCES users ON DELETE CASCADE,
  PRIMARY KEY (follower_id, followee_id));
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL, body TEXT NOT NULL,
  author_id INT NOT NULL REFERENCES users ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS article_tags (
  article_id INT NOT NULL REFERENCES articles ON DELETE CASCADE, tag TEXT NOT NULL, position INT NOT NULL,
  PRIMARY KEY (article_id, tag));
CREATE TABLE IF NOT EXISTS favorites (
  user_id INT NOT NULL REFERENCES users ON DELETE CASCADE, article_id INT NOT NULL REFERENCES articles ON DELETE CASCADE,
  PRIMARY KEY (user_id, article_id));
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY, article_id INT NOT NULL REFERENCES articles ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES users ON DELETE CASCADE, body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
"""


class Database:
    """One connection in autocommit mode: every adapter call is a statement or two, and the app is small."""

    def __init__(self, url: str):
        self.conn = psycopg.connect(url, autocommit=True, row_factory=dict_row)

    def migrate(self):
        self.conn.execute(SCHEMA)

    def rows(self, sql, params=()):
        return self.conn.execute(sql, params).fetchall()

    def row(self, sql, params=()):
        return self.conn.execute(sql, params).fetchone()


def _user(r) -> User | None:
    return User(r["id"], r["username"], r["email"], r["password_hash"], r["bio"], r["image"]) if r else None


class PostgresUsers:
    def __init__(self, db: Database):
        self.db = db

    def add(self, username, email, password_hash):
        return _user(self.db.row("INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING *", (username, email, password_hash)))

    def by_id(self, user_id):
        return _user(self.db.row("SELECT * FROM users WHERE id = %s", (user_id,)))

    def by_username(self, username):
        return _user(self.db.row("SELECT * FROM users WHERE username = %s", (username,)))

    def by_email(self, email):
        return _user(self.db.row("SELECT * FROM users WHERE email = %s", (email,)))

    def save(self, user):
        return _user(self.db.row(
            "UPDATE users SET username = %s, email = %s, password_hash = %s, bio = %s, image = %s WHERE id = %s RETURNING *",
            (user.username, user.email, user.password_hash, user.bio, user.image, user.id)))


class PostgresFollows:
    def __init__(self, db: Database):
        self.db = db

    def follow(self, follower_id, followee_id):
        self.db.conn.execute("INSERT INTO follows VALUES (%s, %s) ON CONFLICT DO NOTHING", (follower_id, followee_id))

    def unfollow(self, follower_id, followee_id):
        self.db.conn.execute("DELETE FROM follows WHERE follower_id = %s AND followee_id = %s", (follower_id, followee_id))

    def follows(self, follower_id, followee_id):
        return self.db.row("SELECT 1 FROM follows WHERE follower_id = %s AND followee_id = %s", (follower_id, followee_id)) is not None

    def followees(self, follower_id):
        return [r["followee_id"] for r in self.db.rows("SELECT followee_id FROM follows WHERE follower_id = %s ORDER BY 1", (follower_id,))]


class PostgresArticles:
    def __init__(self, db: Database):
        self.db = db

    def _tags(self, article_id) -> tuple[str, ...]:
        return tuple(r["tag"] for r in self.db.rows("SELECT tag FROM article_tags WHERE article_id = %s ORDER BY position", (article_id,)))

    def _article(self, r) -> Article | None:
        if not r:
            return None
        return Article(r["id"], r["slug"], r["title"], r["description"], r["body"], r["author_id"], r["created_at"], r["updated_at"], self._tags(r["id"]))

    def _set_tags(self, article_id, tags):
        self.db.conn.execute("DELETE FROM article_tags WHERE article_id = %s", (article_id,))
        for i, tag in enumerate(tags):
            self.db.conn.execute("INSERT INTO article_tags VALUES (%s, %s, %s)", (article_id, tag, i))

    def add(self, slug, title, description, body, author_id, tags, at: datetime):
        r = self.db.row(
            "INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (slug, title, description, body, author_id, at, at))
        self._set_tags(r["id"], tags)
        return self._article(self.db.row("SELECT * FROM articles WHERE id = %s", (r["id"],)))

    def by_slug(self, slug):
        return self._article(self.db.row("SELECT * FROM articles WHERE slug = %s", (slug,)))

    def save(self, article):
        self.db.conn.execute(
            "UPDATE articles SET title = %s, description = %s, body = %s, updated_at = %s WHERE id = %s",
            (article.title, article.description, article.body, article.updated_at, article.id))
        self._set_tags(article.id, article.tags)
        return self._article(self.db.row("SELECT * FROM articles WHERE id = %s", (article.id,)))

    def delete(self, article_id):
        self.db.conn.execute("DELETE FROM articles WHERE id = %s", (article_id,))

    def list(self, page: Page, *, tag=None, author_ids=None, favorited_by=None):
        where, params = ["TRUE"], []
        if tag is not None:
            where.append("EXISTS (SELECT 1 FROM article_tags t WHERE t.article_id = a.id AND t.tag = %s)")
            params.append(tag)
        if author_ids is not None:
            where.append("a.author_id = ANY(%s)")
            params.append(list(author_ids))
        if favorited_by is not None:
            where.append("EXISTS (SELECT 1 FROM favorites f WHERE f.article_id = a.id AND f.user_id = %s)")
            params.append(favorited_by)
        clause = " AND ".join(where)
        total = self.db.row(f"SELECT count(*) AS n FROM articles a WHERE {clause}", params)["n"]
        found = self.db.rows(f"SELECT * FROM articles a WHERE {clause} ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s", [*params, page.limit, page.offset])
        return [self._article(r) for r in found], total

    def tags(self):
        return [r["tag"] for r in self.db.rows('SELECT DISTINCT tag COLLATE "C" AS tag FROM article_tags ORDER BY 1')]  # code point order, as the memory adapter sorts; a locale collation would ignore punctuation

    def favorite(self, user_id, article_id):
        self.db.conn.execute("INSERT INTO favorites VALUES (%s, %s) ON CONFLICT DO NOTHING", (user_id, article_id))

    def unfavorite(self, user_id, article_id):
        self.db.conn.execute("DELETE FROM favorites WHERE user_id = %s AND article_id = %s", (user_id, article_id))

    def favorited(self, user_id, article_id):
        return self.db.row("SELECT 1 FROM favorites WHERE user_id = %s AND article_id = %s", (user_id, article_id)) is not None

    def favorites_count(self, article_id):
        return self.db.row("SELECT count(*) AS n FROM favorites WHERE article_id = %s", (article_id,))["n"]


def _comment(r) -> Comment | None:
    return Comment(r["id"], r["article_id"], r["author_id"], r["body"], r["created_at"], r["updated_at"]) if r else None


class PostgresComments:
    def __init__(self, db: Database):
        self.db = db

    def add(self, article_id, author_id, body, at):
        return _comment(self.db.row(
            "INSERT INTO comments (article_id, author_id, body, created_at, updated_at) VALUES (%s, %s, %s, %s, %s) RETURNING *",
            (article_id, author_id, body, at, at)))

    def for_article(self, article_id):
        return [_comment(r) for r in self.db.rows("SELECT * FROM comments WHERE article_id = %s ORDER BY id", (article_id,))]

    def by_id(self, comment_id):
        return _comment(self.db.row("SELECT * FROM comments WHERE id = %s", (comment_id,)))

    def delete(self, comment_id):
        self.db.conn.execute("DELETE FROM comments WHERE id = %s", (comment_id,))
