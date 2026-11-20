"""Exercise the packaged Tauri app with WebKitWebDriver and real local Git repositories."""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ELEMENT = "element-6066-11e4-a52e-4f735466cecf"


def request(server, method, path, data=None):
    body = None if data is None else json.dumps(data).encode()
    message = urllib.request.Request(
        server + path, method=method, data=body, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(message, timeout=25) as response:
            return json.load(response)["value"]
    except urllib.error.HTTPError as error:
        raise RuntimeError(json.load(error)["value"]["message"]) from error


def eventually(action, seconds=15):
    deadline = time.monotonic() + seconds
    last_error = None
    while time.monotonic() < deadline:
        try:
            if result := action():
                return result
        except (OSError, RuntimeError) as error:
            last_error = error
        time.sleep(0.15)
    raise AssertionError(f"Timed out waiting for {action}") from last_error


class Desktop:
    def __init__(self, server, binary):
        self.server = server
        caps = {"capabilities": {"alwaysMatch": {"tauri:options": {"application": str(binary)}}}}
        self.session = request(server, "POST", "/session", caps)["sessionId"]

    def send(self, method, path, data=None):
        return request(self.server, method, f"/session/{self.session}" + path, data)

    def locate(self, selector, strategy="css selector"):
        return eventually(lambda: self.send("POST", "/element", {"using": strategy, "value": selector})[ELEMENT])

    def click(self, selector, strategy="css selector"):
        node = self.locate(selector, strategy)
        eventually(lambda: self.send("GET", f"/element/{node}/enabled"))
        self.send("POST", f"/element/{node}/click", {})

    def button(self, text):
        self.click(f"//button[normalize-space()={json.dumps(text)}]", "xpath")

    def enter(self, selector, value):
        node = self.locate(selector)
        eventually(lambda: self.send("GET", f"/element/{node}/enabled"))
        clear = "\ue009a\ue000\ue003"
        self.send("POST", f"/element/{node}/value", {"text": clear, "value": list(clear)})
        self.send("POST", f"/element/{node}/value", {"text": value, "value": list(value)})
        assert self.send("GET", f"/element/{node}/property/value") == value

    def text(self, selector):
        return self.send("POST", "/execute/sync", {
            "script": "return document.querySelector(arguments[0])?.innerText ?? '';",
            "args": [selector],
        })

    def bounds(self, selector):
        return self.send("POST", "/execute/sync", {
            "script": "return document.querySelector(arguments[0])?.getBoundingClientRect().toJSON();",
            "args": [selector],
        })

    def drag_divider(self, label, distance):
        selector = f"[role='separator'][aria-label='Resize {label} sidebar']"
        bounds = eventually(lambda: self.bounds(selector))
        x = round(bounds["x"] + bounds["width"] / 2)
        y = round(bounds["y"] + bounds["height"] / 3)
        self.send("POST", "/actions", {"actions": [
            {"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
                {"type": "pointerMove", "origin": "viewport", "x": x, "y": y, "duration": 0},
                {"type": "pointerDown", "button": 0},
                {"type": "pointerMove", "origin": "viewport", "x": x + distance, "y": y, "duration": 350},
                {"type": "pointerUp", "button": 0},
            ]},
        ]})
        self.send("DELETE", "/actions")

    def contains(self, selector, text):
        try:
            eventually(lambda: text in self.text(selector))
        except AssertionError as error:
            raise AssertionError(f"Expected {text!r} in {selector!r}, got {self.text(selector)!r}") from error

    def screenshot(self, path):
        if path:
            path.write_bytes(base64.b64decode(self.send("GET", "/screenshot")))

    def close(self):
        self.send("DELETE", "")


