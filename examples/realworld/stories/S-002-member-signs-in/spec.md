# S-002 spec

### Requirement: Member signs in {#S-002}

WHEN a member signs in with their email and password THE SYSTEM SHALL return their account with a token, or refuse without saying which part was wrong.

#### Scenario: The right email and password sign in {#S-002.1}

- GIVEN ana registered with ana@example.com
- WHEN she signs in with that email and password
- THEN the response is 200 with her account and a token

#### Scenario: A blank email or password is rejected {#S-002.2}

- GIVEN an empty email or password
- WHEN a member signs in
- THEN the response is 422, naming that field: "can't be blank"

#### Scenario: A wrong password is refused {#S-002.3}

- GIVEN ana registered
- WHEN she signs in with the wrong password
- THEN the response is 401 with credentials "invalid"

### Decisions

- Tokens are HS256 JWTs carrying the user id, valid for 7 days, signed with JWT_SECRET (free; JWT_SECRET must be set outside development)
- Sign-in failures never say which part was wrong; pinned by S-002.3
