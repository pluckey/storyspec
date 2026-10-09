import pytest

v = pytest.mark.verifies


@v("S-009.1")
def test_a_deleted_article_is_gone(api, member, publish):
    ana = member("ana")
    a = publish(ana)
    assert api.delete(f"/api/articles/{a['slug']}", headers=ana.auth).status_code == 204
    assert api.get(f"/api/articles/{a['slug']}").status_code == 404


@v("S-009.2")
def test_only_the_author_can_delete(api, member, publish):
    ana, ben = member("ana"), member("ben")
    a = publish(ana)
    r = api.delete(f"/api/articles/{a['slug']}", headers=ben.auth)
    assert (r.status_code, r.json()["errors"]) == (403, {"article": ["forbidden"]})
    assert api.get(f"/api/articles/{a['slug']}").status_code == 200


@v("S-009.3")
def test_deleting_needs_a_token_and_an_article(api, member, uid):
    r = api.delete("/api/articles/some-slug")
    assert (r.status_code, r.json()["errors"]) == (401, {"token": ["is missing"]})
    r = api.delete(f"/api/articles/nothing-here-{uid}", headers=member("ana").auth)
    assert (r.status_code, r.json()["errors"]) == (404, {"article": ["not found"]})
