# @implements S-001
def greet(name: str | None) -> str:
    return f"Hello, {name}!" if name else "Hello, stranger!"
