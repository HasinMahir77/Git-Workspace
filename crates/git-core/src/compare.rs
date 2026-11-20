use crate::{
    BranchGroups, Comparison, Repository,
    git::{git, git_allow_one, text},
    history::{COMMIT_FORMAT, parse_commits},
};

const COMPARE_COMMIT_LIMIT: u32 = 200;

impl Repository {
    /// Compares the checked-out commit with a local or remote-tracking branch.
    /// Reads only: the index, working tree, and checked-out branch are untouched.
    pub fn compare(&self, other: &str) -> Result<Comparison, String> {
        let current = self.status()?.branch.unwrap_or_else(|| "HEAD".to_string());
        let current_id = self.resolve_commit("HEAD")?;
        let other_id = self.resolve_branch(other)?;
        let merge_base = text(&git_allow_one(
            self.root(),
            ["merge-base", &current_id, &other_id],
        )?)
        .trim()
        .to_string();
        let merge_base = (!merge_base.is_empty()).then_some(merge_base);
        let diff = match &merge_base {
            Some(base) => self.compare_diff(base, &other_id)?,
            None => String::new(),
        };
        Ok(Comparison {
            current,
            other: other.to_string(),
            current_only: self.commits_between(&other_id, &current_id)?,
            other_only: self.commits_between(&current_id, &other_id)?,
            current_id,
            other_id,
            merge_base,
            diff,
        })
    }

    pub fn branch_groups(&self) -> Result<BranchGroups, String> {
        let remote = self
            .lines(&[
                "for-each-ref",
                "--format=%(refname:strip=2)",
                "refs/remotes/",
            ])?
            .into_iter()
            .filter(|name| name.contains('/') && !name.ends_with("/HEAD"))
            .collect();
        Ok(BranchGroups {
            local: self.branches()?,
            remote,
        })
    }

    fn compare_diff(&self, from: &str, to: &str) -> Result<String, String> {
        let output = git(
            self.root(),
            [
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--no-color",
                "--find-renames",
                from,
                to,
                "--",
            ],
        )?;
        Ok(text(&output))
    }

    fn commits_between(
        &self,
        excluded: &str,
        included: &str,
    ) -> Result<Vec<crate::Commit>, String> {
        parse_commits(&git(
            self.root(),
            [
                "log",
                "-z",
                COMMIT_FORMAT,
                &format!("--max-count={COMPARE_COMMIT_LIMIT}"),
                &format!("{excluded}..{included}"),
                "--",
            ],
        )?)
    }

    pub(crate) fn resolve_commit(&self, revision: &str) -> Result<String, String> {
        let output = git(
            self.root(),
            ["rev-parse", "--verify", &format!("{revision}^{{commit}}")],
        )
        .map_err(|_| "That branch has no commits yet.".to_string())?;
        Ok(text(&output).trim().to_string())
    }

    fn resolve_branch(&self, name: &str) -> Result<String, String> {
        self.resolve_commit(&self.branch_reference(name)?)
    }

    pub(crate) fn branch_reference(&self, name: &str) -> Result<String, String> {
        let refs = self.lines(&[
            "for-each-ref",
            "--format=%(refname)",
            "refs/heads/",
            "refs/remotes/",
        ])?;
        ["refs/heads/", "refs/remotes/"]
            .iter()
            .map(|prefix| format!("{prefix}{name}"))
            .find(|candidate| refs.contains(candidate))
            .ok_or_else(|| "That branch is no longer available. Refresh and try again.".into())
    }
}
