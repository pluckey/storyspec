import re

import pytest

v = pytest.mark.verifies
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


def comment(api, who, slug, body):
    return api.post(f"/api/articles/{slug}/comments", json={"comment": {"body": body}}, headers=who.auth)


def listed(api, slug, headers=None):
    r = api.get(f"/api/articles/{slug}/comments", headers=headers or {})
    assert r.status_code == 200
    return r.json()["comments"]


@v("S-013.1")
def test_a_comment_is_added_and_listed(api, member, publish):
    ana = member("ana")
    a = publish(ana)
    r = comment(api, ana, a["slug"], "Nice")
    assert r.status_code == 201
    c = r.json()["comment"]
    assert isinstance(c["id"], int) and c["body"] == "Nice" and c["author"]["username"] == ana.username
    assert ISO.match(c["createdAt"]) and ISO.match(c["updatedAt"])
    for headers in (None, ana.auth):
        assert [(x["id"], x["body"]) for x in listed(api, a["slug"], headers)] == [(c["id"], "Nice")]


@v("S-013.2")
def test_a_blank_comment_is_rejected(api, member, publish):
    ana = member("ana")
    r = comment(api, ana, publish(ana)["slug"], "")
    assert (r.status_code, r.json()["errors"]) == (422, {"body": ["can't be blank"]})


@v("S-013.3")
def test_deleting_removes_only_that_comment(api, member, publish):
    ana = member("ana")
    slug = publish(ana)["slug"]
    first = comment(api, ana, slug, "First").json()["comment"]
    comment(api, ana, slug, "Second")
    assert api.delete(f"/api/articles/{slug}/comments/{first['id']}", headers=ana.auth).status_code == 204
    assert [c["body"] for c in listed(api, slug)] == ["Second"]


@v("S-013.4")
def test_only_the_comments_author_can_delete_it(api, member, publish):
    ana, ben = member("ana"), member("ben")
    slug = publish(ana)["slug"]
    c = comment(api, ana, slug, "Mine").json()["comment"]
    r = api.delete(f"/api/articles/{slug}/comments/{c['id']}", headers=ben.auth)
    assert (r.status_code, r.json()["errors"]) == (403, {"comment": ["forbidden"]})
    assert [x["body"] for x in listed(api, slug)] == ["Mine"]


@v("S-013.5")
def test_comments_need_a_token_and_an_article(api, member, publish, uid):
    for r in (api.post("/api/articles/some-slug/comments", json={"comment": {"body": "x"}}), api.delete("/api/articles/some-slug/comments/1")):
        assert (r.status_code, r.json()["errors"]) == (401, {"token": ["is missing"]})
    ana = member("ana")
    missing = f"nothing-{uid}"
    for r in (comment(api, ana, missing, "x"), api.get(f"/api/articles/{missing}/comments"), api.delete(f"/api/articles/{missing}/comments/99999", headers=ana.auth)):
        assert (r.status_code, r.json()["errors"]) == (404, {"article": ["not found"]})
    r = api.delete(f"/api/articles/{publish(ana)['slug']}/comments/99999999", headers=ana.auth)
    assert (r.status_code, r.json()["errors"]) == (404, {"comment": ["not found"]})


@v("S-013.6")
def test_an_articles_author_cant_delete_other_peoples_comments(api, member, publish):
    ana, ben = member("ana"), member("ben")
    slug = publish(ana)["slug"]
    c = comment(api, ben, slug, "Ben's").json()["comment"]
    r = api.delete(f"/api/articles/{slug}/comments/{c['id']}", headers=ana.auth)
    assert (r.status_code, r.json()["errors"]) == (403, {"comment": ["forbidden"]})
    assert [x["body"] for x in listed(api, slug)] == ["Ben's"]
