import re

import pytest

v = pytest.mark.verifies
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


@v("S-006.1")
def test_a_published_article_is_returned_in_full(api, member, uid):
    ana = member("ana")
    payload = {"title": f"Hello world {uid}", "description": "Greetings", "body": "Hi.", "tagList": [f"dragons{uid}", f"tea{uid}"]}
    r = api.post("/api/articles", json={"article": payload}, headers=ana.auth)
    assert r.status_code == 201
    a = r.json()["article"]
    assert a["slug"] and (a["title"], a["description"], a["body"]) == (payload["title"], "Greetings", "Hi.")
    assert a["tagList"] == [f"dragons{uid}", f"tea{uid}"]
    assert ISO.match(a["createdAt"]) and ISO.match(a["updatedAt"])
    assert (a["favorited"], a["favoritesCount"], a["author"]["username"]) == (False, 0, ana.username)


@v("S-006.2")
def test_a_blank_title_description_or_body_is_rejected(api, member):
    ana = member("ana")
    for field in ("title", "description", "body"):
        article = {"title": "T", "description": "D", "body": "B", field: ""}
        r = api.post("/api/articles", json={"article": article}, headers=ana.auth)
        assert (r.status_code, r.json()["errors"]) == (422, {field: ["can't be blank"]})


@v("S-006.3")
def test_two_articles_with_the_same_title_get_different_slugs(member, publish):
    ana = member("ana")
    first, second = publish(ana, "Hello world"), publish(ana, "Hello world")
    assert first["title"] == second["title"] and first["slug"] != second["slug"]


@v("S-006.4")
def test_publishing_needs_a_token(api):
    r = api.post("/api/articles", json={"article": {"title": "T", "description": "D", "body": "B"}})
    assert (r.status_code, r.json()["errors"]) == (401, {"token": ["is missing"]})


UTC_MS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


@v("S-006.5")
def test_times_are_given_in_utc(api, member, publish):
    a = publish(member("ana"))
    assert UTC_MS.match(a["createdAt"]), a["createdAt"]
    assert UTC_MS.match(a["updatedAt"]), a["updatedAt"]
    got = api.get(f"/api/articles/{a['slug']}").json()["article"]
    assert (got["createdAt"], got["updatedAt"]) == (a["createdAt"], a["updatedAt"])


@v("S-006.6")
def test_a_clashing_slug_gets_a_number(member, publish):
    ana = member("ana")
    first, second, third = (publish(ana, "Hello world") for _ in range(3))
    assert (second["slug"], third["slug"]) == (f"{first['slug']}-2", f"{first['slug']}-3")
