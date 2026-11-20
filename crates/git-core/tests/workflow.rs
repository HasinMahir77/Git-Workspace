mod support;

use git_gui_core::{Execution, Repository};
use support::Checkout;

#[test]
fn opens_a_subdirectory_and_reports_untracked_changes_on_an_unborn_branch() {
    let checkout = Checkout::new();
    let nested = checkout.path().join("src");
    std::fs::create_dir(&nested).unwrap();
    checkout.write("src/report [draft].txt", "new content\n");

    let repository = Repository::open(&nested).unwrap();
    let status = repository.status().unwrap();

    assert_eq!(repository.root(), checkout.path());
    assert_eq!(status.branch.as_deref(), Some("main"));
    assert!(status.is_unborn);
    assert_eq!(status.files[0].path, "src/report [draft].txt");
    assert_eq!(status.files[0].unstaged, "?");
}

#[test]
fn stages_and_unstages_only_the_selected_literal_path_before_the_first_commit() {
    let checkout = Checkout::new();
    checkout.write("notes[1].txt", "selected\n");
    checkout.write("notes1.txt", "other\n");
    let repository = Repository::open(checkout.path()).unwrap();
    let status = repository.status().unwrap();
    let selected = status
        .files
        .iter()
        .find(|file| file.path == "notes[1].txt")
        .unwrap();

    repository.stage(&selected.id).unwrap();
    let status = repository.status().unwrap();
    assert_eq!(
        status
            .files
            .iter()
            .filter(|file| file.staged == "A")
            .count(),
        1
    );
    repository.unstage(&selected.id).unwrap();
    assert!(
        repository
            .status()
            .unwrap()
            .files
            .iter()
            .all(|file| file.unstaged == "?")
    );
    assert_eq!(
        std::fs::read_to_string(checkout.path().join(&selected.path)).unwrap(),
        "selected\n"
    );
}

#[test]
fn streams_a_rejecting_commit_hook_and_keeps_the_index() {
    use std::sync::Mutex;
    let checkout = Checkout::new();
    support::install_hook(
        &checkout,
        "commit-msg",
        "printf '\\033[31mticket scope required\\033[0m\\n' >&2; exit 1",
    );
    checkout.write("notes.txt", "staged\n");
    let repository = Repository::open(checkout.path()).unwrap();
    let id = repository
        .status()
        .unwrap()
        .files
        .into_iter()
        .find(|file| file.path == "notes.txt")
        .unwrap()
        .id;
    repository.stage(&id).unwrap();
    let output = Mutex::new(String::new());

    let result = repository.commit(
        "update notes",
        "",
        &Execution::new(&|line| output.lock().unwrap().push_str(&line)),
    );

    assert!(result.is_err());
    assert_eq!(output.into_inner().unwrap().trim(), "ticket scope required");
    let status = repository.status().unwrap();
    assert!(status.is_unborn);
    assert!(
        status
            .files
            .iter()
            .any(|file| file.id == id && file.staged == "A")
    );
}

