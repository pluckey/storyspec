import pytest

from app.greet import greet


def test_S_001_1_greets_by_name():
    assert greet("Ada") == "Hello, Ada!"


@pytest.mark.verifies("S-001.2")
def test_greets_a_stranger():
    assert greet(None) == "Hello, stranger!"
