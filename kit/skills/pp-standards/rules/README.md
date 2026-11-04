# Organization rules – placeholder

Optional. Put your organization's own Power Platform rulebook here (Markdown files with rule IDs), or let the
installer replace this folder with a link (junction/symlink) to a cloned rules repository:

```powershell
git clone <your-rules-repo-url> "$HOME\repos\pp-rules"
$env:PPKIT_RULES_REPO = "$HOME\repos\pp-rules"
node install.cjs
```

When rules are present, agents read them before the baseline in `../SKILL.md` and cite their IDs.
Update: `git -C "$env:PPKIT_RULES_REPO" pull`.
