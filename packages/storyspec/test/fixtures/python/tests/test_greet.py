from app.greet import greet


def test_S_001_1_greets_by_name():
    assert greet("Ada") == "Hello, Ada!"


def test_greets_a_stranger(record_property):
    record_property("scenario", "S-001.2")
    assert greet(None) == "Hello, stranger!"
