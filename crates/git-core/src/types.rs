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
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Operation {
    Stage { id: String },
    Unstage { id: String },
    Commit { summary: String, body: String },
    SwitchBranch { branch: String },
    CreateBranch { branch: String },
    Fetch { remote: String },
    Pull,
    Push { target: PushTarget },
    Publish { remote: String },
}

#[derive(Debug, Serialize, TS)]
pub struct ToolVersion {
    pub name: String,
    pub version: Option<String>,
}
