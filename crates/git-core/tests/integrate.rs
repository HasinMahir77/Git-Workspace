mod support;

use git_gui_core::{Execution, IntegrationKind, Repository};
use support::{Checkout, commit_file, diverged_checkout};

fn quiet() -> Execution<'static> {
    Execution::new(&|_| {})
}

fn rebase(repository: &Repository, onto: &str) -> Result<(), String> {
    let expected = repository.compare(onto).unwrap().other_id;
    repository.rebase(onto, &expected, &quiet())
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
fn rebases_the_current_branch_onto_another_and_changes_only_the_current_branch() {
    let checkout = diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let feature = checkout.git(&["rev-parse", "feature"]);
    let old_head = checkout.git(&["rev-parse", "HEAD"]);

    rebase(&repository, "feature").unwrap();

    assert_eq!(checkout.git(&["rev-parse", "feature"]), feature);
    assert_ne!(checkout.git(&["rev-parse", "HEAD"]), old_head);
    assert_eq!(checkout.git(&["rev-parse", "HEAD~1"]), feature);
    assert_eq!(
        checkout.git(&["log", "-1", "--format=%s"]).trim(),
        "main work"
    );
}

#[test]
fn a_conflicting_rebase_pauses_continues_after_resolution_and_survives_reopening() {
    let checkout = conflicting_checkout();
    let repository = Repository::open(checkout.path()).unwrap();

    let error = rebase(&repository, "feature").unwrap_err();

    assert!(error.contains("paused"), "{error}");
    let reopened = Repository::open(checkout.path()).unwrap();
    let recovery = reopened.recovery().unwrap();
    assert_eq!(recovery.kind, Some(IntegrationKind::Rebase));
    assert_eq!(recovery.unmerged[0].path, "shared.txt");
    assert!(reopened.continue_integration(&quiet()).is_err());
    checkout.write("shared.txt", "resolved\n");
    reopened.stage(&recovery.unmerged[0].id).unwrap();
    reopened.continue_integration(&quiet()).unwrap();
    assert_eq!(reopened.recovery().unwrap().kind, None);
    assert_eq!(checkout.git(&["branch", "--show-current"]).trim(), "main");
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("shared.txt")).unwrap(),
        "resolved\n"
    );
}

#[test]
fn aborting_a_rebase_restores_the_original_branch_tip() {
    let checkout = conflicting_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]);
    rebase(&repository, "feature").unwrap_err();

    repository.abort_integration(&quiet()).unwrap();

    assert_eq!(repository.recovery().unwrap().kind, None);
    assert_eq!(checkout.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(checkout.git(&["branch", "--show-current"]).trim(), "main");
}

#[test]
fn rebase_refuses_a_dirty_tree_a_moved_target_and_a_detached_head() {
    let checkout = diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let previewed = repository.compare("feature").unwrap().other_id;
    checkout.git(&["switch", "feature"]);
    commit_file(&checkout, "late.txt", "late\n", "late");
    checkout.git(&["switch", "main"]);

    let stale = repository
        .rebase("feature", &previewed, &quiet())
        .unwrap_err();
    assert!(stale.contains("Refresh"), "{stale}");

    checkout.write("main.txt", "dirty\n");
    let dirty = rebase(&repository, "feature").unwrap_err();
    assert!(dirty.contains("clean working tree"), "{dirty}");
    checkout.git(&["checkout", "--", "main.txt"]);

    checkout.git(&["switch", "--detach"]);
    let detached = rebase(&repository, "feature").unwrap_err();
    assert!(detached.contains("Switch to a branch"), "{detached}");
}

#[test]
fn cherry_picks_a_source_only_commit_into_the_current_branch() {
    let checkout = diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let commit = repository.compare("feature").unwrap().other_only[0]
        .id
        .clone();

    repository.cherry_pick(&commit, None, &quiet()).unwrap();

    assert!(checkout.path().join("feature.txt").exists());
    assert_eq!(
        checkout.git(&["log", "-1", "--format=%s"]).trim(),
        "feature work"
    );
    assert_eq!(checkout.git(&["rev-parse", "feature"]).trim(), commit);
}

#[test]
fn cherry_picks_onto_another_branch_and_leaves_it_checked_out() {
    let checkout = diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let commit = checkout.git(&["rev-parse", "main"]).trim().to_string();

    repository
        .cherry_pick(&commit, Some("feature"), &quiet())
        .unwrap();

    assert_eq!(
        checkout.git(&["branch", "--show-current"]).trim(),
        "feature"
    );
    assert!(checkout.path().join("main.txt").exists());
    assert_eq!(
        checkout.git(&["log", "-1", "--format=%s"]).trim(),
        "main work"
    );
}

