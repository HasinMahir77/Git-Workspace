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
        self.click(f"//button[normalize-space()={json.dumps(text, ensure_ascii=False)}]", "xpath")

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


def repository_cell_follows(desktop, panel_selector):
    if panel_selector != ".file-panel":
        return True
    return round(desktop.bounds(".repository-heading")["width"]) == round(desktop.bounds(panel_selector)["width"])


def verify_sidebar(desktop, label, panel_selector):
    previous = desktop.bounds(panel_selector)["width"]
    desktop.drag_divider(label, 46)
    eventually(lambda: desktop.bounds(panel_selector)["width"] > previous + 30)
    eventually(lambda: repository_cell_follows(desktop, panel_selector))
    resized = desktop.bounds(panel_selector)["width"]
    desktop.click(f"button[aria-label='Collapse {label} sidebar']")
    eventually(lambda: desktop.bounds(panel_selector)["width"] < 50)
    eventually(lambda: repository_cell_follows(desktop, panel_selector))
    desktop.click(f"button[aria-label='Expand {label} sidebar']")
    eventually(lambda: desktop.bounds(panel_selector)["width"] == resized)
    eventually(lambda: repository_cell_follows(desktop, panel_selector))
    eventually(lambda: desktop.send("POST", "/execute/sync", {
        "script": "return document.getAnimations().every(animation => animation.playState !== 'running');",
        "args": [],
    }))
    return resized


def qualify_sidebars(desktop):
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

    desktop.click("input[aria-label='Stage notes.txt']")
    desktop.locate("input[aria-label='Unstage notes.txt']")
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
    desktop.click("input[aria-label='Stage notes.txt']")
    desktop.locate("input[aria-label='Unstage notes.txt']")
    desktop.enter("input[name='commit-summary']", "fix(DESK-101): push update")
    desktop.button("Commit to main")
    desktop.click(".sync-control[aria-label='Push']")
    desktop.click("dialog[open] button.primary")
    eventually(lambda: git(origin, "rev-parse", "main") == git(repo, "rev-parse", "main"))

    qualify_compare(desktop, repo, evidence)
    qualify_workflows(desktop, repo, evidence)
    qualify_branch_workflows(desktop, repo, origin)
    qualify_settings(desktop, evidence)
    qualify_sidebars(desktop)
    print("Packaged Tauri smoke passed: checkout, diff, stage, hook rejection and cancellation, history, branches, compare, cherry-pick, hunk staging, stash, layout, rebase abort, merge conflict recovery, remote checkout, History cherry-pick, skipping an empty cherry-pick, stash conflict, publish, clone, fetch, pull, and push.")


def qualify_compare(desktop, repo, evidence):
    git(repo, "switch", "-c", "compare-target")
    (repo / "target.txt").write_text("Only on the target\n")
    git(repo, "add", "target.txt")
    git(repo, "commit", "-m", "fix(DESK-101): target work")
    git(repo, "switch", "main")
    desktop.click("button[aria-label='Refresh working tree']")
    desktop.enter("input[name='commit-summary']", "draft survives compare")

    desktop.click("button[aria-label='Branches']")
    desktop.button("Compare branches…")
    desktop.contains(".compare-heading", "Current branch")
    desktop.click("//option[normalize-space()='compare-target']", "xpath")
    desktop.contains(".compare-commits", "fix(DESK-101): target work")
    desktop.contains(".diff-scroll", "Only on the target")
    desktop.contains(".diff-heading", "Merge base")
    assert git(repo, "branch", "--show-current") == "main"
    if evidence:
        desktop.screenshot(evidence / "compare.png")

    desktop.click("button[aria-label='Close comparison']")
    summary = desktop.locate("input[name='commit-summary']")
    assert desktop.send("GET", f"/element/{summary}/property/value") == "draft survives compare"
    assert git(repo, "branch", "--show-current") == "main"


