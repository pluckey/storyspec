# S-005 spec

### Requirement: Member follows an author {#S-005}

WHEN a signed-in member follows or unfollows a member THE SYSTEM SHALL record it and return that member's profile showing whether they now follow them.

#### Scenario: Following shows on the profile {#S-005.1}

- GIVEN ana is signed in and ben is registered
- WHEN she follows ben
- THEN the profile returned says following true, and viewing it again says the same

#### Scenario: Unfollowing is kept {#S-005.2}

- GIVEN ana follows ben
- WHEN she unfollows him
- THEN the profile says following false, and viewing it again says the same

#### Scenario: Following needs a token {#S-005.3}

- GIVEN no Authorization header
- WHEN someone follows or unfollows a member
- THEN the response is 401 with token "is missing"

#### Scenario: Following an unknown member is not found {#S-005.4}

- GIVEN ana is signed in
- WHEN she follows or unfollows nobody
- THEN the response is 404 with profile "not found"

### Decisions

- Members may follow themselves; following twice is the same as once (free)
