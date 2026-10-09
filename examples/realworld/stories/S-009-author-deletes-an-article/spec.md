# S-009 spec

### Requirement: Author deletes an article {#S-009}

WHEN an article's author deletes it THE SYSTEM SHALL remove it, with its comments and favorites.

#### Scenario: A deleted article is gone {#S-009.1}

- GIVEN ana published an article
- WHEN she deletes it
- THEN the response is 204 and opening it gives 404

#### Scenario: Only the author can delete {#S-009.2}

- GIVEN ana published an article
- WHEN ben deletes it
- THEN the response is 403 with article "forbidden", and the article is still there

#### Scenario: Deleting needs a token and an article {#S-009.3}

- WHEN someone deletes without a token, or ana deletes a slug that doesn't exist
- THEN without a token: 401, token "is missing"; an unknown slug: 404, article "not found"
