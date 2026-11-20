mod support;

use git_gui_core::{Execution, Repository};
use support::{Checkout, commit_file};

fn quiet() -> Execution<'static> {
    Execution::new(&|_| {})
}

fn tracked_checkout() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "notes.txt", "one\n", "notes");
    commit_file(&checkout, "other.txt", "other\n", "other");
    checkout
}

#[test]
fn stashes_staged_and_unstaged_work_then_restores_the_staging_and_keeps_the_stash() {
    let checkout = tracked_checkout();
    checkout.write("notes.txt", "staged edit\n");
    checkout.git(&["add", "notes.txt"]);
    checkout.write("other.txt", "unstaged edit\n");
    let repository = Repository::open(checkout.path()).unwrap();

    repository.stash_push(false, &quiet()).unwrap();
    assert!(repository.status().unwrap().files.is_empty());
    let stashes = repository.stashes().unwrap();
    assert_eq!(stashes.len(), 1);
    assert!(
        stashes[0].message.contains("WIP on main"),
        "{}",
        stashes[0].message
    );

    repository.stash_apply(&stashes[0].id, &quiet()).unwrap();

    let files = repository.status().unwrap().files;
    let notes = files.iter().find(|file| file.path == "notes.txt").unwrap();
    let other = files.iter().find(|file| file.path == "other.txt").unwrap();
    assert_eq!((notes.staged.as_str(), notes.unstaged.as_str()), ("M", "."));
    assert_eq!((other.staged.as_str(), other.unstaged.as_str()), (".", "M"));
    assert_eq!(repository.stashes().unwrap().len(), 1);

    repository.stash_drop(&stashes[0].id).unwrap();
    assert!(repository.stashes().unwrap().is_empty());
}

#[test]
fn untracked_files_are_stashed_only_when_requested() {
    let checkout = tracked_checkout();
    checkout.write("scratch.txt", "new\n");
    let repository = Repository::open(checkout.path()).unwrap();

    let error = repository.stash_push(false, &quiet()).unwrap_err();
    assert!(error.contains("Include untracked files"), "{error}");
    assert!(checkout.path().join("scratch.txt").exists());

    repository.stash_push(true, &quiet()).unwrap();
    assert!(!checkout.path().join("scratch.txt").exists());
    let stash = repository.stashes().unwrap().remove(0);
    repository.stash_apply(&stash.id, &quiet()).unwrap();
    assert!(checkout.path().join("scratch.txt").exists());
}

#[test]
fn a_conflicting_restore_reports_the_paths_and_keeps_the_stash() {
    let checkout = tracked_checkout();
    checkout.write("notes.txt", "stashed side\n");
    let repository = Repository::open(checkout.path()).unwrap();
    repository.stash_push(false, &quiet()).unwrap();
    commit_file(&checkout, "notes.txt", "committed side\n", "diverge");
    let stash = repository.stashes().unwrap().remove(0);

    assert!(repository.stash_apply(&stash.id, &quiet()).is_err());

    let recovery = repository.recovery().unwrap();
    assert_eq!(recovery.kind, None);
    assert_eq!(recovery.unmerged[0].path, "notes.txt");
    assert_eq!(repository.stashes().unwrap().len(), 1);
}

#[test]
fn dropping_refuses_a_stash_entry_that_moved_since_it_was_reviewed() {
    let checkout = tracked_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    checkout.write("notes.txt", "first\n");
    repository.stash_push(false, &quiet()).unwrap();
    let reviewed = repository.stashes().unwrap().remove(0);
    checkout.write("notes.txt", "second\n");
    repository.stash_push(false, &quiet()).unwrap();

    repository.stash_drop(&reviewed.id).unwrap();

    let remaining = repository.stashes().unwrap();
    assert_eq!(remaining.len(), 1);
    assert_ne!(remaining[0].id, reviewed.id);
    assert!(repository.stash_drop(&reviewed.id).is_err());
    assert_eq!(repository.stashes().unwrap().len(), 1);
}
