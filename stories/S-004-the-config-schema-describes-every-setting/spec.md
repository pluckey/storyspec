# S-004 spec

### Requirement: A complete schema {#S-004}

WHEN an editor validates storyspec.config.json against the published schema THE SYSTEM SHALL describe exactly the settings storyspec accepts.

#### Scenario: The schema lists exactly the config's settings {#S-004.1}

- GIVEN the settings storyspec reads (its defaults)
- WHEN they are compared with the schema's properties
- THEN each setting is in the schema and the schema has no others (besides $schema)

#### Scenario: Tier reports may be one path or several {#S-004.2}

- GIVEN tiers whose report is a path, or a list of paths
- WHEN storyspec loads the config
- THEN both are accepted, and an empty list or a number is refused
