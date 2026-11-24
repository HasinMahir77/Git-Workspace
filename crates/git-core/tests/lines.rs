mod support;

use git_gui_core::Repository;
use support::{Checkout, commit_file};

const ORIGINAL: &str = "fn save() {\n    validate(data);\n    write(data);\n}\n";
const EDITED: &str =
    "fn save() {\n    validate_input(data);\n    log(data);\n    write(data);\n}\n";

fn edited_checkout() -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "save.rs", ORIGINAL, "save");
    checkout.write("save.rs", EDITED);
    checkout
}

fn file_id(repository: &Repository) -> String {
    repository
        .status()
        .unwrap()
        .files
        .into_iter()
        .find(|file| file.path == "save.rs")
        .unwrap()
        .id
}

/// Positions of the lines below the first hunk header, as the diff view numbers them.
fn hunk(repository: &Repository, id: &str, is_staged: bool) -> (String, Vec<String>) {
    let patch = repository.diff(id, is_staged).unwrap();
    let mut lines = patch.lines().skip_while(|line| !line.starts_with("@@ "));
    let header = lines.next().unwrap().to_string();
    (header, lines.map(str::to_string).collect())
}

fn position(body: &[String], line: &str) -> u32 {
    body.iter().position(|entry| entry == line).unwrap() as u32
}

fn staged_file(checkout: &Checkout) -> String {
    checkout.git(&["show", ":save.rs"])
}

#[test]
fn stages_only_the_selected_lines_of_a_hunk() {
    let checkout = edited_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository);
    let (header, body) = hunk(&repository, &id, false);
    let selected = [
        position(&body, "-    validate(data);"),
        position(&body, "+    validate_input(data);"),
    ];

    repository.stage_lines(&id, 0, &header, &selected).unwrap();

    assert_eq!(
        staged_file(&checkout),
        "fn save() {\n    validate_input(data);\n    write(data);\n}\n"
    );
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("save.rs")).unwrap(),
        EDITED
    );
    assert!(checkout.git(&["diff"]).contains("+    log(data);"));
}

#[test]
fn stages_one_removed_line_and_keeps_the_other_removal_unstaged() {
    let checkout = Checkout::new();
    commit_file(&checkout, "save.rs", ORIGINAL, "save");
    checkout.write("save.rs", "fn save() {\n}\n");
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository);
    let (header, body) = hunk(&repository, &id, false);

    repository
        .stage_lines(&id, 0, &header, &[position(&body, "-    write(data);")])
        .unwrap();

    assert_eq!(
        staged_file(&checkout),
        "fn save() {\n    validate(data);\n}\n"
    );
    assert_eq!(
        checkout
            .git(&["diff"])
            .lines()
            .filter(|line| line.starts_with('-') && !line.starts_with("---"))
            .count(),
        1
    );
}

#[test]
fn unstages_one_line_and_keeps_the_rest_of_the_hunk_staged() {
    let checkout = edited_checkout();
    checkout.git(&["add", "save.rs"]);
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository);
    let (header, body) = hunk(&repository, &id, true);

    repository
        .unstage_lines(&id, 0, &header, &[position(&body, "+    log(data);")])
        .unwrap();

    assert_eq!(
        staged_file(&checkout),
        "fn save() {\n    validate_input(data);\n    write(data);\n}\n"
    );
    assert_eq!(
        std::fs::read_to_string(checkout.path().join("save.rs")).unwrap(),
        EDITED
    );
    assert!(checkout.git(&["diff"]).contains("+    log(data);"));
}

#[test]
fn a_selection_without_changed_lines_is_refused_and_nothing_is_staged() {
    let checkout = edited_checkout();
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository);
    let (header, body) = hunk(&repository, &id, false);

    let context = repository.stage_lines(&id, 0, &header, &[position(&body, " fn save() {")]);
    let outside = repository.stage_lines(&id, 0, &header, &[body.len() as u32 + 3]);

    assert!(context.unwrap_err().contains("changed"));
    assert!(outside.unwrap_err().contains("changed"));
    assert!(checkout.git(&["diff", "--cached"]).is_empty());
}

#[test]
fn the_missing_newline_marker_follows_its_own_line_when_another_line_is_left_out() {
    let checkout = Checkout::new();
    commit_file(&checkout, "save.rs", "first\nlast", "save");
    checkout.write("save.rs", "first\nrenamed\nadded");
    let repository = Repository::open(checkout.path()).unwrap();
    let id = file_id(&repository);
    let (header, body) = hunk(&repository, &id, false);
    let selected = [position(&body, "-last"), position(&body, "+renamed")];

    repository.stage_lines(&id, 0, &header, &selected).unwrap();

    assert_eq!(staged_file(&checkout), "first\nrenamed\n");
}