def compare_with(desktop, branch):
    desktop.click("button[aria-label='Branches']")
    desktop.button("Compare branches…")
    desktop.click(f"//option[normalize-space()='{branch}']", "xpath")
    desktop.contains(".diff-heading", "Merge base")


def refresh(desktop):
    desktop.click("button[aria-label='Refresh working tree']")


def commit(repo, message):
    git(repo, "commit", "-am", f"fix(DESK-101): {message}")


def qualify_workflows(desktop, repo, evidence):
    # Merge, rebase, and cherry-pick create commits Git words itself, so drop the ticket hook here.
    (repo / ".git" / "desktop-hooks" / "commit-msg").unlink()

    # Cherry-pick the source-only commit from Compare into the checked-out branch.
    compare_with(desktop, "compare-target")
    desktop.button("Cherry-pick into current branch")
    desktop.contains(".merge-row", 'Cherry-pick')
    desktop.click("//div[contains(@class,'merge-row')]//button[normalize-space()='Cherry-pick']", "xpath")
    eventually(lambda: (repo / "target.txt").exists())
    assert git(repo, "log", "-1", "--format=%s") == "fix(DESK-101): target work"
    desktop.click("button[aria-label='Close comparison']")

    # Stage a single hunk, stash with staging, restore it, then drop the stash.
    lines = [f"line {number}" for number in range(1, 31)]
    (repo / "doc.txt").write_text("\n".join(lines) + "\n")
    git(repo, "add", "doc.txt")
    commit(repo, "add doc")
    lines[1], lines[28] = "first edit", "second edit"
    (repo / "doc.txt").write_text("\n".join(lines) + "\n")
    refresh(desktop)
    desktop.contains(".diff-scroll", "second edit")
    desktop.click("(//button[normalize-space()='Stage hunk'])[2]", "xpath")
    eventually(lambda: "second edit" in git(repo, "diff", "--cached"))
    assert "first edit" not in git(repo, "diff", "--cached")
    assert "first edit" in git(repo, "diff")
    qualify_layout(desktop, evidence)

    desktop.button("Stash changes…")
    desktop.click("//form[contains(@class,'stash-form')]//button[normalize-space()='Stash']", "xpath")
    eventually(lambda: git(repo, "stash", "list") != "")
    desktop.contains(".clean-preview", "No local changes")
    desktop.button("Restore")
    eventually(lambda: "second edit" in git(repo, "diff", "--cached"))
    assert "first edit" in git(repo, "diff")
    assert git(repo, "stash", "list") != ""
    desktop.button("Drop")
    desktop.button("Drop stash")
    eventually(lambda: git(repo, "stash", "list") == "")
    git(repo, "reset", "--hard")
    refresh(desktop)
    desktop.contains(".clean-preview", "No local changes")

    # Build two sides that conflict with main on different files.
    base = git(repo, "rev-parse", "HEAD")
    for name in ("c1.txt", "c2.txt"):
        (repo / name).write_text("base\n")
    git(repo, "add", "c1.txt", "c2.txt")
    commit(repo, "conflict base")
    fork = git(repo, "rev-parse", "HEAD")
    for side, name in (("side1", "c1.txt"), ("side2", "c2.txt")):
        git(repo, "switch", "-c", side, fork)
        (repo / name).write_text(f"{side}\n")
        commit(repo, f"{side} edit")
        git(repo, "switch", "main")
    (repo / "c1.txt").write_text("main1\n")
    (repo / "c2.txt").write_text("main2\n")
    commit(repo, "main edits both")
    refresh(desktop)
    before = git(repo, "rev-parse", "HEAD")

    # A conflicting rebase pauses and Abort restores the original tip.
    compare_with(desktop, "side2")
    desktop.button("Rebase current branch onto…")
    desktop.contains(".merge-row", "Commit IDs change")
    desktop.click("//div[contains(@class,'merge-row')]//button[normalize-space()='Rebase']", "xpath")
    desktop.contains(".recovery-bar", "Rebase in progress")
    desktop.contains(".recovery-files", "c2.txt")
    desktop.button("Abort rebase")
    desktop.button("Discard rebase")
    eventually(lambda: not desktop.send("POST", "/execute/sync", {
        "script": "return Boolean(document.querySelector('.recovery-bar'));", "args": []}))
    assert git(repo, "rev-parse", "HEAD") == before
    assert git(repo, "branch", "--show-current") == "main"
    desktop.click("button[aria-label='Close comparison']")

    # A conflicting merge pauses, Continue stays disabled until the file is resolved.
    compare_with(desktop, "side1")
    desktop.button("Merge into current branch")
    desktop.contains(".merge-row", "Merge side1 into main")
    desktop.click("//div[contains(@class,'merge-row')]//button[normalize-space()='Merge']", "xpath")
    desktop.contains(".recovery-bar", "Merge in progress")
    desktop.contains(".recovery-files", "c1.txt")
    assert (repo / ".git" / "MERGE_HEAD").exists()
    continue_button = desktop.locate("//button[normalize-space()='Continue merge']", "xpath")
    assert desktop.send("GET", f"/element/{continue_button}/enabled") is False
    if evidence:
        desktop.screenshot(evidence / "merge-conflict.png")
    (repo / "c1.txt").write_text("resolved\n")
    desktop.button("Mark resolved")
    desktop.button("Continue merge")
    eventually(lambda: not (repo / ".git" / "MERGE_HEAD").exists())
    assert len(git(repo, "rev-list", "--parents", "-n1", "HEAD").split()) == 3
    desktop.click("button[aria-label='Close comparison']")
    refresh(desktop)
    desktop.contains(".clean-preview", "No local changes")


