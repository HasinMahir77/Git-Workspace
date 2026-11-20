mod support;

use git_gui_core::{Execution, IntegrationKind, Repository};
use support::{Checkout, commit_file};

fn quiet() -> Execution<'static> {
    Execution::new(&|_| {})
}

fn merge(repository: &Repository, other: &str) -> Result<(), String> {
    let expected = repository.compare(other).unwrap().other_id;
    repository.merge(other, &expected, &quiet())
}

#[test]
fn fast_forwards_a_branch_that_is_strictly_ahead() {
    let checkout = Checkout::new();
    commit_file(&checkout, "base.txt", "base\n", "base");
    checkout.git(&["switch", "-c", "feature"]);
    commit_file(&checkout, "feature.txt", "feature\n", "feature work");
    checkout.git(&["switch", "main"]);
    let repository = Repository::open(checkout.path()).unwrap();

    merge(&repository, "feature").unwrap();

    assert_eq!(
        checkout.git(&["rev-parse", "main"]),
        checkout.git(&["rev-parse", "feature"])
    );
    assert!(checkout.path().join("feature.txt").exists());
}

#[test]
fn merges_diverged_branches_into_a_merge_commit_and_leaves_the_source_alone() {
    let checkout = support::diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let feature_before = checkout.git(&["rev-parse", "feature"]);

    merge(&repository, "feature").unwrap();

    assert_eq!(checkout.git(&["rev-parse", "feature"]), feature_before);
    assert_eq!(
        checkout
            .git(&["rev-list", "--parents", "-n1", "HEAD"])
            .split_whitespace()
            .count(),
        3
    );
    assert!(checkout.path().join("feature.txt").exists());
    assert!(checkout.path().join("main.txt").exists());
}

#[test]
fn a_dirty_working_tree_refuses_the_merge_and_keeps_its_edits() {
    let checkout = support::diverged_checkout();
    checkout.write("main.txt", "uncommitted\n");
    let repository = Repository::open(checkout.path()).unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]);

    let error = merge(&repository, "feature").unwrap_err();

    assert!(error.contains("clean working tree"), "{error}");
    assert_eq!(checkout.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("main.txt")).unwrap(),
        "uncommitted\n"
    );
}

#[test]
fn a_branch_that_moved_after_the_preview_asks_for_a_refresh() {
    let checkout = support::diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let previewed = repository.compare("feature").unwrap().other_id;
    checkout.git(&["switch", "feature"]);
    commit_file(&checkout, "more.txt", "more\n", "late commit");
    checkout.git(&["switch", "main"]);
    let head = checkout.git(&["rev-parse", "HEAD"]);

    let error = repository
        .merge("feature", &previewed, &quiet())
        .unwrap_err();

    assert!(error.contains("Refresh"), "{error}");
    assert_eq!(checkout.git(&["rev-parse", "HEAD"]), head);
}

#[test]
fn merging_a_branch_already_included_reports_already_up_to_date() {
    use std::sync::Mutex;
    let checkout = support::diverged_checkout();
    checkout.git(&["branch", "old", "HEAD~1"]);
    let repository = Repository::open(checkout.path()).unwrap();
    let expected = repository.compare("old").unwrap().other_id;
    let output = Mutex::new(String::new());

    repository
        .merge(
            "old",
            &expected,
            &Execution::new(&|line| output.lock().unwrap().push_str(&line)),
        )
        .unwrap();

    assert!(output.into_inner().unwrap().contains("Already up to date"));
}

