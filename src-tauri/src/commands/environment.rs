use crate::{commands::blocking, repositories::Repositories};
use git_gui_core::ToolVersion;
use std::process::{Command, Stdio};
use tauri::State;

#[tauri::command]
pub async fn tool_versions(
    repo: Option<String>,
    state: State<'_, Repositories>,
) -> Result<Vec<ToolVersion>, String> {
    let directory = state.directory(repo.as_deref())?;
    blocking(move || {
        Ok(["git", "gh", "node", "pnpm"]
            .into_iter()
            .map(|name| {
                let mut command = Command::new(name);
                command
                    .arg("--version")
                    .stdin(Stdio::null())
                    .stderr(Stdio::null());
                if let Some(directory) = &directory {
                    command.current_dir(directory);
                }
                let version = command
                    .output()
                    .ok()
                    .filter(|output| output.status.success())
                    .and_then(|output| String::from_utf8(output.stdout).ok())
                    .and_then(|output| {
                        output
                            .lines()
                            .next()
                            .map(|line| line.chars().take(120).collect())
                    });
                ToolVersion {
                    name: name.into(),
                    version,
                }
            })
            .collect())
    })
    .await
}

#[tauri::command]
pub async fn open_terminal(repo: String, state: State<'_, Repositories>) -> Result<(), String> {
    let entry = state.get(&repo)?;
    blocking(move || {
        let directory = entry.repository.root();
        for program in ["gnome-terminal", "x-terminal-emulator"] {
            let mut command = Command::new(program);
            command
                .current_dir(directory)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            if program == "gnome-terminal" {
                command.arg("--working-directory").arg(directory);
            }
            if let Ok(mut child) = command.spawn() {
                std::thread::spawn(move || {
                    let _ = child.wait();
                });
                return Ok(());
            }
        }
        Err("No supported terminal launcher was found.".into())
    })
    .await
}
