# S-011 spec

### Requirement: Member reads their feed {#S-011}

WHEN a signed-in member reads their feed THE SYSTEM SHALL list the articles of the authors they follow, newest first, a page at a time, with the total count.

#### Scenario: The feed is empty until the member follows someone {#S-011.1}

- GIVEN ana just registered
- WHEN she reads her feed
- THEN it has no articles and a count of 0

#### Scenario: The feed lists followed authors' articles {#S-011.2}

- GIVEN ana follows ben, who published two articles
- WHEN she reads her feed, then with limit 1, then with limit 1 and offset 1
- THEN the feed lists both, newest first, with count 2; each page has one, with count 2

#### Scenario: The feed needs a token {#S-011.3}

- GIVEN no Authorization header
- WHEN someone reads the feed
- THEN the response is 401 with token "is missing"
