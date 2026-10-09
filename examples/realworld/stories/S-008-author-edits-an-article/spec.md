# S-008 spec

### Requirement: Author edits an article {#S-008}

WHEN an article's author changes some of its fields THE SYSTEM SHALL change only those, keep its slug and creation time, and update its update time.

#### Scenario: A changed body keeps everything else {#S-008.1}

- GIVEN ana published an article with two tags
- WHEN she changes its body
- THEN the body changes; its title, description, slug, tags and creation time stay; its update time moves on; reading it again shows the same

#### Scenario: Tags are kept, emptied or refused {#S-008.2}

- GIVEN ana's article has two tags
- WHEN she edits it without tagList, then with [], then with null
- THEN without tagList the tags stay; [] removes them all (and reading it again agrees); null is rejected with 422

#### Scenario: Only the author can edit {#S-008.3}

- GIVEN ana published an article
- WHEN ben edits it
- THEN the response is 403 with article "forbidden"

#### Scenario: Editing needs a token and an article {#S-008.4}

- WHEN someone edits without a token, or ana edits a slug that doesn't exist
- THEN without a token: 401, token "is missing"; an unknown slug: 404, article "not found"
