import pytest

v = pytest.mark.verifies


@v("S-004.1")
def test_a_profile_is_shown_with_or_without_signing_in(api, member):
    ana, ben = member("ana"), member("ben")
    for headers in ({}, ana.auth):
        r = api.get(f"/api/profiles/{ben.username}", headers=headers)
        assert r.status_code == 200
        assert r.json()["profile"] == {"username": ben.username, "bio": None, "image": None, "following": False}


@v("S-004.2")
def test_an_unknown_profile_is_not_found(api, uid):
    r = api.get(f"/api/profiles/nobody_{uid}")
    assert (r.status_code, r.json()["errors"]) == (404, {"profile": ["not found"]})
