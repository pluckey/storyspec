import pytest

v = pytest.mark.verifies


@v("S-002.1")
def test_the_right_email_and_password_sign_in(api, member):
    ana = member("ana")
    r = api.post("/api/users/login", json={"user": {"email": ana.email, "password": ana.password}})
    assert r.status_code == 200
    user = r.json()["user"]
    assert user["username"] == ana.username and user["token"]


@v("S-002.2")
def test_a_blank_email_or_password_is_rejected(api, member):
    ana = member("ana")
    for field, body in (("email", {"email": "", "password": ana.password}), ("password", {"email": ana.email, "password": ""})):
        r = api.post("/api/users/login", json={"user": body})
        assert (r.status_code, r.json()["errors"]) == (422, {field: ["can't be blank"]})


@v("S-002.3")
def test_a_wrong_password_is_refused(api, member):
    ana = member("ana")
    r = api.post("/api/users/login", json={"user": {"email": ana.email, "password": "wrongpassword"}})
    assert (r.status_code, r.json()["errors"]) == (401, {"credentials": ["invalid"]})