def git(path, *args):
    return subprocess.check_output(
        ["git", "-C", str(path), *args],
        stderr=subprocess.PIPE,
        text=True,
        env={**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null"},
    ).strip()


def repository_fixture(root):
    repo, origin = root / "notebook", root / "origin.git"
    repo.mkdir()
    origin.mkdir()
    git(repo, "init", "--initial-branch=main")
    git(repo, "config", "user.name", "Fixture")
    git(repo, "config", "user.email", "fixture@example.test")
    git(repo, "config", "commit.gpgsign", "false")
    git(origin, "init", "--bare", "--initial-branch=main")
    git(repo, "remote", "add", "origin", str(origin))
    hooks = repo / ".git" / "desktop-hooks"
    hooks.mkdir()
    git(repo, "config", "core.hooksPath", str(hooks))
    hook = hooks / "commit-msg"
    hook.write_text("#!/bin/sh\ngrep -q '^fix(DESK-101): ' \"$1\" || { echo 'ticket scope required' >&2; exit 1; }\n")
    hook.chmod(0o755)
    (repo / "notes.txt").write_text("Initial notes\n")
    git(repo, "add", "notes.txt")
    git(repo, "commit", "-m", "fix(DESK-101): initial notes")
    (repo / "notes.txt").write_text("Notes from the desktop\n")
    return repo, origin


def verify_sidebar(desktop, label, panel_selector):
    previous = desktop.bounds(panel_selector)["width"]
    desktop.drag_divider(label, 46)
    eventually(lambda: desktop.bounds(panel_selector)["width"] > previous + 30)
    resized = desktop.bounds(panel_selector)["width"]
    desktop.click(f"button[aria-label='Collapse {label} sidebar']")
    eventually(lambda: desktop.bounds(panel_selector)["width"] < 50)
    desktop.click(f"button[aria-label='Expand {label} sidebar']")
    eventually(lambda: desktop.bounds(panel_selector)["width"] == resized)
    eventually(lambda: desktop.send("POST", "/execute/sync", {
        "script": "return document.getAnimations().every(animation => animation.playState !== 'running');",
        "args": [],
    }))
    return resized


def qualify_sidebars(desktop):
    if desktop.bounds(".rail")["width"] < 50:
        desktop.click("button[aria-label='Expand Repositories sidebar']")
    verify_sidebar(desktop, "Repositories", ".rail")
    resized = verify_sidebar(desktop, "Changes", ".file-panel")
    desktop.click("button[aria-label='History']")
    verify_sidebar(desktop, "History", ".file-panel")
    desktop.click("button[aria-label='Collapse History sidebar']")
    eventually(lambda: desktop.bounds(".file-panel")["width"] == 42)
    bounds = desktop.bounds(".file-panel .view-tab[aria-label='Changes']")
    x, y = round(bounds["x"] + bounds["width"] / 2), round(bounds["y"] + bounds["height"] / 2)
    desktop.send("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
        {"type": "pointerMove", "origin": "viewport", "x": x, "y": y, "duration": 0},
        {"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0},
    ]}]})
    desktop.send("DELETE", "/actions")
    eventually(lambda: desktop.bounds(".file-panel")["width"] == resized)
    desktop.click("button[aria-label='History']")
    eventually(lambda: desktop.bounds(".file-panel")["width"] == 42)
    desktop.click("button[aria-label='Expand History sidebar']")
    eventually(lambda: desktop.bounds(".file-panel")["width"] > 190)
    desktop.click(".file-panel .view-tab[aria-label='Changes']")
    print("Sidebar smoke passed: mouse resize, fold and restore for all three sidebars.")


def qualify_settings(desktop, evidence):
    desktop.click("button[aria-label='Settings']")
    desktop.contains(".settings-bar h1", "Settings")
    assert desktop.bounds(".workspace-bar")["height"] == 0
    desktop.click(".theme-card:has(input[value='dark'])")
    assert desktop.send("POST", "/execute/sync", {
        "script": "return document.documentElement.dataset.theme;",
        "args": [],
    }) == "dark"
    if evidence:
        desktop.screenshot(evidence / "05-settings.png")
    verify_sidebar(desktop, "Settings", ".settings-nav")
    desktop.button("Git environment")
    desktop.contains(".diagnostic", "git version")
    desktop.button("Back to workspace")
    desktop.contains(".repository-heading", "notebook")
    desktop.contains(".clean-preview", "No local changes")
    print("Settings smoke passed: theme selection and environment diagnostics in the dedicated page.")