#[test]
fn a_rejecting_pre_merge_commit_hook_stops_the_merge_and_keeps_its_output() {
    use std::sync::Mutex;
    let checkout = support::diverged_checkout();
    let hooks = tempfile::tempdir().unwrap();
    checkout.git(&["config", "core.hooksPath", hooks.path().to_str().unwrap()]);
    {
        use std::os::unix::fs::PermissionsExt;
        let hook = hooks.path().join("pre-merge-commit");
        std::fs::write(&hook, "#!/bin/sh\necho 'merge blocked' >&2\nexit 1\n").unwrap();
        std::fs::set_permissions(hook, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    let repository = Repository::open(checkout.path()).unwrap();
    let expected = repository.compare("feature").unwrap().other_id;
    let output = Mutex::new(String::new());

    let result = repository.merge(
        "feature",
        &expected,
        &Execution::new(&|line| output.lock().unwrap().push_str(&line)),
    );

    assert!(result.is_err());
    assert!(output.into_inner().unwrap().contains("merge blocked"));
}

fn conflicting_checkout() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "shared.txt", "base\n", "base");
    checkout.git(&["switch", "-c", "feature"]);
    commit_file(&checkout, "shared.txt", "feature side\n", "feature edit");
    checkout.git(&["switch", "main"]);
    commit_file(&checkout, "shared.txt", "main side\n", "main edit");
    checkout
}

#[test]
fn a_conflicting_merge_pauses_and_lists_the_unresolved_files() {
    let checkout = conflicting_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    assert_eq!(repository.recovery().unwrap().kind, None);

    let error = merge(&repository, "feature").unwrap_err();

    assert!(error.contains("paused"), "{error}");
    let recovery = repository.recovery().unwrap();
    assert_eq!(recovery.kind, Some(IntegrationKind::Merge));
    assert_eq!(recovery.unmerged.len(), 1);
    assert_eq!(recovery.unmerged[0].path, "shared.txt");
}

#[test]
fn continue_is_refused_until_every_conflict_is_marked_resolved() {
    let checkout = conflicting_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    merge(&repository, "feature").unwrap_err();

    let error = repository.continue_integration(&quiet()).unwrap_err();
    assert!(error.contains("unresolved"), "{error}");

    checkout.write("shared.txt", "both sides\n");
    let id = repository.recovery().unwrap().unmerged[0].id.clone();
    repository.stage(&id).unwrap();
    repository.continue_integration(&quiet()).unwrap();

    assert_eq!(repository.recovery().unwrap().kind, None);
    assert_eq!(
        checkout
            .git(&["rev-list", "--parents", "-n1", "HEAD"])
            .split_whitespace()
            .count(),
        3
    );
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("shared.txt")).unwrap(),
        "both sides\n"
    );
}

#[test]
fn abort_restores_the_pre_merge_state() {
    let checkout = conflicting_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]);
    merge(&repository, "feature").unwrap_err();

    repository.abort_integration(&quiet()).unwrap();

    assert_eq!(repository.recovery().unwrap().kind, None);
    assert_eq!(checkout.git(&["rev-parse", "HEAD"]), head);
    assert!(repository.status().unwrap().files.is_empty());
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("shared.txt")).unwrap(),
        "main side\n"
    );
}

#[test]
fn a_paused_merge_blocks_switching_and_starting_another_merge() {
    let checkout = conflicting_checkout();
    checkout.git(&["branch", "other"]);
    let repository = Repository::open(checkout.path()).unwrap();
    merge(&repository, "feature").unwrap_err();

    let switch = repository.switch("other", false, &quiet()).unwrap_err();
    let again = repository
        .merge(
            "other",
            &repository.compare("other").unwrap().other_id,
            &quiet(),
        )
        .unwrap_err();

    assert!(switch.contains("merge is in progress"), "{switch}");
    assert!(again.contains("merge is in progress"), "{again}");
    assert_eq!(checkout.git(&["branch", "--show-current"]).trim(), "main");
}

#[test]
fn finds_a_paused_merge_in_a_linked_worktree_without_touching_the_main_one() {
    let checkout = conflicting_checkout();
    let linked = tempfile::tempdir().unwrap();
    let linked_path = linked.path().join("wt");
    checkout.git(&[
        "worktree",
        "add",
        "-b",
        "wt-branch",
        linked_path.to_str().unwrap(),
        "main",
    ]);
    let main = Repository::open(checkout.path()).unwrap();
    let worktree = Repository::open(&linked_path).unwrap();

    merge(&worktree, "feature").unwrap_err();

    assert_eq!(
        worktree.recovery().unwrap().kind,
        Some(IntegrationKind::Merge)
    );
    assert_eq!(main.recovery().unwrap().kind, None);
}