def qualify_branch_workflows(desktop, repo, origin):
    # Check out a remote branch as a local branch that tracks it.
    git(repo, "push", "origin", "side2:remote-feature")
    git(repo, "fetch", "origin")
    desktop.click("button[aria-label='Branches']")
    desktop.click("//button[contains(@class,'branch-item')][contains(normalize-space(),'origin/remote-feature')]", "xpath")
    desktop.contains(".branch-control", "remote-feature")
    assert git(repo, "branch", "--show-current") == "remote-feature"
    assert git(repo, "rev-parse", "--abbrev-ref", "remote-feature@{upstream}") == "origin/remote-feature"
    desktop.click("button[aria-label='Branches']")
    desktop.button("main")
    desktop.contains(".branch-control", "main")

    # Cherry-pick a History commit onto another local branch, which stays checked out.
    (repo / "pick.txt").write_text("pick me\n")
    git(repo, "add", "pick.txt")
    commit(repo, "pick me")
    pick = git(repo, "rev-parse", "HEAD")
    refresh(desktop)
    desktop.click("button[aria-label='History']")
    desktop.contains(".history-item", "fix(DESK-101): pick me")
    pick_onto(desktop, "release-check")
    eventually(lambda: git(repo, "branch", "--show-current") == "release-check")
    assert (repo / "pick.txt").exists()
    assert git(repo, "log", "-1", "--format=%s") == "fix(DESK-101): pick me"

    # The same pick is now empty on release-check, so Git pauses and Skip drops it.
    git(repo, "switch", "main")
    refresh(desktop)
    desktop.click("button[aria-label='History']")
    desktop.contains(".history-item", "fix(DESK-101): pick me")
    tip = git(repo, "rev-parse", "release-check")
    pick_onto(desktop, "release-check")
    desktop.contains(".recovery-bar", "Cherry-pick in progress")
    assert (repo / ".git" / "CHERRY_PICK_HEAD").exists()
    desktop.button("Skip commit")
    eventually(lambda: not (repo / ".git" / "CHERRY_PICK_HEAD").exists())
    assert git(repo, "rev-parse", "HEAD") == tip
    assert git(repo, "branch", "--show-current") == "release-check"
    git(repo, "switch", "main")
    refresh(desktop)
    desktop.click(".file-panel .view-tab[aria-label='Changes']")

    # A stash that conflicts on restore reports the file and stays in the list.
    doc = (repo / "doc.txt").read_text().splitlines()
    doc[4] = "stashed side"
    (repo / "doc.txt").write_text("\n".join(doc) + "\n")
    refresh(desktop)
    desktop.button("Stash changes…")
    desktop.click("//form[contains(@class,'stash-form')]//button[normalize-space()='Stash']", "xpath")
    eventually(lambda: git(repo, "stash", "list") != "")
    doc[4] = "committed side"
    (repo / "doc.txt").write_text("\n".join(doc) + "\n")
    commit(repo, "diverge doc")
    refresh(desktop)
    desktop.button("Restore")
    eventually(lambda: "UU doc.txt" in git(repo, "status", "--porcelain"))
    desktop.contains(".file-list", "doc.txt")
    assert git(repo, "stash", "list") != ""
    assert not desktop.send("POST", "/execute/sync", {
        "script": "return Boolean(document.querySelector('.recovery-bar'));", "args": []})
    git(repo, "reset", "--hard")
    git(repo, "stash", "clear")
    refresh(desktop)
    desktop.contains(".clean-preview", "No local changes")