#[test]
fn a_rejecting_pre_push_hook_keeps_the_remote_ref_unchanged() {
    use std::sync::Mutex;
    let checkout = Checkout::new();
    let remote = tempfile::tempdir().unwrap();
    support::git(remote.path(), &["init", "--bare", "--initial-branch=main"]);
    checkout.git(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    checkout.write("notes.txt", "to publish\n");
    checkout.git(&["add", "notes.txt"]);
    checkout.git(&["commit", "-m", "fixture"]);
    support::install_hook(
        &checkout,
        "pre-push",
        "echo 'pre-push quality gate failed' >&2; exit 1",
    );
    let repository = Repository::open(checkout.path()).unwrap();
    let output = Mutex::new(String::new());

    let result = repository.push(
        Some("origin"),
        &Execution::new(&|line| output.lock().unwrap().push_str(&line)),
    );

    assert!(result.is_err());
    assert!(
        output
            .into_inner()
            .unwrap()
            .contains("pre-push quality gate failed")
    );
    assert!(support::git(remote.path(), &["for-each-ref", "refs/heads/"]).is_empty());
    assert!(repository.status().unwrap().upstream.is_none());
}

#[test]
fn reads_separate_staged_and_working_diffs_and_opens_commit_history() {
    let checkout = Checkout::new();
    checkout.write("notes.txt", "original\n");
    checkout.git(&["add", "notes.txt"]);
    checkout.git(&["commit", "-m", "Initial notes"]);
    checkout.write("notes.txt", "staged edit\n");
    checkout.git(&["add", "notes.txt"]);
    checkout.write("notes.txt", "working edit\n");
    let repository = Repository::open(checkout.path()).unwrap();
    let file = repository.status().unwrap().files.remove(0);

    let staged = repository.diff(&file.id, true).unwrap();
    let unstaged = repository.diff(&file.id, false).unwrap();
    assert!(staged.contains("-original\n+staged edit"));
    assert!(unstaged.contains("-staged edit\n+working edit"));
    let history = repository.history(0).unwrap();
    assert_eq!(history[0].summary, "Initial notes");
    assert!(
        repository
            .commit_diff(&history[0].id, &[])
            .unwrap()
            .contains("+original")
    );
}

#[test]
fn pushes_to_the_fork_without_changing_the_pull_upstream_or_following_tags() {
    let checkout = Checkout::new();
    checkout.write("notes.txt", "initial\n");
    checkout.git(&["add", "notes.txt"]);
    checkout.git(&["commit", "-m", "base"]);
    let upstream = tempfile::tempdir().unwrap();
    let fork = tempfile::tempdir().unwrap();
    for (name, remote) in [("upstream", &upstream), ("fork", &fork)] {
        support::git(remote.path(), &["init", "--bare", "--initial-branch=main"]);
        checkout.git(&["remote", "add", name, remote.path().to_str().unwrap()]);
        checkout.git(&["push", name, "main"]);
    }
    checkout.git(&["branch", "--set-upstream-to=upstream/main"]);
    checkout.git(&["config", "branch.main.pushRemote", "fork"]);
    checkout.git(&["config", "push.followTags", "true"]);
    checkout.write("notes.txt", "second\n");
    checkout.git(&["commit", "-am", "update"]);
    checkout.git(&["tag", "-am", "local tag", "local-tag"]);
    let repository = Repository::open(checkout.path()).unwrap();

    repository.push(None, &Execution::new(&|_| {})).unwrap();

    assert_eq!(
        support::git(fork.path(), &["rev-parse", "main"]),
        checkout.git(&["rev-parse", "main"])
    );
    assert_ne!(
        support::git(upstream.path(), &["rev-parse", "main"]),
        checkout.git(&["rev-parse", "main"])
    );
    assert!(support::git(fork.path(), &["tag", "--list"]).is_empty());
    assert_eq!(
        repository.status().unwrap().upstream.as_deref(),
        Some("upstream/main")
    );
}

#[test]
fn cancels_a_running_commit_hook_without_completing_the_commit() {
    use git_gui_core::Cancellation;
    use std::{sync::mpsc, time::Duration};

    let checkout = Checkout::new();
    support::install_hook(&checkout, "pre-commit", "echo 'waiting in hook'; sleep 30");
    checkout.write("notes.txt", "staged\n");
    checkout.git(&["add", "notes.txt"]);
    let repository = Repository::open(checkout.path()).unwrap();
    let cancellation = Cancellation::default();
    let (send, receive) = mpsc::channel();

    std::thread::scope(|scope| {
        let worker = scope.spawn(|| {
            let emit = |line| {
                let _ = send.send(line);
            };
            repository.commit("update", "", &Execution::cancellable(&emit, &cancellation))
        });
        assert!(
            receive
                .recv_timeout(Duration::from_secs(5))
                .unwrap()
                .contains("waiting in hook")
        );
        cancellation.cancel();
        assert!(worker.join().unwrap().unwrap_err().contains("cancelled"));
    });

    assert!(repository.status().unwrap().is_unborn);
}

#[test]
fn linked_worktrees_have_their_own_status_and_share_one_common_directory() {
    let checkout = Checkout::new();
    checkout.write("notes.txt", "main\n");
    checkout.git(&["add", "notes.txt"]);
    checkout.git(&["commit", "-m", "initial"]);
    let sibling = tempfile::tempdir().unwrap();
    let path = sibling.path().join("worktree");
    checkout.git(&["worktree", "add", "-b", "review", path.to_str().unwrap()]);
    std::fs::write(path.join("notes.txt"), "review edit\n").unwrap();
    let original = Repository::open(checkout.path()).unwrap();
    let linked = Repository::open(&path).unwrap();

    assert_eq!(original.common_directory(), linked.common_directory());
    assert_ne!(original.root(), linked.root());
    assert!(original.status().unwrap().files.is_empty());
    assert_eq!(linked.status().unwrap().branch.as_deref(), Some("review"));
    assert_eq!(linked.status().unwrap().files[0].path, "notes.txt");
}

#[test]
fn a_deleted_upstream_does_not_turn_a_push_into_branch_publication() {
    let checkout = Checkout::new();
    checkout.write("notes.txt", "initial\n");
    checkout.git(&["add", "notes.txt"]);
    checkout.git(&["commit", "-m", "base"]);
    let remote = tempfile::tempdir().unwrap();
    support::git(remote.path(), &["init", "--bare", "--initial-branch=main"]);
    checkout.git(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    checkout.git(&["push", "--set-upstream", "origin", "main"]);
    support::git(remote.path(), &["update-ref", "-d", "refs/heads/main"]);
    checkout.git(&["fetch", "--prune", "origin"]);
    let repository = Repository::open(checkout.path()).unwrap();

    assert!(repository.sync_state().unwrap().has_configured_upstream);
    assert!(!repository.status().unwrap().has_upstream_ref);
    assert!(
        repository
            .push(Some("origin"), &Execution::new(&|_| {}))
            .is_err()
    );
    assert!(support::git(remote.path(), &["for-each-ref", "refs/heads/"]).is_empty());
}
