mod support;

use git_gui_core::Repository;
use support::{Checkout, commit_file};

fn checkout_with_origin(url: &str) -> Checkout {
    let checkout = Checkout::new();
    commit_file(&checkout, "a.txt", "a\n", "a");
    checkout.git(&["remote", "add", "origin", url]);
    checkout
}

#[test]
fn builds_github_links_from_https_ssh_and_scp_style_remotes() {
    for url in [
        "https://github.com/octo/notes.git",
        "https://user@github.com/octo/notes",
        "git@github.com:octo/notes.git",
        "ssh://git@github.com/octo/notes.git",
    ] {
        let checkout = checkout_with_origin(url);
        let repository = Repository::open(checkout.path()).unwrap();
        assert_eq!(
            repository.github_url(None).unwrap().as_deref(),
            Some("https://github.com/octo/notes"),
            "{url}"
        );
        assert_eq!(
            repository.github_url(Some("abc123")).unwrap().as_deref(),
            Some("https://github.com/octo/notes/commit/abc123"),
            "{url}"
        );
    }
}

#[test]
fn other_hosts_and_missing_remotes_have_no_github_link() {
    let other = checkout_with_origin("https://gitlab.com/octo/notes.git");
    assert_eq!(
        Repository::open(other.path())
            .unwrap()
            .github_url(None)
            .unwrap(),
        None
    );

    let local = Checkout::new();
    commit_file(&local, "a.txt", "a\n", "a");
    assert_eq!(
        Repository::open(local.path())
            .unwrap()
            .github_url(None)
            .unwrap(),
        None
    );
}

#[test]
fn builds_a_compare_link_for_the_current_branch() {
    let checkout = checkout_with_origin("git@github.com:octo/notes.git");
    checkout.git(&["switch", "-c", "feat/GH-1#name"]);
    let repository = Repository::open(checkout.path()).unwrap();

    assert_eq!(
        repository.github_compare_url().unwrap().as_deref(),
        Some("https://github.com/octo/notes/compare/feat/GH-1%23name?expand=1")
    );
}
