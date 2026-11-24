mod support;

use git_gui_core::{Execution, Repository};
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

fn subjects(checkout: &Checkout) -> Vec<String> {
    checkout
        .git(&["log", "--format=%s"])
        .lines()
        .map(str::to_owned)
        .collect()
}

fn id_of(checkout: &Checkout, revision: &str) -> String {
    checkout.git(&["rev-parse", revision]).trim().to_owned()
}

#[test]
fn undoing_a_commit_keeps_its_changes_staged() {
    let checkout = history();
    let repository = Repository::open(checkout.path()).unwrap();

    repository.undo_commit().unwrap();

    assert_eq!(subjects(&checkout), ["second", "first"]);
    assert_eq!(checkout.git(&["diff", "--cached", "--name-only"]).trim(), "other.txt");
}

#[test]
fn undoing_the_only_commit_leaves_an_unborn_branch_with_staged_files() {
    let checkout = Checkout::new();
    commit_file(&checkout, "a.txt", "a\n", "root");
    let repository = Repository::open(checkout.path()).unwrap();

    repository.undo_commit().unwrap();

    assert!(repository.status().unwrap().is_unborn);
    assert_eq!(checkout.git(&["diff", "--cached", "--name-only"]).trim(), "a.txt");
}

#[test]
fn undoing_a_merge_commit_is_refused() {
    let checkout = support::diverged_checkout();
    checkout.git(&["merge", "--no-ff", "feature", "-m", "merge feature"]);
    let repository = Repository::open(checkout.path()).unwrap();

    let error = repository.undo_commit().unwrap_err();

    assert!(error.contains("merge"), "{error}");
}

#[test]
fn the_head_message_includes_the_body() {
    let checkout = Checkout::new();
    commit_file(&checkout, "a.txt", "a\n", "title line");
    checkout.git(&["commit", "--amend", "-m", "title line", "-m", "longer body"]);
    let repository = Repository::open(checkout.path()).unwrap();

    let message = repository.head_message().unwrap();

    assert_eq!(message.summary, "title line");
    assert_eq!(message.body, "longer body");
}

#[test]
fn amending_replaces_the_message_and_folds_in_staged_changes() {
    let checkout = history();
    checkout.write("extra.txt", "extra\n");
    checkout.git(&["add", "extra.txt"]);
    let repository = Repository::open(checkout.path()).unwrap();

    repository.amend("third, fixed", "", &quiet()).unwrap();

    assert_eq!(subjects(&checkout), ["third, fixed", "second", "first"]);
    assert!(checkout.git(&["show", "--name-only", "--format=", "HEAD"]).contains("extra.txt"));
}

#[test]
fn deleting_a_branch_removes_it_but_never_the_current_one() {
    let checkout = support::diverged_checkout();
    checkout.git(&["merge", "feature", "--no-edit"]);
    let repository = Repository::open(checkout.path()).unwrap();

    repository.delete_branch("feature", false).unwrap();
    assert!(!repository.branches().unwrap().contains(&"feature".to_owned()));

    let error = repository.delete_branch("main", true).unwrap_err();
    assert!(error.contains("current"), "{error}");
}

#[test]
fn deleting_an_unmerged_branch_needs_force() {
    let checkout = support::diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();

    assert!(repository.delete_branch("feature", false).is_err());
    repository.delete_branch("feature", true).unwrap();
    assert!(!repository.branches().unwrap().contains(&"feature".to_owned()));
}

#[test]
fn renaming_a_branch_checks_the_new_name() {
    let checkout = support::diverged_checkout();
    let repository = Repository::open(checkout.path()).unwrap();

    assert!(repository.rename_branch("feature", "bad name").is_err());
    assert!(repository.rename_branch("feature", "-x").is_err());
    repository.rename_branch("feature", "feature/renamed").unwrap();

    let branches = repository.branches().unwrap();
    assert!(branches.contains(&"feature/renamed".to_owned()));
    assert!(!branches.contains(&"feature".to_owned()));
}

#[test]
fn squashing_folds_a_newer_commit_into_an_older_one_and_keeps_the_rest() {
    let checkout = history();
    let repository = Repository::open(checkout.path()).unwrap();
    let target = id_of(&checkout, "HEAD~2");
    let dragged = id_of(&checkout, "HEAD");

    repository.squash(&dragged, &target, &quiet()).unwrap();

    assert_eq!(subjects(&checkout), ["second", "first"]);
    assert!(checkout.path().join("other.txt").exists());
    assert_eq!(checkout.git(&["show", "--name-only", "--format=", "HEAD~1"]).trim(), "notes.txt\nother.txt");
}

#[test]
fn squashing_an_older_commit_onto_a_newer_one_is_refused() {
    let checkout = history();
    let repository = Repository::open(checkout.path()).unwrap();

    let error = repository
        .squash(&id_of(&checkout, "HEAD~2"), &id_of(&checkout, "HEAD"), &quiet())
        .unwrap_err();

    assert!(error.contains("older"), "{error}");
}

#[test]
fn squashing_needs_a_clean_working_tree() {
    let checkout = history();
    checkout.write("notes.txt", "dirty\n");
    let repository = Repository::open(checkout.path()).unwrap();

    let error = repository
        .squash(&id_of(&checkout, "HEAD"), &id_of(&checkout, "HEAD~1"), &quiet())
        .unwrap_err();

    assert!(error.contains("clean"), "{error}");
}

#[test]
fn squashing_into_the_root_commit_works() {
    let checkout = history();
    let repository = Repository::open(checkout.path()).unwrap();

    repository
        .squash(&id_of(&checkout, "HEAD~1"), &id_of(&checkout, "HEAD~2"), &quiet())
        .unwrap();

    assert_eq!(subjects(&checkout), ["third", "first"]);
}
