mod support;

use git_gui_core::Repository;
use support::{Checkout, commit_file, diverged_checkout};

#[test]
fn compares_diverged_branches_and_leaves_the_checkout_untouched() {
    let checkout = diverged_checkout();
    checkout.write("main.txt", "dirty edit\n");
    let repository = Repository::open(checkout.path()).unwrap();
    let head_before = checkout.git(&["rev-parse", "HEAD"]);

    let comparison = repository.compare("feature").unwrap();

    assert_eq!(comparison.current, "main");
    assert_eq!(comparison.other, "feature");
    assert_eq!(comparison.current_only.len(), 1);
    assert_eq!(comparison.current_only[0].summary, "main work");
    assert_eq!(comparison.other_only.len(), 1);
    assert_eq!(comparison.other_only[0].summary, "feature work");
    assert_eq!(
        comparison.merge_base.as_deref(),
        Some(checkout.git(&["merge-base", "main", "feature"]).trim())
    );
    assert!(comparison.diff.contains("+++ b/feature.txt"));
    assert!(!comparison.diff.contains("main.txt"));
    assert_eq!(checkout.git(&["rev-parse", "HEAD"]), head_before);
    assert_eq!(checkout.git(&["branch", "--show-current"]).trim(), "main");
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("main.txt")).unwrap(),
        "dirty edit\n"
    );
}

#[test]
fn identical_branches_have_no_unique_commits_or_changes() {
    let checkout = diverged_checkout();
    checkout.git(&["branch", "twin"]);
    let repository = Repository::open(checkout.path()).unwrap();

    let comparison = repository.compare("twin").unwrap();

    assert!(comparison.current_only.is_empty());
    assert!(comparison.other_only.is_empty());
    assert_eq!(
        comparison.merge_base.as_deref(),
        Some(comparison.current_id.as_str())
    );
    assert!(comparison.diff.is_empty());
}

#[test]
fn unrelated_histories_report_no_merge_base() {
    let checkout = diverged_checkout();
    checkout.git(&["switch", "--orphan", "island"]);
    commit_file(&checkout, "island.txt", "island\n", "island root");
    checkout.git(&["switch", "main"]);
    let repository = Repository::open(checkout.path()).unwrap();

    let comparison = repository.compare("island").unwrap();

    assert_eq!(comparison.merge_base, None);
    assert!(comparison.diff.is_empty());
    assert_eq!(comparison.other_only.len(), 1);
    assert_eq!(comparison.current_only.len(), 2);
}

#[test]
fn a_branch_deleted_after_the_picker_loaded_is_reported_as_unavailable() {
    let checkout = diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    checkout.git(&["branch", "-D", "feature"]);

    let error = repository.compare("feature").unwrap_err();

    assert!(error.contains("no longer available"), "{error}");
}

#[test]
fn compares_against_a_remote_tracking_branch() {
    let checkout = diverged_checkout();
    let remote = Checkout::new();
    remote.git(&["config", "receive.denyCurrentBranch", "ignore"]);
    checkout.git(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    checkout.git(&["push", "origin", "feature:feature"]);
    checkout.git(&["fetch", "origin"]);
    checkout.git(&["branch", "-D", "feature"]);
    let repository = Repository::open(checkout.path()).unwrap();

    let comparison = repository.compare("origin/feature").unwrap();

    assert_eq!(comparison.other, "origin/feature");
    assert_eq!(comparison.other_only[0].summary, "feature work");
}

#[test]
fn rejects_names_that_are_not_branches() {
    let checkout = diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();

    assert!(repository.compare("--output=/tmp/x").is_err());
    assert!(repository.compare("HEAD~1").is_err());
}

#[test]
fn lists_local_and_remote_tracking_branches_separately_without_the_remote_head() {
    let checkout = diverged_checkout();
    let remote = Checkout::new();
    remote.git(&["config", "receive.denyCurrentBranch", "ignore"]);
    checkout.git(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    checkout.git(&["push", "origin", "feature:feature"]);
    checkout.git(&["fetch", "origin"]);
    checkout.git(&["remote", "set-head", "origin", "feature"]);
    let repository = Repository::open(checkout.path()).unwrap();

    let groups = repository.branch_groups().unwrap();

    assert_eq!(groups.local, ["feature", "main"]);
    assert_eq!(groups.remote, ["origin/feature"]);
}
