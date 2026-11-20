mod support;

use git_gui_core::{Execution, IntegrationKind, Repository};
use support::{Checkout, commit_file};

fn quiet() -> Execution<'static> {
    Execution::new(&|_| {})
}

fn history() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "notes.txt", "one\n", "first");
    commit_file(&checkout, "notes.txt", "one\ntwo\n", "second");
    commit_file(&checkout, "other.txt", "other\n", "third");
    checkout
}

fn id_of(checkout: &Checkout, revision: &str) -> String {
    checkout.git(&["rev-parse", revision]).trim().to_owned()
}

#[test]
fn reverting_a_commit_adds_a_commit_that_undoes_only_that_change() {
    let checkout = history();
    let repository = Repository::open(checkout.path()).unwrap();

    repository
        .revert_commit(&id_of(&checkout, "HEAD~1"), &quiet())
        .unwrap();

    assert_eq!(
        std::fs::read_to_string(checkout.path().join("notes.txt")).unwrap(),
        "one\n"
    );
    assert!(checkout.path().join("other.txt").exists());
    assert_eq!(
        checkout.git(&["log", "-1", "--format=%s"]).trim(),
        "Revert \"second\""
    );
    assert_eq!(checkout.git(&["rev-list", "--count", "HEAD"]).trim(), "4");
}

#[test]
fn reverting_needs_a_clean_tree_and_refuses_merge_commits() {
    let checkout = history();
    checkout.git(&["switch", "-c", "side", "HEAD~1"]);
    commit_file(&checkout, "side.txt", "side\n", "side");
    checkout.git(&["switch", "main"]);
    checkout.git(&["merge", "--no-ff", "-m", "merge side", "side"]);
    let repository = Repository::open(checkout.path()).unwrap();

    let merge = repository
        .revert_commit(&id_of(&checkout, "HEAD"), &quiet())
        .unwrap_err();
    assert!(merge.contains("merge commit"), "{merge}");

    checkout.write("notes.txt", "dirty\n");
    let dirty = repository
        .revert_commit(&id_of(&checkout, "HEAD~1"), &quiet())
        .unwrap_err();
    assert!(dirty.contains("clean working tree"), "{dirty}");
}

#[test]
fn a_conflicting_revert_pauses_and_can_be_aborted_back_to_the_starting_commit() {
    let checkout = history();
    commit_file(&checkout, "notes.txt", "one\nchanged later\n", "fourth");
    let repository = Repository::open(checkout.path()).unwrap();
    let head = id_of(&checkout, "HEAD");

    let error = repository
        .revert_commit(&id_of(&checkout, "HEAD~2"), &quiet())
        .unwrap_err();
    assert!(
        error.contains("resolve") || error.contains("conflict") || error.contains("revert"),
        "{error}"
    );
    let recovery = repository.recovery().unwrap();
    assert_eq!(recovery.kind, Some(IntegrationKind::Revert));
    assert_eq!(recovery.unmerged.len(), 1);

    repository.abort_integration(&quiet()).unwrap();
    assert_eq!(repository.recovery().unwrap().kind, None);
    assert_eq!(id_of(&checkout, "HEAD"), head);
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("notes.txt")).unwrap(),
        "one\nchanged later\n"
    );
}

#[test]
fn checking_out_a_commit_detaches_head_there() {
    let checkout = history();
    let repository = Repository::open(checkout.path()).unwrap();
    let target = id_of(&checkout, "HEAD~1");

    repository.checkout_commit(&target, &quiet()).unwrap();

    assert_eq!(id_of(&checkout, "HEAD"), target);
    assert_eq!(repository.status().unwrap().branch, None);
}

#[test]
fn a_new_branch_can_start_from_a_chosen_commit() {
    let checkout = history();
    let repository = Repository::open(checkout.path()).unwrap();
    let target = id_of(&checkout, "HEAD~2");
    let main = id_of(&checkout, "main");

    repository
        .create_branch_at("from-first", &target, &quiet())
        .unwrap();

    assert_eq!(
        checkout.git(&["branch", "--show-current"]).trim(),
        "from-first"
    );
    assert_eq!(id_of(&checkout, "HEAD"), target);
    assert_eq!(id_of(&checkout, "main"), main);
    assert!(
        repository
            .create_branch_at("--bad", &target, &quiet())
            .is_err()
    );
}
