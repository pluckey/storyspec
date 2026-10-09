import pytest

v = pytest.mark.verifies


def edit(api, who, slug, **changes):
    return api.put(f"/api/articles/{slug}", json={"article": changes}, headers=who.auth)


@v("S-008.1")
def test_a_changed_body_keeps_everything_else(api, member, publish, uid):
    ana = member("ana")
    a = publish(ana, tagList=[f"d{uid}", f"t{uid}"])
    r = edit(api, ana, a["slug"], body="Better body")
    assert r.status_code == 200
    for got in (r.json()["article"], api.get(f"/api/articles/{a['slug']}").json()["article"]):
        assert got["body"] == "Better body"
        assert (got["title"], got["description"], got["slug"], got["tagList"], got["createdAt"]) == (a["title"], a["description"], a["slug"], a["tagList"], a["createdAt"])
        assert got["updatedAt"] != a["updatedAt"]


@v("S-008.2")
def test_tags_are_kept_emptied_or_refused(api, member, publish, uid):
    ana = member("ana")
    a = publish(ana, tagList=[f"d{uid}", f"t{uid}"])
    assert edit(api, ana, a["slug"], body="No tag change").json()["article"]["tagList"] == [f"d{uid}", f"t{uid}"]
    assert edit(api, ana, a["slug"], tagList=[]).json()["article"]["tagList"] == []
    assert api.get(f"/api/articles/{a['slug']}").json()["article"]["tagList"] == []
    assert edit(api, ana, a["slug"], tagList=None).status_code == 422


@v("S-008.3")
def test_only_the_author_can_edit(api, member, publish):
    ana, ben = member("ana"), member("ben")
    a = publish(ana)
    r = edit(api, ben, a["slug"], body="hijacked")
    assert (r.status_code, r.json()["errors"]) == (403, {"article": ["forbidden"]})
    assert api.get(f"/api/articles/{a['slug']}").json()["article"]["body"] == "The body"


@v("S-008.4")
def test_editing_needs_a_token_and_an_article(api, member, uid):
    r = api.put("/api/articles/some-slug", json={"article": {"body": "x"}})
    assert (r.status_code, r.json()["errors"]) == (401, {"token": ["is missing"]})
    r = edit(api, member("ana"), f"nothing-here-{uid}", body="x")
    assert (r.status_code, r.json()["errors"]) == (404, {"article": ["not found"]})
