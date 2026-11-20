use std::{fs, os::unix::ffi::OsStrExt, path::Path, process::Command};

use crate::{Repository, git::git};

const UNTRACKED: &str = "?";
const ADDED: &str = "A";
const RENAMED: &str = "R";

impl Repository {
    /// Throws away one file's changes the way GitHub Desktop does: tracked files return
    /// to `HEAD`, and files that never existed in `HEAD` go to the freedesktop Trash at
    /// `trash`, so the user can still recover them.
    pub fn discard(&self, id: &str, trash: &Path) -> Result<(), String> {
        self.require_no_paused_operation()?;
        let (_, file) = self.changed_file(id)?;
        if file.has_conflict {
            return Err("Resolve the conflict before discarding this file.".into());
        }
        let is_new = file.unstaged == UNTRACKED
            || file.staged == ADDED
            || file.staged == RENAMED
            || file.unstaged == RENAMED;
        if is_new {
            if file.staged != "." {
                self.with_path(
                    &["--literal-pathspecs", "rm", "--cached", "-r", "-f", "--"],
                    &file,
                    false,
                )?;
            }
            let path = self.root().join(super::repository::decode_path(&file.id)?);
            if path.symlink_metadata().is_ok() {
                move_to_trash(&path, trash, false)?;
            }
            if let Some(original) = file.original_id.as_deref() {
                git(
                    self.root(),
                    [
                        std::ffi::OsString::from("--literal-pathspecs"),
                        "restore".into(),
                        "--source=HEAD".into(),
                        "--staged".into(),
                        "--worktree".into(),
                        "--".into(),
                        super::repository::decode_path(original)?,
                    ],
                )?;
            }
        } else {
            let path = self.root().join(super::repository::decode_path(&file.id)?);
            if path.is_file() {
                move_to_trash(&path, trash, true)?;
            }
            self.with_path(
                &[
                    "--literal-pathspecs",
                    "restore",
                    "--source=HEAD",
                    "--staged",
                    "--worktree",
                    "--",
                ],
                &file,
                false,
            )?;
        }
        Ok(())
    }
}

/// Moves `path` into the Trash, or leaves it in place and trashes a copy when `should_keep`.
fn move_to_trash(path: &Path, trash: &Path, should_keep: bool) -> Result<(), String> {
    let files = trash.join("files");
    let info = trash.join("info");
    fs::create_dir_all(&files)
        .and_then(|()| fs::create_dir_all(&info))
        .map_err(|error| format!("Could not open the Trash: {error}"))?;
    let name = path
        .file_name()
        .ok_or("This path cannot be moved to the Trash.")?;
    let (target, record) = (1..)
        .map(|attempt| {
            let mut candidate = name.to_os_string();
            if attempt > 1 {
                candidate.push(format!(" {attempt}"));
            }
            let mut record = candidate.clone();
            record.push(".trashinfo");
            (files.join(&candidate), info.join(record))
        })
        .find(|(target, record)| !target.exists() && !record.exists())
        .expect("an unused Trash name exists");
    let absolute = fs::canonicalize(path).map_err(|error| error.to_string())?;
    fs::write(
        &record,
        format!(
            "[Trash Info]\nPath={}\nDeletionDate={}\n",
            percent_encode(&absolute),
            deletion_date()
        ),
    )
    .map_err(|error| format!("Could not write the Trash record: {error}"))?;
    let moved = if should_keep {
        fs::copy(path, &target).map(|_| ())
    } else {
        fs::rename(path, &target)
    };
    moved.map_err(|error| {
        let _ = fs::remove_file(&record);
        format!(
            "Could not move {} to the Trash: {error}",
            name.to_string_lossy()
        )
    })
}

fn deletion_date() -> String {
    Command::new("date")
        .arg("+%Y-%m-%dT%H:%M:%S")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|date| date.trim().to_owned())
        .unwrap_or_else(|| "1970-01-01T00:00:00".into())
}

fn percent_encode(path: &Path) -> String {
    path.as_os_str()
        .as_bytes()
        .iter()
        .map(|byte| match byte {
            b'/' | b'.' | b'-' | b'_' | b'~' | b'0'..=b'9' | b'a'..=b'z' | b'A'..=b'Z' => {
                (*byte as char).to_string()
            }
            other => format!("%{other:02X}"),
        })
        .collect()
}
