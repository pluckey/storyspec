import pytest

v = pytest.mark.verifies


@v("S-014.1")
def test_tags_of_published_articles_are_listed(api, member, publish, uid):
    publish(member("ana"), tagList=[f"h{uid}", f"t{uid}"])
    r = api.get("/api/tags")
    assert r.status_code == 200
    assert {f"h{uid}", f"t{uid}"} <= set(r.json()["tags"])
