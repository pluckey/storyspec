import pytest

v = pytest.mark.verifies


def as_seen_by(api, who, slug):
    a = api.get(f"/api/articles/{slug}", headers=who.auth).json()["article"]
    return a["favorited"], a["favoritesCount"]


@v("S-012.1")
def test_favoriting_is_shown_and_kept(api, member, publish):
    ana, ben = member("ana"), member("ben")
    a = publish(ben)
    r = api.post(f"/api/articles/{a['slug']}/favorite", headers=ana.auth)
    assert r.status_code == 200
    assert (r.json()["article"]["favorited"], r.json()["article"]["favoritesCount"]) == (True, 1)
    assert as_seen_by(api, ana, a["slug"]) == (True, 1)


@v("S-012.2")
def test_unfavoriting_is_kept(api, member, publish):
    ana, ben = member("ana"), member("ben")
    a = publish(ben)
    api.post(f"/api/articles/{a['slug']}/favorite", headers=ana.auth)
    r = api.delete(f"/api/articles/{a['slug']}/favorite", headers=ana.auth)
    assert (r.status_code, r.json()["article"]["favorited"], r.json()["article"]["favoritesCount"]) == (200, False, 0)
    assert as_seen_by(api, ana, a["slug"]) == (False, 0)


@v("S-012.3")
def test_favoriting_needs_a_token_and_an_article(api, member, uid):
    for r in (api.post("/api/articles/some-slug/favorite"), api.delete("/api/articles/some-slug/favorite")):
        assert (r.status_code, r.json()["errors"]) == (401, {"token": ["is missing"]})
    ana = member("ana")
    for r in (api.post(f"/api/articles/nothing-{uid}/favorite", headers=ana.auth), api.delete(f"/api/articles/nothing-{uid}/favorite", headers=ana.auth)):
        assert (r.status_code, r.json()["errors"]) == (404, {"article": ["not found"]})
