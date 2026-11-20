mod support;

use git_gui_core::Repository;
use support::{Checkout, commit_file};

fn checkout_with_mixed_commit() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "keep.txt", "keep\n", "base");
    commit_file(
        &checkout,
        "old name.txt",
        "line one\nline two\nline three\n",
        "add rename source",
    );
    commit_file(&checkout, "gone.txt", "gone\n", "add gone");
    std::fs::remove_file(checkout.path().join("gone.txt")).unwrap();
    checkout.git(&["mv", "old name.txt", "new name.txt"]);
    checkout.write("keep.txt", "keep\nmore\n");
    checkout.write("fresh.txt", "fresh\n");
    checkout.git(&["add", "-A"]);
    checkout.git(&["commit", "-m", "mixed changes"]);
    checkout
}

#[test]
fn lists_each_file_a_commit_touched_with_its_status_and_rename_source() {
    let checkout = checkout_with_mixed_commit();
    let repository = Repository::open(checkout.path()).unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]).trim().to_owned();

    let files = repository.commit_files(&head).unwrap();

    let summary: Vec<_> = files
        .iter()
        .map(|file| {
            (
                file.path.as_str(),
                file.status.as_str(),
                file.original_path.as_deref(),
            )
        })
        .collect();
    assert_eq!(
        summary,
        [
            ("fresh.txt", "A", None),
            ("gone.txt", "D", None),
            ("keep.txt", "M", None),
            ("new name.txt", "R", Some("old name.txt")),
        ]
    );
}

#[test]
fn shows_the_diff_for_one_file_of_a_commit_only() {
    let checkout = checkout_with_mixed_commit();
    let repository = Repository::open(checkout.path()).unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]).trim().to_owned();

    let patch = repository
        .commit_diff(&head, &["keep.txt".to_owned()])
        .unwrap();

    assert!(patch.contains("+more"), "{patch}");
    assert!(!patch.contains("fresh"), "{patch}");
    let all = repository.commit_diff(&head, &[]).unwrap();
    assert!(all.contains("fresh") && all.contains("+more"));
}

#[test]
fn a_renamed_file_shows_as_a_rename_when_both_paths_are_given() {
    let checkout = checkout_with_mixed_commit();
    let repository = Repository::open(checkout.path()).unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]).trim().to_owned();

    let patch = repository
        .commit_diff(
            &head,
            &["new name.txt".to_owned(), "old name.txt".to_owned()],
        )
        .unwrap();

    assert!(patch.contains("rename from old name.txt"), "{patch}");
}

#[test]
fn a_root_commit_lists_its_files_as_added() {
    let checkout = Checkout::new();
    commit_file(&checkout, "first.txt", "first\n", "root");
    let repository = Repository::open(checkout.path()).unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]).trim().to_owned();

    let files = repository.commit_files(&head).unwrap();

    assert_eq!(files.len(), 1);
    assert_eq!(files[0].status, "A");
}
