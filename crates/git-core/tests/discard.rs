mod support;

use git_gui_core::Repository;
use support::{Checkout, commit_file};
use tempfile::TempDir;

fn tracked_checkout() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "notes.txt", "one\n", "notes");
    commit_file(&checkout, "other.txt", "other\n", "other");
    checkout
}

fn file_id(repository: &Repository, path: &str) -> String {
    repository
        .status()
        .unwrap()
        .files
        .into_iter()
        .find(|file| file.path == path)
        .unwrap_or_else(|| panic!("{path} is not changed"))
        .id
}

#[test]
fn discarding_a_tracked_file_restores_staged_and_unstaged_edits_from_head() {
    let checkout = tracked_checkout();
    checkout.write("notes.txt", "staged edit\n");
    checkout.git(&["add", "notes.txt"]);
    checkout.write("notes.txt", "staged edit\nunstaged edit\n");
    checkout.write("other.txt", "kept edit\n");
    let repository = Repository::open(checkout.path()).unwrap();
    let trash = TempDir::new().unwrap();

    repository
        .discard(&file_id(&repository, "notes.txt"), trash.path())
        .unwrap();

    assert_eq!(
        std::fs::read_to_string(checkout.path().join("notes.txt")).unwrap(),
        "one\n"
    );
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("other.txt")).unwrap(),
        "kept edit\n"
    );
    assert_eq!(
        std::fs::read_to_string(trash.path().join("files/notes.txt")).unwrap(),
        "staged edit\nunstaged edit\n",
        "the discarded working copy stays recoverable"
    );
    let paths: Vec<_> = repository
        .status()
        .unwrap()
        .files
        .into_iter()
        .map(|f| f.path)
        .collect();
    assert_eq!(paths, ["other.txt"]);
}

#[test]
fn discarding_an_untracked_file_moves_it_to_the_trash_instead_of_deleting_it() {
    let checkout = tracked_checkout();
    checkout.write("scratch.txt", "keep me recoverable\n");
    let repository = Repository::open(checkout.path()).unwrap();
    let trash = TempDir::new().unwrap();

    repository
        .discard(&file_id(&repository, "scratch.txt"), trash.path())
        .unwrap();

    assert!(!checkout.path().join("scratch.txt").exists());
    assert_eq!(
        std::fs::read_to_string(trash.path().join("files/scratch.txt")).unwrap(),
        "keep me recoverable\n"
    );
    let info = std::fs::read_to_string(trash.path().join("info/scratch.txt.trashinfo")).unwrap();
    assert!(info.starts_with("[Trash Info]\nPath="), "{info}");
    assert!(repository.status().unwrap().files.is_empty());
}

#[test]
fn discarding_a_newly_added_file_unstages_it_and_trashes_the_copy() {
    let checkout = tracked_checkout();
    checkout.write("added.txt", "new\n");
    checkout.git(&["add", "added.txt"]);
    let repository = Repository::open(checkout.path()).unwrap();
    let trash = TempDir::new().unwrap();

    repository
        .discard(&file_id(&repository, "added.txt"), trash.path())
        .unwrap();

    assert!(!checkout.path().join("added.txt").exists());
    assert!(trash.path().join("files/added.txt").exists());
    assert_eq!(checkout.git(&["ls-files"]), "notes.txt\nother.txt\n");
}

#[test]
fn discarding_a_deleted_file_brings_it_back_and_discarding_during_a_paused_merge_is_refused() {
    let checkout = tracked_checkout();
    std::fs::remove_file(checkout.path().join("notes.txt")).unwrap();
    let repository = Repository::open(checkout.path()).unwrap();
    let trash = TempDir::new().unwrap();

    repository
        .discard(&file_id(&repository, "notes.txt"), trash.path())
        .unwrap();
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("notes.txt")).unwrap(),
        "one\n"
    );

    let conflict = support::diverged_checkout();
    commit_file(&conflict, "shared.txt", "main\n", "main shared");
    conflict.git(&["switch", "-c", "other", "HEAD~1"]);
    commit_file(&conflict, "shared.txt", "other\n", "other shared");
    let merge = std::process::Command::new("git")
        .current_dir(conflict.path())
        .args(["merge", "main"])
        .output()
        .unwrap();
    assert!(!merge.status.success());
    let repository = Repository::open(conflict.path()).unwrap();
    let error = repository
        .discard(&file_id(&repository, "shared.txt"), trash.path())
        .unwrap_err();
    assert!(error.contains("in progress"), "{error}");
}
