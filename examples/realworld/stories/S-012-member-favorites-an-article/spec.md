# S-012 spec

### Requirement: Member favorites an article {#S-012}

WHEN a signed-in member favorites or unfavorites an article THE SYSTEM SHALL record it and return the article with its favorited flag and count.

#### Scenario: Favoriting is shown and kept {#S-012.1}

- GIVEN ben published an article
- WHEN ana favorites it
- THEN it's returned favorited with 1 favorite, and reading it again as ana says the same

#### Scenario: Unfavoriting is kept {#S-012.2}

- GIVEN ana favorited ben's article
- WHEN she unfavorites it
- THEN it's returned not favorited with 0 favorites, and reading it again says the same

#### Scenario: Favoriting needs a token and an article {#S-012.3}

- WHEN someone favorites or unfavorites without a token, or ana does so on a slug that doesn't exist
- THEN without a token: 401, token "is missing"; an unknown slug: 404, article "not found"
