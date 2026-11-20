# Git Workspace

An Ubuntu desktop client that runs the installed Git executable. It uses the same Git configuration, credential helpers, SSH agent, signing tools, and hooks as your terminal. Open **Settings → Git environment** to see which tools the desktop session can find.

Open a checkout or clone a repository, review staged and unstaged changes, commit, browse history, switch branches, and sync with configured remotes. Pull uses fast-forward only. Push shows the destination and updates one branch. Git and hook output appears in the operation panel. Use **Open in Terminal** when Git needs a terminal prompt or a workflow such as rebasing a diverged branch.

## Install on Ubuntu

Install the generated `.deb` with Ubuntu's package installer or run:

```sh
sudo apt install "./src-tauri/target/release/bundle/deb/Git Workspace_0.3.0_amd64.deb"
```

Open **Git Workspace** in the app launcher. If your shell sets up tools for a repo's hooks, you can also launch the app by running `git-workspace` from that terminal.

## Workspace and settings

Use the Repository, Branch, and sync controls in the top toolbar. Search your open repositories with **Ctrl+K**, open a local checkout with **Ctrl+O**, and open Settings with **Ctrl+,**. Theme, GitHub accounts, and Git environment diagnostics are in Settings.

## Sidebars

Drag the divider beside Repositories, Changes, History, or the Settings navigation to resize it. The toggle at the top of each sidebar folds or expands it. Git Workspace remembers each sidebar's width and folded state. With a divider focused, use the arrow keys to resize it.

## GitHub accounts

Use **Settings → GitHub accounts** or the account icon in the toolbar to sign in through GitHub CLI, see the active account and profile picture, or switch to another saved account. Sign-in opens GitHub's device verification page in your browser. Install a current version of GitHub CLI that supports `gh auth status --json`.

If Git HTTPS uses another credential helper, **Set up Git HTTPS** configures the GitHub CLI helper for github.com after you confirm. This affects other Git tools too. SSH connections use your SSH configuration, and commit authors use your Git configuration.

## Develop

Use Node 22, pnpm 10.29.3, stable Rust, and the [Tauri Ubuntu build dependencies](https://v2.tauri.app/start/prerequisites/).

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
pnpm tauri build --bundles deb
```

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

For headless runs, start the driver inside an Xvfb session. The smoke test checks the application through the real WebKit window and asserts the resulting Git state. Optional hook qualification takes a disposable Zenurture checkout with dependencies installed and a local bare remote.
