# Release Rules

## Release Flow
1. Update `server/cmd/server/main.go` version constant to `vX.Y.Z`
2. Run release verification:
   - `cd server && GOTOOLCHAIN=go1.26.0 go fix -diff ./...`
   - `cd server && GOTOOLCHAIN=go1.26.0 go fix ./...`
   - `cd server && go test ./...`
   - `cd server && go build -buildvcs=false ./...`
3. Commit the release version change with a conventional commit
4. Create or move tag `vX.Y.Z`
5. Push branch and tag only when explicitly instructed
6. CI may build/publish from tags `v*` if configured

## Release Discipline
- Never auto-release: do not run `git push`, `git tag`, or `git push origin vX.Y.Z` unless user explicitly instructs
- If ambiguous, ask before any push/tag
- If a tag already exists and the user explicitly asks to republish it, move it deliberately and force-push the tag update

## Release Notes Sections
1. `更新内容`
2. `Downloads`
3. `Installation`
4. `Requirements`
5. `Changelog`

## CI Triggers
- `.github/workflows/ci.yml` - tags `v*`

# Commit Rules

## Commit Convention
- Title line: use conventional commits format (feat/fix/refactor/chore, etc.)
- Body: group by file or feature, explain what changed, why, and impact scope
- Bug fixes: state root cause; architecture decisions: briefly explain rationale
- Release-related commits should state the version change and the affected release surface

## Auto-Commit After Test Pass
- When development work passes all required tests (unit / integration / e2e), automatically commit with a conventional commit message
- Commit message format: `<type>: <description>`
  - `type` matches the change category (feat/fix/refactor/chore/test/docs, etc.)
  - `description` briefly states what was tested and changed
- Example: `feat: add dinosaur adventure story novel with 6-episode structure`
- This ensures successful work is immediately captured in version history without manual commit step
- Do NOT push automatically—await explicit user instruction before any push or tag operation

