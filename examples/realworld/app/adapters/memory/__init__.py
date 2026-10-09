"""In-memory adapters: the local tier runs every story against these."""
from dataclasses import replace
from datetime import datetime
from itertools import count

from app.domain.model import Article, Comment, Page, User


class MemoryUsers:
    def __init__(self):
        self.rows: dict[int, User] = {}
        self.ids = count(1)

    def add(self, username, email, password_hash):
        user = User(next(self.ids), username, email, password_hash)
        self.rows[user.id] = user
        return user

    def by_id(self, user_id):
        return self.rows.get(user_id)

    def by_username(self, username):
        return next((u for u in self.rows.values() if u.username == username), None)

    def by_email(self, email):
        return next((u for u in self.rows.values() if u.email == email), None)

    def save(self, user):
        self.rows[user.id] = user
        return user


class MemoryFollows:
    def __init__(self):
        self.pairs: set[tuple[int, int]] = set()

    def follow(self, follower_id, followee_id):
        self.pairs.add((follower_id, followee_id))

    def unfollow(self, follower_id, followee_id):
        self.pairs.discard((follower_id, followee_id))

    def follows(self, follower_id, followee_id):
        return (follower_id, followee_id) in self.pairs

    def followees(self, follower_id):
        return sorted(b for a, b in self.pairs if a == follower_id)


class MemoryArticles:
    def __init__(self):
        self.rows: dict[int, Article] = {}
        self.favorites: set[tuple[int, int]] = set()
        self.ids = count(1)

    def add(self, slug, title, description, body, author_id, tags, at: datetime):
        article = Article(next(self.ids), slug, title, description, body, author_id, at, at, tuple(tags))
        self.rows[article.id] = article
        return article

    def by_slug(self, slug):
        return next((a for a in self.rows.values() if a.slug == slug), None)

    def save(self, article):
        self.rows[article.id] = replace(article, tags=tuple(article.tags))
        return self.rows[article.id]

    def delete(self, article_id):
        self.rows.pop(article_id, None)
        self.favorites = {f for f in self.favorites if f[1] != article_id}

    def list(self, page: Page, *, tag=None, author_ids=None, favorited_by=None):
        found = [a for a in self.rows.values()
                 if (tag is None or tag in a.tags)
                 and (author_ids is None or a.author_id in author_ids)
                 and (favorited_by is None or (favorited_by, a.id) in self.favorites)]
        found.sort(key=lambda a: (a.created_at, a.id), reverse=True)
        return found[page.offset:page.offset + page.limit], len(found)

    def tags(self):
        return sorted({t for a in self.rows.values() for t in a.tags})

    def favorite(self, user_id, article_id):
        self.favorites.add((user_id, article_id))

    def unfavorite(self, user_id, article_id):
        self.favorites.discard((user_id, article_id))

    def favorited(self, user_id, article_id):
        return (user_id, article_id) in self.favorites

    def favorites_count(self, article_id):
        return sum(1 for _, a in self.favorites if a == article_id)


class MemoryComments:
    def __init__(self, articles: MemoryArticles):
        self.rows: dict[int, Comment] = {}
        self.ids = count(1)
        self.articles = articles

    def add(self, article_id, author_id, body, at):
        comment = Comment(next(self.ids), article_id, author_id, body, at, at)
        self.rows[comment.id] = comment
        return comment

    def for_article(self, article_id):
        # A deleted article's comments go with it, as with the database's cascade.
        if article_id not in self.articles.rows:
            return []
        return sorted((c for c in self.rows.values() if c.article_id == article_id), key=lambda c: c.id)

    def by_id(self, comment_id):
        comment = self.rows.get(comment_id)
        return comment if comment and comment.article_id in self.articles.rows else None

    def delete(self, comment_id):
        self.rows.pop(comment_id, None)