def run(desktop, root, evidence):
    repo, origin = repository_fixture(root)
    shot = lambda name: desktop.screenshot(evidence / name if evidence else None)
    desktop.button("Open repository")
    desktop.enter("dialog[open] input", str(repo))
    desktop.click("dialog[open] button[type='submit'], dialog[open] button.primary")
    desktop.contains("h1", "notebook")
    desktop.contains(".diff-scroll", "Notes from the desktop")
    shot("01-changes.png")

    desktop.click("button[aria-label='Stage notes.txt']")
    desktop.contains("[aria-label='Staged files']", "notes.txt")
    desktop.enter("input[name='commit-summary']", "missing ticket")
    desktop.button("Commit to main")
    desktop.contains(".output-panel pre", "ticket scope required")
    desktop.locate(".banner[role='alert']")
    shot("02-hook-rejection.png")
    summary = desktop.locate("input[name='commit-summary']")
    assert desktop.send("GET", f"/element/{summary}/property/value") == "missing ticket"

    gate = repo / ".git" / "desktop-hooks" / "pre-commit"
    gate.write_text("#!/bin/sh\necho 'waiting in hook'\nsleep 30\n")
    gate.chmod(0o755)
    desktop.enter("input[name='commit-summary']", "fix(DESK-101): update notes")
    desktop.button("Commit to main")
    desktop.contains(".output-panel pre", "waiting in hook")
    desktop.button("Cancel operation")
    desktop.contains(".banner[role='alert']", "Operation cancelled")
    assert git(repo, "log", "-1", "--format=%s") == "fix(DESK-101): initial notes"
    gate.unlink()

    desktop.button("Commit to main")
    desktop.contains(".file-list", "Working tree clean")
    assert git(repo, "log", "-1", "--format=%s") == "fix(DESK-101): update notes"
    desktop.button("History")
    desktop.contains(".history-item", "fix(DESK-101): update notes")
    desktop.contains(".diff-scroll", "Notes from the desktop")

    desktop.click("button[aria-label='Branches']")
    desktop.button("New branch")
    desktop.enter("input[aria-label='New branch name']", "release-check")
    desktop.button("Create branch")
    desktop.contains(".branch-control", "release-check")
    desktop.click("button[aria-label='Branches']")
    desktop.button("main")
    desktop.contains(".branch-control", "main")

    desktop.click(".sync-control[aria-label='Publish branch']")
    desktop.click("dialog[open] button.primary")
    desktop.contains(".branch-control", "origin/main")
    assert git(origin, "rev-parse", "main") == git(repo, "rev-parse", "main")

    desktop.click("button[aria-label='Switch repository']")
    desktop.button("Clone repository")
    desktop.enter("dialog[open] label:first-of-type input", str(origin))
    desktop.enter("dialog[open] .row input", str(root))
    desktop.enter("dialog[open] label:last-of-type input", "second-checkout")
    desktop.click("dialog[open] button.primary")
    desktop.contains("h1", "second-checkout")

    second = root / "second-checkout"
    git(second, "config", "user.name", "Fixture")
    git(second, "config", "user.email", "fixture@example.test")
    (second / "notes.txt").write_text("Remote update\n")
    git(second, "commit", "-am", "Remote update")
    git(second, "push")
    desktop.click("button[aria-label='Switch repository']")
    desktop.enter("input[aria-label='Search repositories']", "notebook")
    desktop.contains(".repository-options", "notebook")
    assert "second-checkout" not in desktop.text(".repository-options")
    desktop.click(".repository-options .repo")
    desktop.click(".sync-control[aria-label='Fetch']")
    desktop.click(".sync-control[aria-label='Pull']")
    eventually(lambda: (repo / "notes.txt").read_text() == "Remote update\n")
    desktop.contains(".file-list", "Working tree clean")
    assert (repo / "notes.txt").read_text() == "Remote update\n"

    (repo / "notes.txt").write_text("Pushed desktop update\n")
    desktop.click("button[aria-label='Refresh working tree']")
    desktop.click("button[aria-label='Stage notes.txt']")
    desktop.contains("[aria-label='Staged files']", "notes.txt")
    desktop.enter("input[name='commit-summary']", "fix(DESK-101): push update")
    desktop.button("Commit to main")
    desktop.click(".sync-control[aria-label='Push']")
    desktop.click("dialog[open] button.primary")
    eventually(lambda: git(origin, "rev-parse", "main") == git(repo, "rev-parse", "main"))

    qualify_settings(desktop, evidence)
    qualify_sidebars(desktop)
    print("Packaged Tauri smoke passed: checkout, diff, stage, hook rejection and cancellation, history, branches, publish, clone, fetch, pull, and push.")


def open_checkout(desktop, repo):
    desktop.click("button[aria-label='Switch repository']")
    desktop.button("Open repository")
    desktop.enter("dialog[open]:not(.repository-picker) input", str(repo))
    desktop.click("dialog[open]:not(.repository-picker) button.primary")
    desktop.contains("h1", repo.name)


