# Changelog

Notable changes to n8n-nodes-asqav. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0]

First release.

### Added
- Asqav n8n community node: signs a workflow action through the Asqav SDK and
  returns a verifiable compliance receipt.
- Asqav API credential type for storing the API key.
- Tag-gated npm publish workflow with provenance through GitHub OIDC.
- Pull-request build dry run that installs, builds, tests, and packs the node.

### Changed
- Pinned the `@asqav/sdk` dependency to `^0.8.0`.