#[test]
fn a_conflicting_cherry_pick_pauses_and_abort_keeps_the_destination_checked_out() {
    let checkout = conflicting_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let commit = checkout.git(&["rev-parse", "main"]).trim().to_string();
    let feature = checkout.git(&["rev-parse", "feature"]);

    let error = repository
        .cherry_pick(&commit, Some("feature"), &quiet())
        .unwrap_err();

    assert!(error.contains("paused"), "{error}");
    assert_eq!(
        repository.recovery().unwrap().kind,
        Some(IntegrationKind::CherryPick)
    );
    repository.abort_integration(&quiet()).unwrap();
    assert_eq!(repository.recovery().unwrap().kind, None);
    assert_eq!(
        checkout.git(&["branch", "--show-current"]).trim(),
        "feature"
    );
    assert_eq!(checkout.git(&["rev-parse", "feature"]), feature);
    assert_eq!(checkout.git(&["rev-parse", "main"]).trim(), commit);
}

#[test]
fn a_cherry_pick_that_becomes_empty_can_be_skipped() {
    let checkout = diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let commit = checkout.git(&["rev-parse", "main"]).trim().to_string();
    repository
        .cherry_pick(&commit, Some("feature"), &quiet())
        .unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]);

    let error = repository.cherry_pick(&commit, None, &quiet()).unwrap_err();

    assert!(error.contains("paused"), "{error}");
    repository.skip_integration(&quiet()).unwrap();
    assert_eq!(repository.recovery().unwrap().kind, None);
    assert_eq!(checkout.git(&["rev-parse", "HEAD"]), head);
}

#[test]
fn merge_commits_and_non_commit_ids_are_refused_before_changing_anything() {
    let checkout = diverged_checkout();
    checkout.git(&["merge", "--no-edit", "feature"]);
    let repository = Repository::open(checkout.path()).unwrap();
    checkout.git(&["branch", "other", "HEAD~1"]);
    let merge_commit = checkout.git(&["rev-parse", "HEAD"]).trim().to_string();
    let head = checkout.git(&["rev-parse", "other"]);

    let error = repository
        .cherry_pick(&merge_commit, Some("other"), &quiet())
        .unwrap_err();
    assert!(error.contains("merge commit"), "{error}");
    assert_eq!(checkout.git(&["rev-parse", "other"]), head);
    assert_eq!(checkout.git(&["branch", "--show-current"]).trim(), "main");
    assert!(repository.cherry_pick("HEAD", None, &quiet()).is_err());
}

#[test]
fn a_destination_checked_out_in_a_linked_worktree_is_rejected_without_changes() {
    let checkout = diverged_checkout();
    let linked = tempfile::tempdir().unwrap();
    let path = linked.path().join("wt");
    checkout.git(&["worktree", "add", path.to_str().unwrap(), "feature"]);
    let repository = Repository::open(checkout.path()).unwrap();
    let commit = checkout.git(&["rev-parse", "main"]).trim().to_string();
    let feature = checkout.git(&["rev-parse", "feature"]);

    assert!(
        repository
            .cherry_pick(&commit, Some("feature"), &quiet())
            .is_err()
    );

    assert_eq!(checkout.git(&["rev-parse", "feature"]), feature);
    assert_eq!(checkout.git(&["branch", "--show-current"]).trim(), "main");
}

fn checkout_with_remote_branch() -> (Checkout, Checkout) {
    let checkout = diverged_checkout();
    let remote = Checkout::new();
    remote.git(&["config", "receive.denyCurrentBranch", "ignore"]);
    checkout.git(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    checkout.git(&["push", "origin", "feature:feature"]);
    checkout.git(&["fetch", "origin"]);
    checkout.git(&["branch", "-D", "feature"]);
    (checkout, remote)
}

#[test]
fn checking_out_a_remote_branch_creates_a_local_branch_that_tracks_it() {
    let (checkout, _remote) = checkout_with_remote_branch();
    let repository = Repository::open(checkout.path()).unwrap();

    repository
        .checkout_remote("origin/feature", &quiet())
        .unwrap();

    assert_eq!(
        checkout.git(&["branch", "--show-current"]).trim(),
        "feature"
    );
    assert_eq!(
        checkout
            .git(&["rev-parse", "--abbrev-ref", "feature@{upstream}"])
            .trim(),
        "origin/feature"
    );
}

#[test]
fn an_existing_matching_local_branch_is_reused_and_a_colliding_one_is_explained() {
    let (checkout, _remote) = checkout_with_remote_branch();
    checkout.git(&["branch", "--track", "feature", "origin/feature"]);
    let repository = Repository::open(checkout.path()).unwrap();
    repository
        .checkout_remote("origin/feature", &quiet())
        .unwrap();
    assert_eq!(
        checkout.git(&["branch", "--show-current"]).trim(),
        "feature"
    );

    checkout.git(&["switch", "main"]);
    checkout.git(&["branch", "--unset-upstream", "feature"]);
    let error = repository
        .checkout_remote("origin/feature", &quiet())
        .unwrap_err();

    assert!(error.contains("already exists"), "{error}");
    assert_eq!(checkout.git(&["branch", "--show-current"]).trim(), "main");
}
