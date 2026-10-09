# S-003 spec

### Requirement: Member edits their settings {#S-003}

WHEN a signed-in member reads or changes their account THE SYSTEM SHALL return it with any changes applied, keeping username and email present and passwords at least 8 characters.

#### Scenario: The current account is returned {#S-003.1}

- GIVEN ana is signed in
- WHEN she asks for her account
- THEN the response is 200 with her username, email, bio, image and a token

#### Scenario: Without a token the account is refused {#S-003.2}

- GIVEN no Authorization header
- WHEN someone reads or changes the account
- THEN the response is 401 with token "is missing"

#### Scenario: Bio and image change, and an empty string or null clears them {#S-003.3}

- GIVEN ana is signed in
- WHEN she sets her bio and image, then sets each to "" and to null
- THEN each change is returned and kept; "" and null both leave it empty (null)

#### Scenario: Username and email change, and the new token works {#S-003.4}

- GIVEN ana is signed in
- WHEN she changes her username and email
- THEN both are returned and kept, and the token returned with them reads her account

#### Scenario: A blank or null username or email is rejected {#S-003.5}

- GIVEN ana is signed in
- WHEN she sets her username or email to "" or null
- THEN the response is 422 and nothing changes

#### Scenario: A new password must be at least 8 characters {#S-003.6}

- GIVEN ana is signed in
- WHEN she sets her password to "", null, 7 characters, 8 characters or 64 characters
- THEN "", null and 7 characters are rejected with 422; 8 and 64 are accepted, and she can sign in with the new one

#### Scenario: Another member's username or email is taken {#S-003.7}

- GIVEN ben is registered
- WHEN ana changes her username to ben's
- THEN the response is 409: "has already been taken"

#### Scenario: A bad token is refused even where signing in is optional {#S-003.8}

- GIVEN a token that is malformed or wasn't issued by this server
- WHEN someone sends it to an endpoint where signing in is optional (a profile, an article, the article list, comments)
- THEN the response is 401 with token "is invalid", instead of treating them as a visitor

### Decisions

- A bad token on an optional endpoint is refused, not ignored; pinned by S-003.8
- Changing username or email returns a new token, and earlier tokens keep working (they carry the user id) (free)
- The Authorization header may say Token or Bearer (free; RealWorld clients send Token)
