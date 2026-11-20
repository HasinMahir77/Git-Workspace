use std::{
    ffi::OsStr,
    os::unix::fs::PermissionsExt,
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
};

use tauri::State;

use crate::{commands::blocking, repositories::Repositories};

const EDITORS: [(&str, &str); 6] = [
    ("code", "Visual Studio Code"),
    ("codium", "VSCodium"),
    ("subl", "Sublime Text"),
    ("zed", "Zed"),
    ("gedit", "Text Editor"),
    ("kate", "Kate"),
];

/// Files that would run something when opened by their default handler.
const UNSAFE_EXTENSIONS: [&str; 12] = [
    "sh", "bash", "run", "appimage", "desktop", "bin", "exe", "bat", "cmd", "com", "jar", "scr",
];

fn spawn_detached(program: impl AsRef<OsStr>, arguments: &[&OsStr]) -> Result<(), String> {
    let program = program.as_ref();
    let mut child = Command::new(program)
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not start {}: {error}", program.to_string_lossy()))?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

/// Resolves a repository-relative path without letting it leave the checkout.
/// A path that no longer exists resolves to its nearest existing parent.
fn inside_checkout(root: &Path, relative: Option<&str>) -> Result<PathBuf, String> {
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    let Some(relative) = relative else {
        return Ok(root);
    };
    let relative = Path::new(relative);
    if relative
        .components()
        .any(|part| !matches!(part, Component::Normal(_) | Component::CurDir))
    {
        return Err("That path is outside the repository.".into());
    }
    let mut path = root.join(relative);
    while !path.exists() {
        if !path.pop() {
            return Ok(root);
        }
    }
    let path = path.canonicalize().map_err(|error| error.to_string())?;
    if path.starts_with(&root) {
        Ok(path)
    } else {
        Err("That path is outside the repository.".into())
    }
}

fn find_editor() -> Option<(&'static str, &'static str)> {
    let paths = std::env::var_os("PATH")?;
    EDITORS.into_iter().find(|(program, _)| {
        std::env::split_paths(&paths).any(|directory| directory.join(program).is_file())
    })
}

#[tauri::command]
pub fn external_editor() -> Option<String> {
    find_editor().map(|(_, label)| label.into())
}

#[tauri::command]
pub async fn reveal_in_file_manager(
    repo: String,
    path: Option<String>,
    state: State<'_, Repositories>,
) -> Result<(), String> {
    let entry = state.get(&repo)?;
    blocking(move || {
        let target = inside_checkout(entry.repository.root(), path.as_deref())?;
        let folder = if target.is_dir() {
            target
        } else {
            target.parent().map(Path::to_path_buf).unwrap_or(target)
        };
        spawn_detached("xdg-open", &[folder.as_os_str()])
    })
    .await
}

#[tauri::command]
pub async fn open_in_editor(
    repo: String,
    path: Option<String>,
    state: State<'_, Repositories>,
) -> Result<(), String> {
    let entry = state.get(&repo)?;
    blocking(move || {
        let (program, _) = find_editor().ok_or("No supported code editor was found.")?;
        let target = inside_checkout(entry.repository.root(), path.as_deref())?;
        spawn_detached(program, &[target.as_os_str()])
    })
    .await
}

#[tauri::command]
pub async fn open_with_default_program(
    repo: String,
    path: String,
    state: State<'_, Repositories>,
) -> Result<(), String> {
    let entry = state.get(&repo)?;
    blocking(move || {
        let target = inside_checkout(entry.repository.root(), Some(&path))?;
        let extension = target
            .extension()
            .and_then(OsStr::to_str)
            .map(str::to_lowercase)
            .unwrap_or_default();
        let is_executable = target
            .metadata()
            .map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
            .unwrap_or(false);
        if !target.is_file() || is_executable || UNSAFE_EXTENSIONS.contains(&extension.as_str()) {
            return Err("This file type is not opened from here. Use your editor instead.".into());
        }
        spawn_detached("xdg-open", &[target.as_os_str()])
    })
    .await
}

#[tauri::command]
pub async fn open_on_github(
    repo: String,
    commit: Option<String>,
    state: State<'_, Repositories>,
) -> Result<(), String> {
    let entry = state.get(&repo)?;
    blocking(move || {
        let url = entry
            .repository
            .github_url(commit.as_deref())?
            .ok_or("This repository does not have a github.com remote.")?;
        spawn_detached("xdg-open", &[OsStr::new(&url)])
    })
    .await
}

#[tauri::command]
pub async fn has_github_remote(
    repo: String,
    state: State<'_, Repositories>,
) -> Result<bool, String> {
    let entry = state.get(&repo)?;
    blocking(move || Ok(entry.repository.github_url(None)?.is_some())).await
}

/// The freedesktop Trash directory discarded files are moved into.
pub fn trash_directory() -> Result<PathBuf, String> {
    let data = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .or_else(|| std::env::var_os("HOME").map(|home| Path::new(&home).join(".local/share")))
        .ok_or("Could not find your Trash folder.")?;
    Ok(data.join("Trash"))
}
