# Git Workspace

An Ubuntu desktop client that runs the installed Git executable. It uses the Git configuration, credential helpers, SSH agent, signing tools, and hooks available to its desktop session. GitHub sign-in is optional for Git operations. Open **Settings → Git environment** to see which tools the desktop session can find.

Create a local repository, open a checkout, or clone a repository. Review staged and unstaged changes, commit, browse history, switch branches, and sync with configured remotes. For a repository without a remote, choose **Add remote** in the toolbar. Pull uses fast-forward only. Push shows the destination and updates one branch, including when Git is configured to push to a fork and pull from upstream. Git and hook output appears in the operation panel. Use **Open in Terminal** when Git needs a terminal prompt or a workflow such as rebasing a diverged branch.

## Install on Ubuntu

Install the generated `.deb` with Ubuntu's package installer or run:

```sh
sudo apt install "./src-tauri/target/release/bundle/deb/Git Workspace_0.3.0_amd64.deb"
```

Open **Git Workspace** in the app launcher. If your shell sets up tools for a repo's hooks, you can also launch the app by running `git-workspace` from that terminal.

## Workspace and settings

Use the Repository, Branch, and sync controls in the top toolbar. Search your open repositories with **Ctrl+K**, open a local checkout with **Ctrl+O**, and open Settings with **Ctrl+,**. Theme, GitHub accounts, and Git environment diagnostics are in Settings.

## Compare, merge, and recovery

Open **Branches → Compare branches…** to compare the current branch with a local or remote branch. It shows the commits unique to each side and the changes since the merge base, without touching your checkout. From a comparison you can merge, rebase onto the other branch, or cherry-pick a commit it has. In History, **Cherry-pick onto…** applies a commit to another local branch. Remote branches in the branch menu check out as local branches that track them.

Merge, Rebase, and Cherry-pick need a clean working tree. When Git stops, a bar above the work area lists unresolved files with **Mark resolved**, **Continue**, **Skip commit** (rebase and cherry-pick), and **Abort**. It reads Git's own state, so it survives a restart. Other branch changes are blocked until you finish or abort.

## Context menus

Right-click works like GitHub Desktop. On the current repository (or any repository in the picker): copy name or path, view on GitHub, open in Terminal, show in the file manager, open in your editor, and remove from the list. On a changed file or a selection: discard changes, ignore a file, folder, or extension, include or exclude, copy paths, and open it. Discard moves the working copy to the freedesktop Trash first, so it can be recovered. On a commit in History: checkout, revert, create a branch, cherry-pick, copy the SHA, and view on GitHub. History also lists each commit's changed files next to a per-file diff.

## Stash and hunks

**Stash changes…** in Changes stashes work, with an explicit **Include untracked files** option. **Restore** applies a stash with its staging and keeps it until you drop it. To stage or unstage part of a tracked text file, click a changed line's line numbers, or drag down them to take several lines of the same hunk at once. Click the handle beside a change, or the gutter of its `@@` header row, to take the whole hunk. Blue line numbers mark staged changes. Untracked, binary, renamed, and conflicted files use the whole-file checkboxes. The gear in the diff header switches between the unified and split diff.

## Sidebars

Drag the divider beside Changes, History, or the Settings navigation to resize it. The toggle at the top of each sidebar folds or expands it. Git Workspace remembers each sidebar's width and folded state. With a divider focused, use the arrow keys to resize it.

## GitHub accounts

Use **Settings → GitHub accounts** or the account icon in the toolbar to sign in through GitHub CLI, see the active account and profile picture, or switch to another saved account. Sign-in opens GitHub's device verification page in your browser. Install a current version of GitHub CLI that supports `gh auth status --json`.

If Git HTTPS uses another credential helper, **Set up Git HTTPS** configures the GitHub CLI helper for github.com after you confirm. This affects other Git tools too. SSH connections use your SSH configuration, and commit authors use your Git configuration.

## Develop

Use Node 22, pnpm 10.29.3, stable Rust, and the [Tauri Ubuntu build dependencies](https://v2.tauri.app/start/prerequisites/).

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
pnpm package:deb
```

`pnpm package:deb` builds the `.deb` and deletes bundles from older versions, so `bundle/deb` only holds the current one.

The Rust Git layer is in `crates/git-core`. Tauri registers explicitly opened worktrees and exposes typed commands from `src-tauri`. The React app is in `src`. Run `pnpm bindings:generate` after editing IPC types in Rust.

## Verify

```sh
pnpm test
pnpm build
cargo clippy --workspace --all-targets -- -D warnings
```

The native smoke test uses the packaged binary, a temporary checkout, and a local bare remote. Install `webkit2gtk-driver` and `tauri-driver`, then start `tauri-driver` in one terminal and run this in another:

```sh
python3 tests/native_smoke.py src-tauri/target/release/git-workspace
```

For headless runs, start the driver inside an Xvfb session. Run the app with an isolated `HOME` and `XDG_*` directories, because it reopens your saved repositories and the test expects a fresh profile. The smoke test checks the application through the real WebKit window and asserts the resulting Git state. It covers compare, cherry-pick, remote branch checkout, hunk staging, stash (including a conflicting restore), rebase abort, merge conflict recovery, skipping an empty cherry-pick, the context menus, and the 850×580, 1024×768, and 1366×768 layouts. Optional hook qualification takes a disposable Zenurture checkout with dependencies installed and a local bare remote.
