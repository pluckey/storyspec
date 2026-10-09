import pytest

v = pytest.mark.verifies


def listing(api, **params):
    r = api.get("/api/articles", params=params)
    assert r.status_code == 200
    return r.json()


@v("S-010.1")
def test_articles_are_listed_newest_first_without_bodies(api, member, publish):
    ana = member("ana")
    older, newer = publish(ana, "First"), publish(ana, "Second")
    got = listing(api, author=ana.username)
    assert got["articlesCount"] == 2
    assert [a["slug"] for a in got["articles"]] == [newer["slug"], older["slug"]]
    assert all("body" not in a and a["author"]["username"] == ana.username for a in got["articles"])


@v("S-010.2")
def test_articles_are_filtered_by_tag_author_and_favoriter(api, member, publish, uid):
    ana, ben = member("ana"), member("ben")
    a = publish(ana, tagList=[f"only{uid}"])
    api.post(f"/api/articles/{a['slug']}/favorite", headers=ben.auth)
    for params in ({"tag": f"only{uid}"}, {"author": ana.username}, {"favorited": ben.username}):
        assert [x["slug"] for x in listing(api, **params)["articles"]] == [a["slug"]], params


@v("S-010.3")
def test_limit_and_offset_page_through_the_list(api, member, publish):
    ana = member("ana")
    older, newer = publish(ana, "First"), publish(ana, "Second")
    first = listing(api, author=ana.username, limit=1)
    second = listing(api, author=ana.username, limit=1, offset=1)
    assert ([a["slug"] for a in first["articles"]], first["articlesCount"]) == ([newer["slug"]], 2)
    assert ([a["slug"] for a in second["articles"]], second["articlesCount"]) == ([older["slug"]], 2)
