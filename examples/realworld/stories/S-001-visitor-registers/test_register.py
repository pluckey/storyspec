import pytest

v = pytest.mark.verifies


def new_user(uid, **overrides):
    user = {"username": f"ana_{uid}", "email": f"ana_{uid}@example.com", "password": "password123"}
    return {"user": {**user, **overrides}}


@v("S-001.1")
def test_registering_returns_the_account_and_a_token(api, uid):
    r = api.post("/api/users", json=new_user(uid))
    assert r.status_code == 201
    user = r.json()["user"]
    assert (user["username"], user["email"], user["bio"], user["image"]) == (f"ana_{uid}", f"ana_{uid}@example.com", None, None)
    assert api.get("/api/user", headers={"Authorization": f"Token {user['token']}"}).json()["user"]["username"] == f"ana_{uid}"


@v("S-001.2")
def test_a_blank_field_is_rejected(api, uid):
    for field in ("username", "email", "password"):
        r = api.post("/api/users", json=new_user(uid, **{field: ""}))
        assert r.status_code == 422, field
        assert r.json()["errors"][field] == ["can't be blank"]


@v("S-001.3")
def test_a_taken_username_or_email_is_rejected(api, uid):
    assert api.post("/api/users", json=new_user(uid)).status_code == 201
    r = api.post("/api/users", json=new_user(uid, email=f"other_{uid}@example.com"))
    assert (r.status_code, r.json()["errors"]) == (409, {"username": ["has already been taken"]})
    r = api.post("/api/users", json=new_user(uid, username=f"other_{uid}"))
    assert (r.status_code, r.json()["errors"]) == (409, {"email": ["has already been taken"]})


@v("S-001.4")
def test_a_password_under_8_characters_is_rejected(api, uid):
    r = api.post("/api/users", json=new_user(uid, password="short7c"))
    assert r.status_code == 422
    assert "password" in r.json()["errors"]
