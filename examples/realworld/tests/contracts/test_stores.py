"""The storage ports' contract: the memory adapters and the Postgres adapters must behave the same. Postgres runs
when DATABASE_URL is set (the deployed tier sets it); otherwise those cases are skipped."""
import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.adapters.memory import MemoryArticles, MemoryComments, MemoryFollows, MemoryUsers
from app.domain.model import Page


def memory():
    articles = MemoryArticles()
    return MemoryUsers(), MemoryFollows(), articles, MemoryComments(articles)


def postgres():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL isn't set")
    from app.adapters.postgres import Database, PostgresArticles, PostgresComments, PostgresFollows, PostgresUsers

    db = Database(url)
    db.migrate()
    return PostgresUsers(db), PostgresFollows(db), PostgresArticles(db), PostgresComments(db)


@pytest.fixture(params=[memory, postgres], ids=["app/adapters/memory", "app/adapters/postgres"])
def stores(request):
    return request.param()


T0 = datetime(2026, 1, 1, 9, tzinfo=UTC)


def names():
    u = uuid.uuid4().hex[:10]
    return f"u_{u}", f"{u}@example.com", f"slug-{u}", f"tag{u}"


def test_users_are_found_by_id_username_and_email_and_saved(stores):
    users = stores[0]
    name, mail, *_ = names()
    user = users.add(name, mail, "hash")
    assert users.by_id(user.id) == users.by_username(name) == users.by_email(mail) == user
    saved = users.save(user.__class__(user.id, name, mail, "hash2", "bio", None))
    assert (users.by_id(user.id).password_hash, users.by_id(user.id).bio) == ("hash2", "bio") and saved.bio == "bio"
    assert users.by_username(name + "x") is None


def test_follows_are_recorded_and_removed(stores):
    users, follows, *_ = stores
    a, b = (users.add(*names()[:2], "h") for _ in range(2))
    follows.follow(a.id, b.id)
    follows.follow(a.id, b.id)  # twice is once
    assert follows.follows(a.id, b.id) and not follows.follows(b.id, a.id)
    assert follows.followees(a.id) == [b.id]
    follows.unfollow(a.id, b.id)
    assert not follows.follows(a.id, b.id) and follows.followees(a.id) == []


def test_articles_keep_their_tags_in_order_and_save_changes(stores):
    users, _, articles, _ = stores
    author = users.add(*names()[:2], "h")
    _, _, slug, tag = names()
    a = articles.add(slug, "T", "D", "B", author.id, (f"z{tag}", f"a{tag}"), T0)
    assert articles.by_slug(slug).tags == (f"z{tag}", f"a{tag}")
    later = T0 + timedelta(minutes=1)
    saved = articles.save(a.__class__(a.id, slug, "T2", "D", "B2", author.id, T0, later, ()))
    got = articles.by_slug(slug)
    assert (got.title, got.body, got.tags, got.created_at, got.updated_at) == ("T2", "B2", (), T0, later) == (saved.title, saved.body, saved.tags, saved.created_at, saved.updated_at)


def test_listing_filters_pages_and_counts_newest_first(stores):
    users, _, articles, _ = stores
    author, fan = users.add(*names()[:2], "h"), users.add(*names()[:2], "h")
    tag = names()[3]
    old = articles.add(names()[2], "Old", "D", "B", author.id, (tag,), T0)
    new = articles.add(names()[2], "New", "D", "B", author.id, (), T0 + timedelta(seconds=1))
    found, total = articles.list(Page(), author_ids=[author.id])
    assert ([a.id for a in found], total) == ([new.id, old.id], 2)
    assert [a.id for a in articles.list(Page(limit=1, offset=1), author_ids=[author.id])[0]] == [old.id]
    assert [a.id for a in articles.list(Page(), tag=tag)[0]] == [old.id]
    assert articles.list(Page(), author_ids=[]) == ([], 0)
    articles.favorite(fan.id, new.id)
    articles.favorite(fan.id, new.id)  # twice is once
    assert [a.id for a in articles.list(Page(), favorited_by=fan.id)[0]] == [new.id]
    assert articles.favorited(fan.id, new.id) and articles.favorites_count(new.id) == 1
    articles.unfavorite(fan.id, new.id)
    assert articles.favorites_count(new.id) == 0
    assert tag in articles.tags()
    assert articles.tags() == sorted(articles.tags()), 'tags in code point order (S-014.2)'


def test_deleting_an_article_removes_its_comments_and_favorites(stores):
    users, _, articles, comments = stores
    author = users.add(*names()[:2], "h")
    a = articles.add(names()[2], "T", "D", "B", author.id, (), T0)
    c = comments.add(a.id, author.id, "Nice", T0)
    articles.favorite(author.id, a.id)
    assert comments.for_article(a.id) == [c] and comments.by_id(c.id) == c
    articles.delete(a.id)
    assert articles.by_slug(a.slug) is None
    assert comments.for_article(a.id) == [] and comments.by_id(c.id) is None
    assert articles.favorites_count(a.id) == 0


def test_comments_are_listed_in_order_and_deleted_one_at_a_time(stores):
    users, _, articles, comments = stores
    author = users.add(*names()[:2], "h")
    a = articles.add(names()[2], "T", "D", "B", author.id, (), T0)
    first, second = comments.add(a.id, author.id, "1", T0), comments.add(a.id, author.id, "2", T0)
    assert [c.body for c in comments.for_article(a.id)] == ["1", "2"]
    comments.delete(first.id)
    assert comments.for_article(a.id) == [second]
