# Contributing to NDA Sentinel

Thank you for your interest in contributing to NDA Sentinel — an
AI-powered NDA enforcement protocol on GenLayer.

## Getting started

1. **Fork & clone** the repository.
2. **Install dependencies**:
   - Contract tests: `pip install genlayer-test` (Python 3.11+)
   - Frontend: `cd frontend && npm install`
3. **Run the test suite**: `cd tests && gltest` (or `gltest -m fast` for
   the quick bucket).
4. **Start the frontend dev server**: `cd frontend && npm run dev`.

## Project structure

```
contracts/          Intelligent Contract (Python, deployed to studionet)
tests/              pytest suite via genlayer-test
frontend/           Next.js 16 + shadcn/ui dashboard
docs/               Architecture, economics, detection rubric, privacy model
deployment/         Deployed addresses + deploy scripts
deliverables/       Submission assets (logo, screenshots)
```

## Code conventions

- **Contract version pragma** — line 1 of `nda_sentinel.py` must be
  `# v<semver>`. Bump it on every contract-changing PR.
- **No bare `int`** in contract storage annotations — use `u256`.
- **No `float`** in public method signatures.
- **All `gl.nondet.*` calls** must live inside
  `gl.eq_principle.prompt_comparative` or `gl.vm.run_nondet`.
- **Frontend writes** must call `ensureCorrectChainBeforeWrite()` and
  `assertWritable()` before transacting.

## Pull request process

1. Create a feature branch from `main`.
2. Make your changes; add or update tests as appropriate.
3. Run `gltest` and ensure all tests pass.
4. Run `cd frontend && npm run build` to catch type errors.
5. Open a PR with a clear title and description of what changed and why.

## Security

If you discover a vulnerability, **do not open a public issue**. Instead,
open a private security advisory on the GitHub repo. See `SECURITY.md` §9
for details.

## License

By contributing you agree that your contributions will be licensed under
the project's existing license.
