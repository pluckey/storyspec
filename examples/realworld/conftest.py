"""Fixtures every story test shares.

`api` is the RealWorld API under test. In the local tier it is the app in-process, on memory adapters. In the deployed
tier (STORYSPEC_TIER=deployed, set by `storyspec trace --tier deployed`) it is the running server at REALWORLD_URL,
backed by Postgres. The same test proves a scenario in both tiers.
"""
import os
import uuid
from types import SimpleNamespace

import httpx
import pytest


def pytest_configure(config):
    config.addinivalue_line("markers", "verifies(scenario, tier=None): the storyspec scenario this test proves")


def pytest_collection_modifyitems(items):
    # At collection, so the scenario is in the report even when a test fails in setup.
    for item in items:
        marker = item.get_closest_marker("verifies")
        if marker:
            item.user_properties.append(("scenario", marker.args[0]))
            if marker.kwargs.get("tier"):
                item.user_properties.append(("tier", marker.kwargs["tier"]))


@pytest.fixture(scope="session")
def api():
    url = os.environ.get("REALWORLD_URL")
    if os.environ.get("STORYSPEC_TIER") == "deployed" and not url:
        pytest.exit("the deployed tier needs REALWORLD_URL (scripts/deployed.sh sets it)", returncode=2)
    if url:
        with httpx.Client(base_url=url, timeout=10) as client:
            yield client
    else:
        from fastapi.testclient import TestClient

        from app.entry.composition import memory_deps
        from app.entry.http import create_app

        with TestClient(create_app(memory_deps())) as client:
            yield client


@pytest.fixture
def uid():
    """Unique names, so tests can run against a database other runs have used."""
    return uuid.uuid4().hex[:10]


@pytest.fixture
def member(api, uid):
    """Registers a member and returns their username, email, password, token and auth header."""
    def register(name: str = "member", password: str = "password123"):
        username = f"{name}_{uid}"
        email = f"{username}@example.com"
        r = api.post("/api/users", json={"user": {"username": username, "email": email, "password": password}})
        assert r.status_code == 201, r.text
        token = r.json()["user"]["token"]
        return SimpleNamespace(username=username, email=email, password=password, token=token, auth={"Authorization": f"Token {token}"})
    return register


@pytest.fixture
def publish(api, uid):
    """Publishes an article as `author` and returns it as the API did."""
    def article(author, title: str = "An article", **fields):
        payload = {"title": f"{title} {uid}", "description": "About it", "body": "The body", **fields}
        r = api.post("/api/articles", json={"article": payload}, headers=author.auth)
        assert r.status_code == 201, r.text
        return r.json()["article"]
    return article

