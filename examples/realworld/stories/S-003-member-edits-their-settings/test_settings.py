import pytest

v = pytest.mark.verifies


def put(api, who, **changes):
    return api.put("/api/user", json={"user": changes}, headers=who.auth)


def me(api, who):
    return api.get("/api/user", headers=who.auth).json()["user"]


@v("S-003.1")
def test_the_current_account_is_returned(api, member):
    ana = member("ana")
    r = api.get("/api/user", headers=ana.auth)
    assert r.status_code == 200
    user = r.json()["user"]
    assert (user["username"], user["email"], user["bio"], user["image"]) == (ana.username, ana.email, None, None)
    assert user["token"]


@v("S-003.2")
def test_without_a_token_the_account_is_refused(api):
    for r in (api.get("/api/user"), api.put("/api/user", json={"user": {"bio": "x"}})):
        assert (r.status_code, r.json()["errors"]) == (401, {"token": ["is missing"]})


@v("S-003.3")
def test_bio_and_image_change_and_empty_or_null_clears_them(api, member):
    ana = member("ana")
    for field, value in (("bio", "Writes about tea"), ("image", "https://example.com/ana.jpg")):
        assert put(api, ana, **{field: value}).json()["user"][field] == value
        assert me(api, ana)[field] == value
        for cleared in ("", None):
            put(api, ana, **{field: value})
            assert put(api, ana, **{field: cleared}).json()["user"][field] is None
            assert me(api, ana)[field] is None


@v("S-003.4")
def test_username_and_email_change_and_the_new_token_works(api, member, uid):
    ana = member("ana")
    r = put(api, ana, username=f"ana2_{uid}", email=f"ana2_{uid}@example.com")
    user = r.json()["user"]
    assert (r.status_code, user["username"], user["email"]) == (200, f"ana2_{uid}", f"ana2_{uid}@example.com")
    again = api.get("/api/user", headers={"Authorization": f"Token {user['token']}"}).json()["user"]
    assert (again["username"], again["email"]) == (f"ana2_{uid}", f"ana2_{uid}@example.com")


@v("S-003.5")
def test_a_blank_or_null_username_or_email_is_rejected(api, member):
    ana = member("ana")
    for field in ("username", "email"):
        for value in ("", None):
            assert put(api, ana, **{field: value}).status_code == 422, (field, value)
    assert (me(api, ana)["username"], me(api, ana)["email"]) == (ana.username, ana.email)


@v("S-003.6")
def test_a_new_password_must_be_at_least_8_characters(api, member):
    ana = member("ana")
    for rejected in ("", None, "short7c"):
        assert put(api, ana, password=rejected).status_code == 422, rejected
    for accepted in ("bonjour1", "a" * 64):
        assert put(api, ana, password=accepted).status_code == 200, accepted
    r = api.post("/api/users/login", json={"user": {"email": ana.email, "password": "a" * 64}})
    assert r.status_code == 200


@v("S-003.7")
def test_another_members_username_or_email_is_taken(api, member):
    ana, ben = member("ana"), member("ben")
    r = put(api, ana, username=ben.username)
    assert (r.status_code, r.json()["errors"]) == (409, {"username": ["has already been taken"]})
    r = put(api, ana, email=ben.email)
    assert (r.status_code, r.json()["errors"]) == (409, {"email": ["has already been taken"]})
