"""Errors in RealWorld's shape: {"errors": {"<field>": ["<message>"]}}, each with its HTTP status."""


class AppError(Exception):
    status = 400

    def __init__(self, field: str, message: str):
        super().__init__(f"{field} {message}")
        self.field = field
        self.message = message


class Invalid(AppError):
    status = 422


class Taken(AppError):
    status = 409

    def __init__(self, field: str):
        super().__init__(field, "has already been taken")


class Unauthorized(AppError):
    status = 401


class Forbidden(AppError):
    status = 403

    def __init__(self, field: str):
        super().__init__(field, "forbidden")


class NotFound(AppError):
    status = 404

    def __init__(self, field: str):
        super().__init__(field, "not found")


def blank(field: str) -> Invalid:
    return Invalid(field, "can't be blank")