def pick_onto(desktop, branch):
    desktop.click(f"//div[contains(@class,'merge-row')]//option[normalize-space()='{branch}']", "xpath")
    desktop.button("Cherry-pick onto…")
    desktop.contains(".merge-row", "will be checked out and stay checked out if you abort")
    desktop.click("//div[contains(@class,'merge-row')]//button[normalize-space()='Cherry-pick']", "xpath")


def qualify_layout(desktop, evidence):
    probe = """
      const app = document.scrollingElement;
      const heading = document.querySelector('.diff-heading')?.getBoundingClientRect();
      const area = document.querySelector('.work-area').getBoundingClientRect();
      const diff = document.querySelector('.diff-panel').getBoundingClientRect();
      const list = document.querySelector('.file-list');
      return { shellScrolls: app.scrollHeight > window.innerHeight + 1, headingBottom: heading?.bottom ?? null,
        height: window.innerHeight, diffShare: diff.width / area.width,
        listScrolls: getComputedStyle(list).overflowY, diffScrolls: getComputedStyle(document.querySelector('.diff-scroll')).overflowY };
    """
    original = desktop.send("GET", "/window/rect")
    try:
        for width, height in ((850, 580), (1024, 768), (1366, 768)):
            desktop.send("POST", "/window/rect", {"width": width, "height": height})
            eventually(lambda: desktop.send("POST", "/execute/sync", {"script": "return window.innerWidth;", "args": []}) == width)
            result = desktop.send("POST", "/execute/sync", {"script": probe, "args": []})
            assert not result["shellScrolls"], f"{width}x{height}: app shell scrolls {result}"
            assert result["headingBottom"] is not None and result["headingBottom"] <= result["height"], f"{width}x{height}: diff header hidden {result}"
            assert result["listScrolls"] == "auto" and result["diffScrolls"] == "auto", f"{width}x{height}: panes do not scroll independently {result}"
            if width == 1366:
                assert result["diffShare"] >= 0.7, f"{width}x{height}: diff only {result['diffShare']:.2f} of the workspace"
            if evidence:
                desktop.screenshot(evidence / f"layout-{width}x{height}.png")
    finally:
        desktop.send("POST", "/window/rect", {"width": original["width"], "height": original["height"]})
    print("Layout smoke passed: 850x580, 1024x768, and 1366x768.")


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
    desktop.click("input[aria-label='Stage commitlint.config.ts']")
    desktop.locate("input[aria-label='Unstage commitlint.config.ts']")
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
