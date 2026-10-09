# S-013 spec

### Requirement: Member comments on an article {#S-013}

WHEN a signed-in member comments on an article, or its comments are listed or deleted THE SYSTEM SHALL keep each comment with its author, and let only its author delete it.

#### Scenario: A comment is added and listed {#S-013.1}

- GIVEN ana published an article
- WHEN she comments "Nice", and then a visitor lists the comments
- THEN the comment has a numeric id, its body, its times and ana as author; the list, with or without a token, has it

#### Scenario: A blank comment is rejected {#S-013.2}

- GIVEN ana is signed in
- WHEN she comments with an empty body
- THEN the response is 422 with body "can't be blank"

#### Scenario: Deleting removes only that comment {#S-013.3}

- GIVEN ana's article has two comments
- WHEN she deletes the first
- THEN the response is 204 and only the second is listed

#### Scenario: Only the comment's author can delete it {#S-013.4}

- GIVEN ana commented on her article
- WHEN ben deletes her comment
- THEN the response is 403 with comment "forbidden", and the comment is still listed

#### Scenario: Comments need a token and an article {#S-013.5}

- WHEN someone comments or deletes without a token; ana comments on, lists or deletes from a slug that doesn't exist; ana deletes a comment that doesn't exist
- THEN without a token: 401, token "is missing"; an unknown article: 404, article "not found"; an unknown comment: 404, comment "not found"

#### Scenario: An article's author can't delete other people's comments {#S-013.6}

- GIVEN ben commented on ana's article
- WHEN ana deletes ben's comment
- THEN the response is 403 with comment "forbidden", and the comment is still listed

### Decisions

- Only a comment's author may delete it, not the article's author; pinned by S-013.4, S-013.6
- Comments are listed oldest first (free)
