import pytest

v = pytest.mark.verifies


@v("S-007.1")
def test_an_article_is_returned_by_its_slug(api, member, publish):
    a = publish(member("ana"))
    r = api.get(f"/api/articles/{a['slug']}")
    assert r.status_code == 200
    got = r.json()["article"]
    assert (got["slug"], got["title"], got["body"], got["favorited"], got["favoritesCount"]) == (a["slug"], a["title"], "The body", False, 0)


@v("S-007.2")
def test_an_unknown_slug_is_not_found(api, uid):
    r = api.get(f"/api/articles/nothing-here-{uid}")
    assert (r.status_code, r.json()["errors"]) == (404, {"article": ["not found"]})
