use crate::{
    Commit, CommitFile, Execution, Repository,
    git::{git, text},
};

pub const HISTORY_PAGE_SIZE: u32 = 30;

impl Repository {
    pub fn history(&self, offset: u32) -> Result<Vec<Commit>, String> {
        if self.status()?.is_unborn {
            return Ok(Vec::new());
        }
        let output = git(
            self.root(),
            [
                "log",
                "-z",
                COMMIT_FORMAT,
                &format!("--max-count={HISTORY_PAGE_SIZE}"),
                &format!("--skip={offset}"),
                "HEAD",
                "--",
            ],
        )?;
        parse_commits(&output)
    }

    pub fn commit_diff(&self, id: &str, paths: &[String]) -> Result<String, String> {
        require_commit_id(id)?;
        let mut arguments: Vec<&str> = vec![
            "--literal-pathspecs",
            "show",
            "--format=",
            "--root",
            "--diff-merges=first-parent",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--find-renames",
            id,
            "--",
        ];
        arguments.extend(paths.iter().map(String::as_str));
        Ok(text(&git(self.root(), arguments)?))
    }

    /// Lists the files one commit changed, compared with its first parent.
    pub fn commit_files(&self, id: &str) -> Result<Vec<CommitFile>, String> {
        require_commit_id(id)?;
        let output = git(
            self.root(),
            [
                "show",
                "--format=",
                "--root",
                "--diff-merges=first-parent",
                "--name-status",
                "-z",
                "--find-renames",
                id,
                "--",
            ],
        )?;
        let mut fields = output
            .split(|byte| *byte == 0)
            .filter(|field| !field.is_empty());
        let mut files = Vec::new();
        while let Some(status) = fields.next() {
            let status = text(status);
            let letter = status.chars().next().unwrap_or('M');
            let is_pair = matches!(letter, 'R' | 'C');
            let first = text(fields.next().ok_or("Git listed a file without a path.")?);
            let (path, original_path) = if is_pair {
                (
                    text(fields.next().ok_or("Git listed a rename without a path.")?),
                    Some(first),
                )
            } else {
                (first, None)
            };
            files.push(CommitFile {
                path,
                original_path,
                status: letter.to_string(),
            });
        }
        Ok(files)
    }

    pub fn branches(&self) -> Result<Vec<String>, String> {
        self.lines(&["for-each-ref", "--format=%(refname:strip=2)", "refs/heads/"])
    }

    pub fn switch(
        &self,
        branch: &str,
        should_create: bool,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        if should_create {
            if branch.starts_with('-') || branch.starts_with('@') {
                return Err("Enter a valid branch name.".into());
            }
            git(
                self.root(),
                ["check-ref-format", &format!("refs/heads/{branch}")],
            )?;
            crate::git::stream_git(self.root(), &["switch", "--create", branch], execution)
        } else if self.branches()?.iter().any(|name| name == branch) {
            crate::git::stream_git(
                self.root(),
                &["switch", "--no-guess", "--", branch],
                execution,
            )
        } else {
            Err("That local branch is no longer available.".into())
        }
    }
}

pub(crate) const COMMIT_FORMAT: &str = "--format=%H%x00%an%x00%as%x00%s";

pub(crate) fn parse_commits(output: &[u8]) -> Result<Vec<Commit>, String> {
    let output = output.strip_suffix(&[0]).unwrap_or(output);
    if output.is_empty() {
        return Ok(Vec::new());
    }
    let fields: Vec<_> = output.split(|byte| *byte == 0).collect();
    fields
        .chunks(4)
        .map(|fields| {
            let [id, author, date, summary] = fields else {
                return Err("Invalid Git history record".into());
            };
            Ok(Commit {
                id: text(id),
                author: text(author),
                date: text(date),
                summary: text(summary),
            })
        })
        .collect()
}

fn require_commit_id(id: &str) -> Result<(), String> {
    if matches!(id.len(), 40 | 64) && id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err("Invalid commit ID".into())
    }
}
