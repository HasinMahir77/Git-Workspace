use git_gui_core::GitHubCli;
use std::{
    fs,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    sync::{Mutex, MutexGuard},
};

// A script that is still open for writing in one test fails to execute in another
// (ETXTBSY) when concurrent tests fork, so fixtures run one at a time.
static SERIAL: Mutex<()> = Mutex::new(());

struct CliFixture {
    directory: tempfile::TempDir,
    _serial: MutexGuard<'static, ()>,
}

impl CliFixture {
    fn new() -> Self {
        let fixture = Self {
            _serial: SERIAL.lock().unwrap_or_else(|error| error.into_inner()),
            directory: tempfile::tempdir().unwrap(),
        };
        let script = fixture.directory.path().join("gh");
        fs::write(&script, include_str!("fixtures/gh.sh")).unwrap();
        fs::set_permissions(script, fs::Permissions::from_mode(0o755)).unwrap();
        fixture
    }

    fn program(&self) -> PathBuf {
        self.directory.path().join("gh")
    }
}

#[test]
fn lists_saved_github_accounts_and_identifies_the_active_login() {
    let fixture = CliFixture::new();
    let state = GitHubCli::new(fixture.program()).accounts().unwrap();
    assert!(!state.has_environment_token);
    assert_eq!(state.accounts.len(), 2);
    assert_eq!(
        state
            .accounts
            .iter()
            .find(|account| account.is_active)
            .unwrap()
            .login,
        "work-fixture"
    );
    assert!(
        state
            .accounts
            .iter()
            .all(|account| account.is_authenticated)
    );
}

#[test]
fn switching_accounts_updates_the_identity_reported_by_gh() {
    let fixture = CliFixture::new();
    let cli = GitHubCli::new(fixture.program());
    cli.switch_account("personal-fixture").unwrap();
    let state = cli.accounts().unwrap();
    assert!(
        state
            .accounts
            .iter()
            .any(|account| account.login == "personal-fixture" && account.is_active)
    );
}

#[test]
fn browser_login_emits_only_the_device_code_and_refreshes_the_active_account() {
    use git_gui_core::Execution;
    let fixture = CliFixture::new();
    let cli = GitHubCli::new(fixture.program());
    let events = std::sync::Mutex::new(Vec::new());
    cli.sign_in(&Execution::new(&|code| events.lock().unwrap().push(code)))
        .unwrap();
    assert_eq!(events.into_inner().unwrap(), ["ABCD-1234"]);
    assert!(
        cli.accounts()
            .unwrap()
            .accounts
            .iter()
            .any(|account| account.login == "personal-fixture" && account.is_active)
    );
}

fn show_pull_request(fixture: &CliFixture, json: &str) {
    fs::write(fixture.directory.path().join("pr"), json).unwrap();
}

#[test]
fn reports_the_open_pull_request_with_a_failing_check_summary() {
    let fixture = CliFixture::new();
    show_pull_request(&fixture, r#"{"number":12,"title":"Add thing","state":"OPEN","url":"https://github.com/o/r/pull/12","isDraft":false,"statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"},{"status":"COMPLETED","conclusion":"FAILURE"}]}"#);

    let pull_request = GitHubCli::new(fixture.program()).pull_request(fixture.directory.path()).unwrap().unwrap();

    assert_eq!(pull_request.number, 12);
    assert_eq!(pull_request.title, "Add thing");
    assert_eq!(pull_request.checks, git_gui_core::CheckSummary::Failing);
}

#[test]
fn pending_checks_win_over_passing_ones() {
    let fixture = CliFixture::new();
    show_pull_request(&fixture, r#"{"number":1,"title":"t","state":"OPEN","url":"u","isDraft":true,"statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"},{"status":"IN_PROGRESS","conclusion":""}]}"#);

    let pull_request = GitHubCli::new(fixture.program()).pull_request(fixture.directory.path()).unwrap().unwrap();

    assert_eq!(pull_request.checks, git_gui_core::CheckSummary::Pending);
    assert!(pull_request.is_draft);
}

#[test]
fn a_pull_request_without_checks_reports_none() {
    let fixture = CliFixture::new();
    show_pull_request(&fixture, r#"{"number":1,"title":"t","state":"MERGED","url":"u","isDraft":false,"statusCheckRollup":[]}"#);

    let pull_request = GitHubCli::new(fixture.program()).pull_request(fixture.directory.path()).unwrap().unwrap();

    assert_eq!(pull_request.checks, git_gui_core::CheckSummary::None);
}

#[test]
fn a_branch_without_a_pull_request_is_not_an_error() {
    let fixture = CliFixture::new();

    let pull_request = GitHubCli::new(fixture.program()).pull_request(fixture.directory.path()).unwrap();

    assert!(pull_request.is_none());
}
