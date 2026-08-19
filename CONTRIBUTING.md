# Contributing

This repository contains the semester-long project for **CS699: Software Lab at IIT Bombay**.

## Development Workflow

- Create a separate branch for each feature, bug fix, or significant change.
- Use descriptive branch names, for example:
  - `feature/<name>`
  - `fix/<name>`
  - `docs/<name>`

- Open a Pull Request before merging substantial changes into `main`.
- Keep commits focused and use clear commit messages.
- Do not commit generated files, build artifacts, IDE-specific files, credentials, or secrets.

## Commit Messages

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) convention.

Use the following format:

```text
<type>: <description>
```

Common types include:

- `feat`: Add a new feature
- `fix`: Fix a bug
- `docs`: Documentation changes
- `test`: Add or modify tests
- `refactor`: Code changes that do not alter behavior
- `chore`: Maintenance, configuration, or repository changes

Examples:

```text
feat: add user authentication
fix: handle invalid input
docs: update setup instructions
test: add tests for parser
refactor: simplify request handling
chore: update project dependencies
```

Keep commit messages concise and describe the change in the imperative mood.

## Pull Requests

Before merging a Pull Request:

- Make sure the code builds successfully.
- Run relevant tests.
- Update documentation if required.
- Briefly describe what was changed and why.

For small changes, direct commits to `main` may be acceptable if the team agrees.

## Team Collaboration

Discuss major architectural or design changes with the team before implementation.

When working on the same part of the codebase, coordinate with other team members to avoid unnecessary conflicts.

## Issues

Use GitHub Issues to track bugs, tasks, feature requests, and other project-related work where useful.

## Academic Integrity

This repository is for the team's CS699 academic project. All team members are expected to follow IIT Bombay's academic integrity policies and course requirements.
