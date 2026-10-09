# S-001 spec

### Requirement: Visitor registers {#S-001}

WHEN a visitor registers with a username, email and password THE SYSTEM SHALL create their account and return it with a token, or say which field is wrong.

#### Scenario: Registering returns the account and a token {#S-001.1}

- GIVEN a visitor registers as ana with ana@example.com and a password of 8 or more characters
- WHEN they register
- THEN the response is 201 with ana's username and email, no bio or image, and a token that works

#### Scenario: A blank field is rejected {#S-001.2}

- GIVEN the username, email or password is empty
- WHEN the visitor registers
- THEN the response is 422, naming that field: "can't be blank"

#### Scenario: A taken username or email is rejected {#S-001.3}

- GIVEN someone already registered as ana with ana@example.com
- WHEN another visitor registers with the username ana, or with the email ana@example.com
- THEN the response is 409, naming the field: "has already been taken"

#### Scenario: A password under 8 characters is rejected {#S-001.4}

- GIVEN a password of 7 characters
- WHEN the visitor registers
- THEN the response is 422 on password

### Decisions

- Passwords are hashed with scrypt (16-byte salt), never stored or logged in clear (free: any strong, salted hash)
- Passwords may be 8 to 128 characters; a longer one is refused with 422 (free above 64, the least NIST lets you accept)
- Usernames and emails are compared exactly, so case matters; emails get no format check (free, though a product would likely fold email case)
- Fields are stored as entered; whitespace-only counts as blank (free)
- The username is checked before the email, and only the first clash is reported; pinned by S-001.3
