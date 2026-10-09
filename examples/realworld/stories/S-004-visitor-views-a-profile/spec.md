# S-004 spec

### Requirement: Visitor views a profile {#S-004}

WHEN anyone asks for a member's profile by username THE SYSTEM SHALL return their username, bio, image and whether the viewer follows them.

#### Scenario: A profile is shown with or without signing in {#S-004.1}

- GIVEN ben is registered
- WHEN a visitor, and then signed-in ana, view ben's profile
- THEN both get 200 with ben's username, bio and image, and following false

#### Scenario: An unknown profile is not found {#S-004.2}

- GIVEN no member called nobody
- WHEN someone views nobody's profile
- THEN the response is 404 with profile "not found"
