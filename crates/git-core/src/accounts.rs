use serde::Deserialize;
use std::{
    collections::HashMap,
    ffi::OsString,
    process::{Command, Stdio},
};

use crate::{
    CheckSummary, Execution, GitHubAccount, GitHubAccounts, PullRequest, git::stream_command,
};

const HOST: &str = "github.com";

#[derive(Deserialize)]
struct CliStatus {
    hosts: HashMap<String, Vec<CliAccount>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CliAccount {
    login: String,
    active: bool,
    state: String,
    token_source: Option<String>,
}

pub struct GitHubCli {
    program: OsString,
}

impl Default for GitHubCli {
    fn default() -> Self {
        Self::new("gh")
    }
}

impl GitHubCli {
    pub fn new(program: impl Into<OsString>) -> Self {
        Self {
            program: program.into(),
        }
    }

    pub fn accounts(&self) -> Result<GitHubAccounts, String> {
        let output = self.command().args(["auth", "status", "--hostname", HOST, "--json", "hosts"])
            .output().map_err(|_| "GitHub CLI (gh) is unavailable. Install it or start Git Workspace from a terminal that can find it.")?;
        let mut status: CliStatus = serde_json::from_slice(&output.stdout)
            .map_err(|_| "Could not read GitHub accounts. Update GitHub CLI to a version that supports gh auth status --json.")?;
        let entries = status.hosts.remove(HOST).unwrap_or_default();
        let has_environment_token = entries.iter().any(|account| {
            account.active
                && matches!(
                    account.token_source.as_deref(),
                    Some("GH_TOKEN" | "GITHUB_TOKEN")
                )
        });
        let accounts = entries
            .into_iter()
            .map(|account| GitHubAccount {
                login: account.login,
                is_active: account.active,
                is_authenticated: account.state == "success",
            })
            .collect();
        Ok(GitHubAccounts {
            accounts,
            has_environment_token,
        })
    }

    /// The pull request for the branch checked out in `directory`, if there is one.
    pub fn pull_request(&self, directory: &std::path::Path) -> Result<Option<PullRequest>, String> {
        let output = self
            .command()
            .current_dir(directory)
            .args(["pr", "view", "--json", "number,title,state,url,isDraft,statusCheckRollup"])
            .output()
            .map_err(|_| "GitHub CLI (gh) is unavailable.")?;
        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr);
            return if message.contains("no pull requests found") {
                Ok(None)
            } else {
                Err("Could not read the pull request. Check that GitHub CLI is signed in.".into())
            };
        }
        let raw: CliPullRequest = serde_json::from_slice(&output.stdout)
            .map_err(|_| "Could not read the pull request from GitHub CLI.")?;
        Ok(Some(PullRequest {
            number: raw.number,
            title: raw.title,
            state: raw.state,
            url: raw.url,
            is_draft: raw.is_draft,
            checks: summarize_checks(&raw.status_check_rollup),
        }))
    }

    pub fn switch_account(&self, login: &str) -> Result<(), String> {
        if login.is_empty()
            || login.starts_with('-')
            || !login
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err("Select a saved GitHub account.".into());
        }
        self.run(["auth", "switch", "--hostname", HOST, "--user", login],
            "Could not switch GitHub accounts. Check the account or environment token in GitHub CLI.")
    }

    pub fn setup_git_https(&self) -> Result<(), String> {
        self.run(["auth", "setup-git", "--hostname", HOST],
            "Could not configure the GitHub CLI credential helper. Sign in first and check your Git configuration.")
    }

    pub fn sign_in(&self, execution: &Execution<'_>) -> Result<(), String> {
        let mut command = self.command();
        command.args([
            "auth",
            "login",
            "--hostname",
            HOST,
            "--web",
            "--clipboard=false",
        ]);
        let emit = |line: String| {
            if let Some((_, code)) = line.trim_end().rsplit_once("one-time code: ")
                && let Some((first, second)) = code.split_once('-')
                && [first, second].iter().all(|part| {
                    part.len() == 4
                        && part
                            .bytes()
                            .all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit())
                })
            {
                (execution.emit)(code.into());
            }
        };
        stream_command(
            command,
            "GitHub CLI",
            &Execution {
                emit: &emit,
                cancellation: execution.cancellation,
            },
        )
    }

    fn run<const N: usize>(&self, args: [&str; N], failure: &str) -> Result<(), String> {
        let status = self
            .command()
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|_| "Could not start GitHub CLI.")?;
        if status.success() {
            Ok(())
        } else {
            Err(failure.into())
        }
    }

    fn command(&self) -> Command {
        let mut command = Command::new(&self.program);
        command
            .env("GH_PROMPT_DISABLED", "1")
            .env("NO_COLOR", "1")
            .env_remove("GH_DEBUG")
            .env_remove("GH_FORCE_TTY")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        command
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CliPullRequest {
    number: u32,
    title: String,
    state: String,
    url: String,
    is_draft: bool,
    #[serde(default)]
    status_check_rollup: Vec<CliCheck>,
}

#[derive(Deserialize)]
struct CliCheck {
    #[serde(default)]
    status: String,
    #[serde(default)]
    conclusion: String,
    #[serde(default)]
    state: String,
}

fn summarize_checks(checks: &[CliCheck]) -> CheckSummary {
    const FAILED: [&str; 5] = ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "STARTUP_FAILURE"];
    if checks.is_empty() {
        return CheckSummary::None;
    }
    if checks
        .iter()
        .any(|check| FAILED.contains(&check.conclusion.as_str()) || FAILED.contains(&check.state.as_str()))
    {
        return CheckSummary::Failing;
    }
    let is_pending = |check: &CliCheck| {
        (!check.status.is_empty() && check.status != "COMPLETED")
            || check.state == "PENDING"
            || check.state == "EXPECTED"
    };
    if checks.iter().any(is_pending) {
        CheckSummary::Pending
    } else {
        CheckSummary::Passing
    }
}
