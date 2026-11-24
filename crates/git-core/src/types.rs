use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAccounts {
    pub accounts: Vec<GitHubAccount>,
    pub has_environment_token: bool,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAccount {
    pub login: String,
    pub is_active: bool,
    pub is_authenticated: bool,
}

#[derive(Debug, Default, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub is_unborn: bool,
    pub has_upstream_ref: bool,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<ChangedFile>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub id: String,
    pub path: String,
    pub original_path: Option<String>,
    #[serde(skip)]
    pub(crate) original_id: Option<String>,
    pub staged: String,
    pub unstaged: String,
    pub has_conflict: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PushTarget {
    pub remote: String,
    pub reference: String,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CommitFile {
    pub path: String,
    pub original_path: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, TS)]
pub struct Commit {
    pub id: String,
    pub summary: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub remotes: Vec<String>,
    pub fetch_remote: Option<String>,
    pub has_configured_upstream: bool,
    pub push_target: Option<PushTarget>,
    pub push_ahead: Option<u32>,
}

#[derive(Clone, Debug, Serialize, TS)]
pub struct RepositoryInfo {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Deserialize, TS)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Operation {
    Stage {
        id: String,
    },
    Unstage {
        id: String,
    },
    Commit {
        summary: String,
        body: String,
    },
    SwitchBranch {
        branch: String,
    },
    CreateBranch {
        branch: String,
        start: Option<String>,
    },
    Discard {
        id: String,
    },
    AddToGitignore {
        pattern: String,
    },
    RevertCommit {
        commit: String,
    },
    CheckoutCommit {
        commit: String,
    },
    Fetch {
        remote: String,
    },
    AddRemote {
        name: String,
        url: String,
    },
    Pull,
    Merge {
        other: String,
        expected_id: String,
    },
    Rebase {
        onto: String,
        expected_id: String,
    },
    CherryPick {
        commit: String,
        destination: Option<String>,
    },
    CheckoutRemote {
        remote_branch: String,
    },
    StashPush {
        should_include_untracked: bool,
    },
    StashApply {
        id: String,
    },
    StashDrop {
        id: String,
    },
    StageHunk {
        id: String,
        index: u32,
        header: String,
    },
    UnstageHunk {
        id: String,
        index: u32,
        header: String,
    },
    StageLines {
        id: String,
        index: u32,
        header: String,
        lines: Vec<u32>,
    },
    UnstageLines {
        id: String,
        index: u32,
        header: String,
        lines: Vec<u32>,
    },
    ContinueIntegration,
    AbortIntegration,
    SkipIntegration,
    Push {
        target: PushTarget,
    },
    Publish {
        remote: String,
    },
}

#[derive(Debug, Serialize, TS)]
pub struct ToolVersion {
    pub name: String,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Comparison {
    pub current: String,
    pub current_id: String,
    pub other: String,
    pub other_id: String,
    pub merge_base: Option<String>,
    pub current_only: Vec<Commit>,
    pub other_only: Vec<Commit>,
    pub diff: String,
}

#[derive(Debug, Serialize, TS)]
pub struct BranchGroups {
    pub local: Vec<String>,
    pub remote: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum IntegrationKind {
    Merge,
    Rebase,
    CherryPick,
    Revert,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Recovery {
    pub kind: Option<IntegrationKind>,
    pub unmerged: Vec<ChangedFile>,
}

impl IntegrationKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::Merge => "Merge",
            Self::Rebase => "Rebase",
            Self::CherryPick => "Cherry-pick",
            Self::Revert => "Revert",
        }
    }
}

#[derive(Debug, Serialize, TS)]
pub struct StashEntry {
    pub id: String,
    pub message: String,
}