def qualify_hooks(desktop, repo, evidence):
    remote = repo.parent / "origin.git"
    assert Path(git(repo, "remote", "get-url", "origin")).resolve() == remote
    assert git(repo, "status", "--porcelain") == ""
    branch = git(repo, "branch", "--show-current")
    file = repo / "commitlint.config.ts"
    original = file.read_text()
    formatted = original.replace(
        "const Configuration: UserConfig = {",
        "// Desktop hook qualification.\nconst Configuration:UserConfig={",
    )
    assert formatted != original
    file.write_text(formatted)

    open_checkout(desktop, repo)
    desktop.click("button[aria-label='Stage commitlint.config.ts']")
    desktop.contains("[aria-label='Staged files']", "commitlint.config.ts")
    unstaged = "// Keep this edit unstaged."
    file.write_text(formatted + "\n" + unstaged + "\n")
    desktop.enter("input[name='commit-summary']", "fix: missing ticket")
    desktop.button(f"Commit to {branch}")
    desktop.contains(".output-panel pre", "scope")
    assert "const Configuration: UserConfig = {" in git(repo, "show", ":commitlint.config.ts")
    assert unstaged in file.read_text()
    assert unstaged not in git(repo, "show", ":commitlint.config.ts")

    desktop.enter("input[name='commit-summary']", "fix(ABC-123): verify desktop hooks")
    desktop.button(f"Commit to {branch}")
    eventually(lambda: git(repo, "log", "-1", "--format=%s") == "fix(ABC-123): verify desktop hooks")
    assert unstaged in file.read_text()
    assert unstaged not in git(repo, "show", "HEAD:commitlint.config.ts")
    git(repo, "restore", "--worktree", "--", "commitlint.config.ts")

    desktop.click(".sync-control[aria-label='Push']")
    desktop.click("dialog[open] button.primary")
    desktop.contains(".output-panel pre", "typecheck")
    eventually(lambda: not desktop.text(".output-panel [role='status']"), seconds=240)
    if evidence:
        desktop.screenshot(evidence / "03-zenurture-pre-push.png")
    if git(repo, "rev-parse", "HEAD") != git(remote, "rev-parse", f"refs/heads/{branch}"):
        raise AssertionError("Zenurture pre-push did not update the disposable remote:\n" + desktop.text(".output-panel pre")[-6500:])
    print("Zenurture qualification passed: real Husky pre-commit, commit-msg, and pre-push hooks.")


def qualify_org_auth(desktop, repo):
    open_checkout(desktop, repo)
    desktop.click("//header//button[@aria-label='Fetch' or normalize-space()='Fetch']", "xpath")
    eventually(lambda: bool(git(repo, "for-each-ref", "--format=%(objectname)", "refs/remotes/origin/gui-verification")), seconds=90)
    print("Authenticated GitHub organization fetch passed through the packaged Tauri app.")


def qualify_accounts(desktop, evidence):
    desktop.click("button[aria-label='Manage GitHub accounts']")
    desktop.contains(".account-list", "personal-fixture")
    desktop.contains(".account-row:has(.active-badge)", "work-fixture")
    desktop.click("button[aria-label='Switch to personal-fixture']")
    desktop.contains(".account-row:has(.active-badge)", "personal-fixture")

    desktop.button("Add account")
    code = desktop.locate("input[aria-label='One-time device code']")
    assert desktop.send("GET", f"/element/{code}/property/value") == "ABCD-1234"
    desktop.button("Open GitHub")
    desktop.button("Cancel sign-in")
    desktop.button("Add account")
    desktop.contains(".account-row:has(.active-badge)", "work-fixture")

    desktop.button("Set up Git HTTPS")
    desktop.button("Use GitHub CLI")
    desktop.contains(".account-settings", "GitHub CLI is configured for Git HTTPS.")
    if evidence:
        desktop.screenshot(evidence / "04-github-accounts.png")
    desktop.button("Back to workspace")
    print("GitHub account smoke passed: active account, switch, browser code, cancellation, sign-in refresh, and HTTPS setup.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("binary", type=Path)
    parser.add_argument("--server", default="http://127.0.0.1:4444")
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--hooks-checkout", type=Path)
    parser.add_argument("--auth-checkout", type=Path)
    parser.add_argument("--github-accounts-fixture", action="store_true")
    args = parser.parse_args()
    if args.evidence:
        args.evidence.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="git-gui-desktop-") as folder:
        desktop = Desktop(args.server, args.binary.resolve())
        try:
            run(desktop, Path(folder), args.evidence)
            if args.hooks_checkout:
                qualify_hooks(desktop, args.hooks_checkout.resolve(), args.evidence)
            if args.auth_checkout:
                qualify_org_auth(desktop, args.auth_checkout.resolve())
            if args.github_accounts_fixture:
                qualify_accounts(desktop, args.evidence)
        except Exception:
            if args.evidence:
                desktop.screenshot(args.evidence / "failure.png")
            raise
        finally:
            desktop.close()


if __name__ == "__main__":
    main()
