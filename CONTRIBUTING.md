# Contributing to doktor-mcp

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
git clone <repo-url>
cd doktor-mcp
npm install
```

## Development Workflow

### Build
```bash
npm run build
```
TypeScript compilation must produce zero errors. The build target is `dist/`.

### Test
```bash
npm test              # Run all tests (vitest)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```
All tests must pass before committing. Current test count: 965+.

### Linting
(If applicable)

## Commit Conventions

Use the following commit message format:

```
<task-id>: <brief description>

- Bullet points for details
- Reference affected files
```

Examples:
- `T0.1: replace hardcoded version with package.json import`
- `T1.1: recalibrate forbidden phrase list`
- `T3.2: add live adapter fixture integration tests`

### Commit Author Setup

Configure your Git author:
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

Verify with:
```bash
git config user.name
git config user.email
```

## Code Style

- **User-facing messages**: Turkish
- **Code, comments, identifiers**: English
- **Source-grounded principle**: Never fabricate court decisions or legislation text
- Use TypeScript strict mode

## Project Structure

```
src/
  app/          - Service coordination
  benchmark/    - Benchmark runner, scoring, reporting
  contracts/    - Type definitions
  core/         - Config, HTTP client, errors
  health/       - Answer composer, decision dedup, filters
  live/         - Time budget, reliability gate
  mcp/          - MCP server, tools, formatting
  sources/      - Source adapters (yargitay, danistay, aym, bedesten, legislation)
```

## Pull Request Checklist

- [ ] `npm run build` passes (zero errors)
- [ ] `npm test` passes (all green, 965+ tests)
- [ ] New behavior has corresponding tests
- [ ] No fabricated court decisions or legislation text
- [ ] ROADMAP.md task marked with [x] if applicable

## ROADMAP

Development follows ROADMAP.md. Each task is completed independently with its own commit.
Tasks are executed in priority order defined in the roadmap.
