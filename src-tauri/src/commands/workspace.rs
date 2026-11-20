use std::path::PathBuf;

use git_gui_core::{
    BranchGroups, Commit, Comparison, Recovery, Repository, RepositoryInfo, StashEntry, Status,
    SyncState,
};
use tauri::State;

use crate::{commands::blocking, repositories::Repositories};

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
    state: State<'_, Repositories>,
) -> Result<String, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.diff(&file, is_staged)).await
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
    state: State<'_, Repositories>,
) -> Result<String, String> {
    let entry = state.get(&repo)?;
    blocking(move || entry.repository.commit_diff(&commit)).await
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
