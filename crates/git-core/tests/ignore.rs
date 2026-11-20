mod support;

use git_gui_core::Repository;
use support::{Checkout, commit_file};

#[test]
fn ignoring_a_path_hides_the_untracked_file_and_keeps_existing_rules() {
    let checkout = Checkout::new();
    commit_file(&checkout, ".gitignore", "target", "ignore target");
    checkout.write("debug.log", "noise\n");
    checkout.write("keep.txt", "keep\n");
    let repository = Repository::open(checkout.path()).unwrap();

    repository.add_to_gitignore("/debug.log").unwrap();

    assert_eq!(
        std::fs::read_to_string(checkout.path().join(".gitignore")).unwrap(),
        "target\n/debug.log\n"
    );
    let paths: Vec<_> = repository
        .status()
        .unwrap()
        .files
        .into_iter()
        .map(|f| f.path)
        .collect();
    assert_eq!(paths, [".gitignore", "keep.txt"]);
}

#[test]
fn ignoring_the_same_pattern_twice_adds_one_line_and_a_missing_file_is_created() {
    let checkout = Checkout::new();
    commit_file(&checkout, "a.txt", "a\n", "a");
    let repository = Repository::open(checkout.path()).unwrap();

    repository.add_to_gitignore("*.log").unwrap();
    repository.add_to_gitignore("*.log").unwrap();

    assert_eq!(
        std::fs::read_to_string(checkout.path().join(".gitignore")).unwrap(),
        "*.log\n"
    );
}

#[test]
fn refuses_patterns_that_would_write_more_than_one_rule() {
    let checkout = Checkout::new();
    commit_file(&checkout, "a.txt", "a\n", "a");
    let repository = Repository::open(checkout.path()).unwrap();

    assert!(repository.add_to_gitignore("one\ntwo").is_err());
    assert!(repository.add_to_gitignore("  ").is_err());
    assert!(!checkout.path().join(".gitignore").exists());
}
