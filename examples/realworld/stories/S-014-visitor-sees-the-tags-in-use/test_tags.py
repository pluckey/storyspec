import pytest

v = pytest.mark.verifies


@v("S-014.1")
def test_tags_of_published_articles_are_listed(api, member, publish, uid):
    publish(member("ana"), tagList=[f"h{uid}", f"t{uid}"])
    r = api.get("/api/tags")
    assert r.status_code == 200
    assert {f"h{uid}", f"t{uid}"} <= set(r.json()["tags"])


@v("S-014.2")
def test_tags_are_listed_alphabetically(api, member, publish, uid):
    # zz… is used more than aa…, so an order by use (or by insertion) would put it first.
    ana = member("ana")
    publish(ana, "First", tagList=[f"zz{uid}"])
    publish(ana, "Second", tagList=[f"zz{uid}", f"aa{uid}"])
    tags = api.get("/api/tags").json()["tags"]
    assert tags == sorted(tags)
    assert tags.index(f"aa{uid}") < tags.index(f"zz{uid}")
