mod support;

use git_gui_core::{Execution, Repository};
use support::{Checkout, commit_file};

fn numbered(replacing: &[(usize, &str)]) -> String {
    (1..=30)
        .map(|line| {
            let text = replacing
                .iter()
                .find(|(number, _)| *number == line)
                .map_or(format!("line {line}"), |(_, text)| text.to_string());
            format!("{text}\n")
        })
        .collect()
}

fn two_hunk_checkout() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "doc.txt", &numbered(&[]), "doc");
    checkout.write(
        "doc.txt",
        &numbered(&[(2, "first edit"), (29, "second edit")]),
    );
    checkout
}

fn file_id(repository: &Repository, path: &str) -> String {
    repository
        .status()
        .unwrap()
        .files
        .into_iter()
        .find(|file| file.path == path)
        .unwrap()
        .id
}

fn headers(patch: &str) -> Vec<String> {
    patch
        .lines()
        .filter(|line| line.starts_with("@@ "))
        .map(str::to_string)
        .collect()
}

#[test]
fn stages_one_hunk_of_two_independent_edits() {
    let checkout = two_hunk_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository, "doc.txt");
    let headers = headers(&repository.diff(&id, false).unwrap());
    assert_eq!(headers.len(), 2);

    repository.stage_hunk(&id, 1, &headers[1]).unwrap();

    let staged = checkout.git(&["diff", "--cached"]);
    assert!(staged.contains("+second edit") && !staged.contains("first edit"));
    let unstaged = checkout.git(&["diff"]);
    assert!(unstaged.contains("+first edit") && !unstaged.contains("second edit"));
    let worktree = std::fs::read_to_string(checkout.path().join("doc.txt")).unwrap();
    assert_eq!(
        worktree,
        numbered(&[(2, "first edit"), (29, "second edit")])
    );
}

#[test]
fn unstages_a_single_hunk_through_reverse_application() {
    let checkout = two_hunk_checkout();
    checkout.git(&["add", "doc.txt"]);
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository, "doc.txt");
    let headers = headers(&repository.diff(&id, true).unwrap());

    repository.unstage_hunk(&id, 0, &headers[0]).unwrap();

    let staged = checkout.git(&["diff", "--cached"]);
    assert!(staged.contains("+second edit") && !staged.contains("first edit"));
    assert!(checkout.git(&["diff"]).contains("+first edit"));
}

#[test]
fn a_hunk_that_changed_after_the_preview_is_refused_and_nothing_is_staged() {
    let checkout = two_hunk_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository, "doc.txt");
    let previewed = headers(&repository.diff(&id, false).unwrap());
    checkout.write(
        "doc.txt",
        &numbered(&[(2, "first edit"), (3, "inserted"), (29, "second edit")]),
    );

    let error = repository.stage_hunk(&id, 0, &previewed[0]).unwrap_err();

    assert!(error.contains("changed"), "{error}");
    assert!(checkout.git(&["diff", "--cached"]).is_empty());
    assert!(repository.stage_hunk(&id, 7, &previewed[0]).is_err());
}

#[test]
fn untracked_binary_and_conflicted_files_are_left_to_whole_file_actions() {
    let checkout = two_hunk_checkout();
    checkout.write("new.txt", "untracked\n");
    std::fs::write(checkout.path().join("image.bin"), [0u8, 1, 2, 3]).unwrap();
    checkout.git(&["add", "image.bin"]);
    commit_file(&checkout, "keep.txt", "keep\n", "keep");
    std::fs::write(checkout.path().join("image.bin"), [0u8, 9, 9, 9]).unwrap();
    let repository = Repository::open(checkout.path()).unwrap();

    let untracked = repository
        .stage_hunk(&file_id(&repository, "new.txt"), 0, "@@ -0,0 +1 @@")
        .unwrap_err();
    assert!(untracked.contains("whole file"), "{untracked}");
    let binary = repository
        .stage_hunk(&file_id(&repository, "image.bin"), 0, "@@")
        .unwrap_err();
    assert!(binary.contains("whole file"), "{binary}");
}

#[test]
fn a_rejected_commit_keeps_the_staged_hunk_and_the_unstaged_remainder() {
    let checkout = two_hunk_checkout();
    support::install_hook(&checkout, "pre-commit", "echo 'rejected' >&2; exit 1");
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository, "doc.txt");
    let headers = headers(&repository.diff(&id, false).unwrap());
    repository.stage_hunk(&id, 1, &headers[1]).unwrap();

    assert!(
        repository
            .commit("partial", "", &Execution::new(&|_| {}))
            .is_err()
    );

    assert!(checkout.git(&["diff", "--cached"]).contains("+second edit"));
    assert!(checkout.git(&["diff"]).contains("+first edit"));
}
