mod support;

use git_gui_core::{DiffOptions, Repository};
use support::{Checkout, commit_file};

fn id_of(repository: &Repository, path: &str) -> String {
    repository
        .status()
        .unwrap()
        .files
        .into_iter()
        .find(|file| file.path == path)
        .unwrap()
        .id
}

#[test]
fn blame_reports_the_author_and_commit_of_each_line() {
    let checkout = Checkout::new();
    commit_file(&checkout, "a.txt", "one\ntwo\n", "first");
    commit_file(&checkout, "a.txt", "one\ntwo\nthree\n", "add three");
    let repository = Repository::open(checkout.path()).unwrap();

    let lines = repository.blame("a.txt").unwrap();

    assert_eq!(lines.iter().map(|line| line.text.as_str()).collect::<Vec<_>>(), ["one", "two", "three"]);
    assert_eq!(lines[0].summary, "first");
    assert_eq!(lines[2].summary, "add three");
    assert_eq!(lines[2].author, "Fixture");
    assert_eq!(lines[2].line, 3);
    assert_ne!(lines[0].commit, lines[2].commit);
}

#[test]
fn blaming_an_untracked_file_is_an_error() {
    let checkout = Checkout::new();
    commit_file(&checkout, "a.txt", "a\n", "first");
    checkout.write("new.txt", "new\n");
    let repository = Repository::open(checkout.path()).unwrap();

    assert!(repository.blame("new.txt").is_err());
}

fn conflicted() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "f.txt", "base\n", "base");
    checkout.git(&["switch", "-c", "theirs"]);
    commit_file(&checkout, "f.txt", "theirs\n", "theirs change");
    checkout.git(&["switch", "main"]);
    commit_file(&checkout, "f.txt", "ours\n", "ours change");
    let output = std::process::Command::new("git")
        .current_dir(checkout.path())
        .args(["merge", "theirs"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    checkout
}

#[test]
fn conflict_sides_return_base_ours_and_theirs() {
    let checkout = conflicted();
    let repository = Repository::open(checkout.path()).unwrap();

    let sides = repository.conflict_sides(&id_of(&repository, "f.txt")).unwrap();

    assert_eq!(sides.base.as_deref(), Some("base\n"));
    assert_eq!(sides.ours.as_deref(), Some("ours\n"));
    assert_eq!(sides.theirs.as_deref(), Some("theirs\n"));
    assert!(sides.working.contains("<<<<<<<"));
}

#[test]
fn resolving_a_conflict_writes_the_result_and_marks_it_resolved() {
    let checkout = conflicted();
    let repository = Repository::open(checkout.path()).unwrap();

    repository.resolve_conflict(&id_of(&repository, "f.txt"), "ours\ntheirs\n").unwrap();

    assert_eq!(std::fs::read_to_string(checkout.path().join("f.txt")).unwrap(), "ours\ntheirs\n");
    assert!(repository.recovery().unwrap().unmerged.is_empty());
}

#[test]
fn resolving_a_file_without_a_conflict_is_refused() {
    let checkout = Checkout::new();
    commit_file(&checkout, "f.txt", "base\n", "base");
    checkout.write("f.txt", "changed\n");
    let repository = Repository::open(checkout.path()).unwrap();

    assert!(repository.resolve_conflict(&id_of(&repository, "f.txt"), "x\n").is_err());
}

fn spaced() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "f.txt", "a\n  b\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\nm\n", "base");
    checkout.write("f.txt", "a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\nX\n");
    checkout
}

#[test]
fn hiding_whitespace_drops_whitespace_only_changes_from_the_diff() {
    let checkout = spaced();
    let repository = Repository::open(checkout.path()).unwrap();
    let id = id_of(&repository, "f.txt");

    let plain = repository.diff_with(&id, false, &DiffOptions::default()).unwrap();
    let hidden = repository
        .diff_with(&id, false, &DiffOptions { should_ignore_whitespace: true, context_lines: None })
        .unwrap();

    assert!(plain.contains("-  b"));
    assert!(!hidden.contains("-  b"));
    assert!(hidden.contains("+X"));
}

#[test]
fn more_context_lines_widen_the_diff() {
    let checkout = spaced();
    let repository = Repository::open(checkout.path()).unwrap();
    let id = id_of(&repository, "f.txt");

    let narrow = repository.diff_with(&id, false, &DiffOptions::default()).unwrap();
    let wide = repository
        .diff_with(&id, false, &DiffOptions { should_ignore_whitespace: false, context_lines: Some(50) })
        .unwrap();

    assert!(wide.lines().count() > narrow.lines().count());
    assert_eq!(wide.matches("\n@@").count(), 1);
}

#[test]
fn commit_diffs_accept_the_same_options() {
    let checkout = Checkout::new();
    commit_file(&checkout, "f.txt", "a\n  b\n", "base");
    commit_file(&checkout, "f.txt", "a\nb\n", "trim");
    let repository = Repository::open(checkout.path()).unwrap();
    let head = checkout.git(&["rev-parse", "HEAD"]).trim().to_owned();

    let hidden = repository
        .commit_diff_with(&head, &[], &DiffOptions { should_ignore_whitespace: true, context_lines: None })
        .unwrap();

    assert!(!hidden.contains("@@"));
}

#[test]
fn history_dates_are_full_timestamps() {
    let checkout = Checkout::new();
    commit_file(&checkout, "f.txt", "a\n", "base");
    let repository = Repository::open(checkout.path()).unwrap();

    let commits = repository.history(0).unwrap();

    assert!(commits[0].date.contains('T'), "{}", commits[0].date);
}
