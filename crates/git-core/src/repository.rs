use std::{
    ffi::{OsStr, OsString},
    os::unix::ffi::{OsStrExt, OsStringExt},
    path::{Path, PathBuf},
};

use crate::{
    ChangedFile, Execution, Status,
    git::{git, git_allow_one, parse_status, stream_git, text},
};

#[derive(Clone)]
pub struct Repository {
    root: PathBuf,
    common_directory: PathBuf,
}

impl Repository {
    pub fn init_into(parent: &Path, name: &str) -> Result<Self, String> {
        validate_folder_name(name)?;
        let directory = parent.join(name);
        std::fs::create_dir(&directory).map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                "That destination already exists. Choose a new folder name.".to_owned()
            } else {
                format!("Could not create the repository folder: {error}")
            }
        })?;
        if let Err(error) = git(&directory, ["init"]) {
            let _ = std::fs::remove_dir(&directory);
            return Err(error);
        }
        Self::open(&directory)
    }

    pub fn clone_into(
        parent: &Path,
        name: &str,
        source: &str,
        execution: &Execution<'_>,
    ) -> Result<Self, String> {
        validate_folder_name(name)?;
        if source.trim().is_empty() {
            return Err("Enter a repository URL or local path.".into());
        }
        stream_git(
            parent,
            &[
                "-c",
                "protocol.ext.allow=never",
                "clone",
                "--progress",
                "--",
                source,
                name,
            ],
            execution,
        )?;
        Self::open(&parent.join(name))
    }

    pub fn open(directory: &Path) -> Result<Self, String> {
        let root = path_output(&git(directory, ["rev-parse", "--show-toplevel"])?);
        let common_directory = path_output(&git(
            &root,
            ["rev-parse", "--path-format=absolute", "--git-common-dir"],
        )?)
        .canonicalize()
        .map_err(|error| error.to_string())?;
        Ok(Self {
            root,
            common_directory,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn common_directory(&self) -> &Path {
        &self.common_directory
    }

    pub fn status(&self) -> Result<Status, String> {
        parse_status(&git(
            self.root(),
            [
                "--no-optional-locks",
                "status",
                "--porcelain=v2",
                "--branch",
                "-z",
                "--untracked-files=all",
            ],
        )?)
    }

    pub fn commit(
        &self,
        summary: &str,
        body: &str,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        if summary.trim().is_empty() || summary.contains(['\r', '\n']) {
            return Err("Enter a one-line commit summary.".into());
        }
        let mut arguments = vec!["commit", "-m", summary.trim()];
        if !body.trim().is_empty() {
            arguments.extend(["-m", body]);
        }
        stream_git(self.root(), &arguments, execution)
    }

    pub fn stage(&self, id: &str) -> Result<(), String> {
        let (_, file) = self.changed_file(id)?;
        self.with_path(
            &["--literal-pathspecs", "add", "--"],
            &file,
            file.unstaged == "R",
        )?;
        Ok(())
    }

    pub fn diff(&self, id: &str, is_staged: bool) -> Result<String, String> {
        let (_, file) = self.changed_file(id)?;
        let output = if !is_staged && file.unstaged == "?" {
            let mut path = OsString::from("./");
            path.push(decode_path(id)?);
            git_allow_one(
                self.root(),
                [
                    OsString::from("diff"),
                    "--no-index".into(),
                    "--no-ext-diff".into(),
                    "--no-textconv".into(),
                    "--".into(),
                    "/dev/null".into(),
                    path,
                ],
            )?
        } else {
            let mut arguments = vec![
                "--literal-pathspecs",
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--find-renames",
            ];
            if is_staged {
                arguments.push("--cached");
            }
            arguments.push("--");
            self.with_path(&arguments, &file, true)?
        };
        Ok(text(&output))
    }

    pub fn unstage(&self, id: &str) -> Result<(), String> {
        let (is_unborn, file) = self.changed_file(id)?;
        if file.has_conflict {
            return Err("Resolve the conflict before unstaging this file.".into());
        }
        let arguments: &[&str] = if is_unborn {
            &["--literal-pathspecs", "rm", "--cached", "--"]
        } else {
            &["--literal-pathspecs", "restore", "--staged", "--"]
        };
        self.with_path(arguments, &file, file.staged == "R")?;
        Ok(())
    }

    pub(crate) fn changed_file(&self, id: &str) -> Result<(bool, ChangedFile), String> {
        let status = self.status()?;
        let file = status
            .files
            .into_iter()
            .find(|file| file.id == id)
            .ok_or("This file is no longer in the change list. Refresh and try again.")?;
        Ok((status.is_unborn, file))
    }

    pub(crate) fn with_path(
        &self,
        arguments: &[&str],
        file: &ChangedFile,
        has_original: bool,
    ) -> Result<Vec<u8>, String> {
        let mut arguments: Vec<OsString> = arguments.iter().map(OsString::from).collect();
        arguments.push(decode_path(&file.id)?);
        if let Some(original) = file.original_id.as_deref().filter(|_| has_original) {
            arguments.push(decode_path(original)?);
        }
        git(self.root(), arguments)
    }
}

fn validate_folder_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() || name.contains(['/', '\0']) || name == "." || name == ".." {
        return Err("Enter a single folder name for the checkout.".into());
    }
    Ok(())
}

fn path_output(bytes: &[u8]) -> PathBuf {
    OsStr::from_bytes(bytes.strip_suffix(b"\n").unwrap_or(bytes)).into()
}

pub(crate) fn decode_path(id: &str) -> Result<OsString, String> {
    let bytes = id
        .as_bytes()
        .chunks(2)
        .map(|pair| {
            std::str::from_utf8(pair)
                .ok()
                .and_then(|value| u8::from_str_radix(value, 16).ok())
        })
        .collect::<Option<Vec<_>>>()
        .ok_or("Invalid file ID")?;
    Ok(OsString::from_vec(bytes))
}
