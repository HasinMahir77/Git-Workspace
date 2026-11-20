use std::{
    process::{Command, Stdio},
    sync::{Arc, Mutex},
};

use git_gui_core::{Cancellation, Execution, GitHubAccounts, GitHubCli};
use tauri::{State, ipc::Channel};

use super::blocking;

#[derive(Clone, Default)]
pub struct AccountActions(Arc<Mutex<Option<Cancellation>>>);

#[tauri::command]
pub async fn github_accounts() -> Result<GitHubAccounts, String> {
    blocking(|| GitHubCli::default().accounts()).await
}

#[tauri::command]
pub async fn sign_in_to_github(
    code: Channel<String>,
    state: State<'_, AccountActions>,
) -> Result<(), String> {
    let actions = state.inner().clone();
    let cancellation = {
        let mut slot = actions
            .0
            .lock()
            .map_err(|_| "GitHub account controls are unavailable.")?;
        if slot.is_some() {
            return Err("A GitHub sign-in is already in progress.".into());
        }
        let cancellation = Cancellation::default();
        *slot = Some(cancellation.clone());
        cancellation
    };
    let worker_cancellation = cancellation.clone();
    let result = blocking(move || {
        let emit = |device_code| {
            let _ = code.send(device_code);
        };
        GitHubCli::default().sign_in(&Execution::cancellable(&emit, &worker_cancellation))
    })
    .await;
    *actions
        .0
        .lock()
        .map_err(|_| "GitHub account controls are unavailable.")? = None;
    result
}

#[tauri::command]
pub fn cancel_github_sign_in(state: State<'_, AccountActions>) -> Result<(), String> {
    if let Some(cancellation) = state
        .0
        .lock()
        .map_err(|_| "GitHub account controls are unavailable.")?
        .as_ref()
    {
        cancellation.cancel();
    }
    Ok(())
}

#[tauri::command]
pub async fn switch_github_account(
    login: String,
    state: State<'_, AccountActions>,
) -> Result<(), String> {
    change_account(state.inner().clone(), move |cli| cli.switch_account(&login)).await
}

#[tauri::command]
pub async fn setup_github_https(state: State<'_, AccountActions>) -> Result<(), String> {
    change_account(state.inner().clone(), |cli| cli.setup_git_https()).await
}

async fn change_account(
    actions: AccountActions,
    action: impl FnOnce(GitHubCli) -> Result<(), String> + Send + 'static,
) -> Result<(), String> {
    blocking(move || {
        let slot = actions
            .0
            .lock()
            .map_err(|_| "GitHub account controls are unavailable.")?;
        if slot.is_some() {
            return Err("Finish or cancel GitHub sign-in first.".into());
        }
        action(GitHubCli::default())
    })
    .await
}

#[tauri::command]
pub async fn open_github_device_verification() -> Result<(), String> {
    blocking(|| {
        let status = Command::new("xdg-open")
            .arg("https://github.com/login/device")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|_| "Could not open the browser. Visit github.com/login/device.")?;
        if status.success() {
            Ok(())
        } else {
            Err("Could not open the browser. Visit github.com/login/device.".into())
        }
    })
    .await
}
