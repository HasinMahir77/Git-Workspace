use std::{
    path::PathBuf,
    sync::atomic::{AtomicUsize, Ordering},
};

use git_gui_core::{Execution, Operation, Repository, RepositoryInfo};
use tauri::{State, ipc::Channel};

use crate::{
    commands::{blocking, trash_directory},
    repositories::Repositories,
};

const MAX_OUTPUT_BYTES: usize = 256 * 1024;

#[tauri::command]
pub async fn run_operation(
    repo: String,
    operation: Operation,
    output: Channel<String>,
    state: State<'_, Repositories>,
) -> Result<(), String> {
    let entry = state.get(&repo)?;
    let active = entry.start_operation()?;
    blocking(move || {
        let guard = active;
        let repository = entry.repository;
        let emit = bounded_output(output);
        let execution = &Execution::cancellable(&emit, &guard.cancellation);
        match operation {
            Operation::Stage { id } => repository.stage(&id),
            Operation::Unstage { id } => repository.unstage(&id),
            Operation::Commit { summary, body } => repository.commit(&summary, &body, execution),
            Operation::SwitchBranch { branch } => repository.switch(&branch, false, execution),
            Operation::CreateBranch { branch, start } => match start {
                Some(commit) => repository.create_branch_at(&branch, &commit, execution),
                None => repository.switch(&branch, true, execution),
            },
            Operation::Discard { id } => repository.discard(&id, &trash_directory()?),
            Operation::AddToGitignore { pattern } => repository.add_to_gitignore(&pattern),
            Operation::RevertCommit { commit } => repository.revert_commit(&commit, execution),
            Operation::CheckoutCommit { commit } => repository.checkout_commit(&commit, execution),
            Operation::Fetch { remote } => repository.fetch(&remote, execution),
            Operation::AddRemote { name, url } => repository.add_remote(&name, &url),
            Operation::Pull => repository.pull(execution),
            Operation::Amend { summary, body } => repository.amend(&summary, &body, execution),
            Operation::UndoCommit => repository.undo_commit(),
            Operation::DeleteBranch {
                branch,
                should_force,
            } => repository.delete_branch(&branch, should_force),
            Operation::RenameBranch { from, to } => repository.rename_branch(&from, &to),
            Operation::Squash { commit, onto } => repository.squash(&commit, &onto, execution),
            Operation::ResolveConflict { id, content } => {
                repository.resolve_conflict(&id, &content)
            }
            Operation::Merge { other, expected_id } => {
                repository.merge(&other, &expected_id, execution)
            }
            Operation::Rebase { onto, expected_id } => {
                repository.rebase(&onto, &expected_id, execution)
            }
            Operation::CherryPick {
                commit,
                destination,
            } => repository.cherry_pick(&commit, destination.as_deref(), execution),
            Operation::CheckoutRemote { remote_branch } => {
                repository.checkout_remote(&remote_branch, execution)
            }
            Operation::StashPush {
                should_include_untracked,
            } => repository.stash_push(should_include_untracked, execution),
            Operation::StashApply { id } => repository.stash_apply(&id, execution),
            Operation::StashDrop { id } => repository.stash_drop(&id),
            Operation::StageHunk { id, index, header } => {
                repository.stage_hunk(&id, index as usize, &header)
            }
            Operation::UnstageHunk { id, index, header } => {
                repository.unstage_hunk(&id, index as usize, &header)
            }
            Operation::StageLines { id, index, header, lines } => {
                repository.stage_lines(&id, index as usize, &header, &lines)
            }
            Operation::UnstageLines { id, index, header, lines } => {
                repository.unstage_lines(&id, index as usize, &header, &lines)
            }
            Operation::ContinueIntegration => repository.continue_integration(execution),
            Operation::AbortIntegration => repository.abort_integration(execution),
            Operation::SkipIntegration => repository.skip_integration(execution),
            Operation::Publish { remote } => repository.push(Some(&remote), execution),
            Operation::Push { target } => repository.push_confirmed(&target, execution),
        }
    })
    .await
}

#[tauri::command]
pub fn cancel_operation(repo: String, state: State<'_, Repositories>) -> Result<(), String> {
    state.get(&repo)?.cancel_operation()
}

#[tauri::command]
pub async fn clone_repository(
    parent: PathBuf,
    name: String,
    source: String,
    output: Channel<String>,
    state: State<'_, Repositories>,
) -> Result<RepositoryInfo, String> {
    let repository = blocking(move || {
        let emit = bounded_output(output);
        Repository::clone_into(&parent, &name, &source, &Execution::new(&emit))
    })
    .await?;
    state.register(repository)
}

fn bounded_output(output: Channel<String>) -> impl Fn(String) + Sync {
    let bytes = AtomicUsize::new(0);
    move |line| {
        let before = bytes.fetch_add(line.len(), Ordering::Relaxed);
        if before + line.len() <= MAX_OUTPUT_BYTES {
            let _ = output.send(line);
        } else if before <= MAX_OUTPUT_BYTES {
            let _ = output.send("[Further output omitted]\n".into());
        }
    }
}
