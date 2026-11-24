use std::path::PathBuf;

use git_gui_core::{
    BlameLine, BranchGroups, Commit, CommitFile, CommitMessage, Comparison, ConflictSides,
    DiffOptions, GitHubCli, PullRequest, Recovery, Repository, RepositoryInfo, StashEntry, Status,
    SyncState,
};
use tauri::State;

use crate::{commands::blocking, repositories::Repositories};

#[tauri::command]
pub async fn init_repository(
    parent: PathBuf,
    name: String,
    state: State<'_, Repositories>,
) -> Result<RepositoryInfo, String> {
    let repository = blocking(move || Repository::init_into(&parent, &name)).await?;
    state.register(repository)
}

#[tauri::command]
pub async fn open_repository(
    path: PathBuf,
    state: State<'_, Repositories>,
) -> Result<RepositoryInfo, String> {
    let repository = blocking(move || Repository::open(&path)).await?;
    state.register(repository)
}

#[tauri::command]
pub async fn get_status(repo: String, state: State<'_, Repositories>) -> Result<Status, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.status()).await
}

#[tauri::command]
pub async fn get_sync_state(
    repo: String,
    state: State<'_, Repositories>,
) -> Result<SyncState, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.sync_state()).await
}

#[tauri::command]
pub async fn get_branches(
    repo: String,
    state: State<'_, Repositories>,
) -> Result<Vec<String>, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.branches()).await
}

#[tauri::command]
pub async fn get_diff(
    repo: String,
    file: String,
    is_staged: bool,
    options: DiffOptions,
    state: State<'_, Repositories>,
) -> Result<String, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.diff_with(&file, is_staged, &options)).await
}

#[tauri::command]
pub async fn get_history(
    repo: String,
    offset: u32,
    state: State<'_, Repositories>,
) -> Result<Vec<Commit>, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.history(offset)).await
}

#[tauri::command]
pub async fn get_commit_diff(
    repo: String,
    commit: String,
    paths: Vec<String>,
    options: DiffOptions,
    state: State<'_, Repositories>,
) -> Result<String, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.commit_diff_with(&commit, &paths, &options)).await
}

#[tauri::command]
pub async fn get_commit_files(
    repo: String,
    commit: String,
    state: State<'_, Repositories>,
) -> Result<Vec<CommitFile>, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.commit_files(&commit)).await
}

#[tauri::command]
pub async fn compare_branches(
    repo: String,
    other: String,
    state: State<'_, Repositories>,
) -> Result<Comparison, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.compare(&other)).await
}

#[tauri::command]
pub async fn get_branch_groups(
    repo: String,
    state: State<'_, Repositories>,
) -> Result<BranchGroups, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.branch_groups()).await
}

#[tauri::command]
pub async fn get_recovery(
    repo: String,
    state: State<'_, Repositories>,
) -> Result<Recovery, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.recovery()).await
}

#[tauri::command]
pub async fn get_stashes(
    repo: String,
    state: State<'_, Repositories>,
) -> Result<Vec<StashEntry>, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.stashes()).await
}

#[tauri::command]
pub async fn get_head_message(
    repo: String,
    state: State<'_, Repositories>,
) -> Result<CommitMessage, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.head_message()).await
}

#[tauri::command]
pub async fn get_blame(
    repo: String,
    path: String,
    state: State<'_, Repositories>,
) -> Result<Vec<BlameLine>, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.blame(&path)).await
}

#[tauri::command]
pub async fn get_conflict_sides(
    repo: String,
    file: String,
    state: State<'_, Repositories>,
) -> Result<ConflictSides, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.conflict_sides(&file)).await
}

#[tauri::command]
pub async fn get_pull_request(
    repo: String,
    state: State<'_, Repositories>,
) -> Result<Option<PullRequest>, String> {
    let entry = state.get(&repo)?;
    blocking(move || GitHubCli::default().pull_request(entry.repository.root())).await
}
