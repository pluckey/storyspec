import pytest

v = pytest.mark.verifies


def following(api, who, username):
    return api.get(f"/api/profiles/{username}", headers=who.auth).json()["profile"]["following"]


@v("S-005.1")
def test_following_shows_on_the_profile(api, member):
    ana, ben = member("ana"), member("ben")
    r = api.post(f"/api/profiles/{ben.username}/follow", headers=ana.auth)
    assert (r.status_code, r.json()["profile"]["following"]) == (200, True)
    assert following(api, ana, ben.username) is True


@v("S-005.2")
def test_unfollowing_is_kept(api, member):
    ana, ben = member("ana"), member("ben")
    api.post(f"/api/profiles/{ben.username}/follow", headers=ana.auth)
    r = api.delete(f"/api/profiles/{ben.username}/follow", headers=ana.auth)
    assert (r.status_code, r.json()["profile"]["following"]) == (200, False)
    assert following(api, ana, ben.username) is False


@v("S-005.3")
def test_following_needs_a_token(api, member):
    ben = member("ben")
    for r in (api.post(f"/api/profiles/{ben.username}/follow"), api.delete(f"/api/profiles/{ben.username}/follow")):
        assert (r.status_code, r.json()["errors"]) == (401, {"token": ["is missing"]})


@v("S-005.4")
def test_following_an_unknown_member_is_not_found(api, member, uid):
    ana = member("ana")
    for r in (api.post(f"/api/profiles/nobody_{uid}/follow", headers=ana.auth), api.delete(f"/api/profiles/nobody_{uid}/follow", headers=ana.auth)):
        assert (r.status_code, r.json()["errors"]) == (404, {"profile": ["not found"]})
