# S-006 spec

### Requirement: Author publishes an article {#S-006}

WHEN a signed-in member publishes an article with a title, description, body and optional tags THE SYSTEM SHALL store it under a slug made from its title and return it.

#### Scenario: A published article is returned in full {#S-006.1}

- GIVEN ana is signed in
- WHEN she publishes "Hello world" with the tags dragons then tea
- THEN the response is 201 with a slug, her title, description and body, the tags in her order, its creation and update times, not favorited, 0 favorites and ana as author

#### Scenario: A blank title, description or body is rejected {#S-006.2}

- GIVEN ana is signed in
- WHEN she publishes with one of them empty
- THEN the response is 422 naming that field: "can't be blank"

#### Scenario: Two articles with the same title get different slugs {#S-006.3}

- GIVEN ana published "Hello world"
- WHEN she publishes another "Hello world"
- THEN both are published, with different slugs

#### Scenario: Publishing needs a token {#S-006.4}

- GIVEN no Authorization header
- WHEN someone publishes
- THEN the response is 401 with token "is missing"

#### Scenario: Times are given in UTC {#S-006.5}

- GIVEN the database answers in a time zone other than UTC (the deployed tier's Postgres runs in America/Chicago)
- WHEN ana publishes an article
- THEN its creation and update times are UTC, to the millisecond, ending in Z
