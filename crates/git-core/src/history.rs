use crate::{
    Commit, Execution, Repository,
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
                "--format=%H%x00%an%x00%as%x00%s",
                &format!("--max-count={HISTORY_PAGE_SIZE}"),
                &format!("--skip={offset}"),
                "HEAD",
                "--",
            ],
        )?;
        let output = output.strip_suffix(&[0]).unwrap_or(&output);
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

    pub fn commit_diff(&self, id: &str) -> Result<String, String> {
        if !matches!(id.len(), 40 | 64) || !id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Invalid commit ID".into());
        }
        let output = git(
            self.root(),
            [
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
            ],
        )?;
        Ok(text(&output))
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
