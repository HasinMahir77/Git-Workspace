use std::{
    path::PathBuf,
    sync::atomic::{AtomicUsize, Ordering},
};

use git_gui_core::{Execution, Operation, Repository, RepositoryInfo};
use tauri::{State, ipc::Channel};

use crate::{commands::blocking, repositories::Repositories};

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
            Operation::CreateBranch { branch } => repository.switch(&branch, true, execution),
            Operation::Fetch { remote } => repository.fetch(&remote, execution),
            Operation::Pull => repository.pull(execution),
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
