import pytest

v = pytest.mark.verifies


def feed(api, who, **params):
    r = api.get("/api/articles/feed", params=params, headers=who.auth)
    assert r.status_code == 200
    return r.json()


@v("S-011.1")
def test_the_feed_is_empty_until_the_member_follows_someone(api, member):
    assert feed(api, member("ana")) == {"articles": [], "articlesCount": 0}


@v("S-011.2")
def test_the_feed_lists_followed_authors_articles(api, member, publish):
    ana, ben = member("ana"), member("ben")
    api.post(f"/api/profiles/{ben.username}/follow", headers=ana.auth)
    older, newer = publish(ben, "First"), publish(ben, "Second")
    whole = feed(api, ana)
    assert ([a["slug"] for a in whole["articles"]], whole["articlesCount"]) == ([newer["slug"], older["slug"]], 2)
    assert all("body" not in a for a in whole["articles"])
    for offset, expected in ((0, newer), (1, older)):
        page = feed(api, ana, limit=1, offset=offset)
        assert ([a["slug"] for a in page["articles"]], page["articlesCount"]) == ([expected["slug"]], 2)


@v("S-011.3")
def test_the_feed_needs_a_token(api):
    r = api.get("/api/articles/feed")
    assert (r.status_code, r.json()["errors"]) == (401, {"token": ["is missing"]})
