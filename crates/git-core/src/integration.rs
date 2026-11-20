use crate::{
    Execution, IntegrationKind, Recovery, Repository,
    git::{git, git_allow_one, stream_git, stream_git_without_editor, text},
};

impl Repository {
    /// Merges a local or remote-tracking branch into the checked-out branch.
    /// `expected_id` is the commit the user previewed; a moved branch is refused.
    pub fn merge(
        &self,
        other: &str,
        expected_id: &str,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        self.require_clean_worktree("Merge")?;
        let reference = self.confirmed_reference(other, expected_id)?;
        let result =
            stream_git_without_editor(self.root(), &["merge", "--no-edit", &reference], execution);
        self.report_pause(result)
    }

    /// Rebases the checked-out branch onto a local or remote-tracking branch.
    /// Git decides which commits replay; their IDs change.
    pub fn rebase(
        &self,
        onto: &str,
        expected_id: &str,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        if self.status()?.branch.is_none() {
            return Err("Switch to a branch before rebasing.".into());
        }
        self.require_clean_worktree("Rebase")?;
        let reference = self.confirmed_reference(onto, expected_id)?;
        let result = stream_git_without_editor(self.root(), &["rebase", &reference], execution);
        self.report_pause(result)
    }

    /// Applies one non-merge commit to the checked-out branch, or to another
    /// local branch that is checked out first and stays checked out.
    pub fn cherry_pick(
        &self,
        commit: &str,
        destination: Option<&str>,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        if !matches!(commit.len(), 40 | 64) || !commit.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return Err("Invalid commit ID".into());
        }
        let commit = self.resolve_commit(commit)?;
        let parents = text(&git(
            self.root(),
            ["rev-list", "--parents", "-n1", &commit],
        )?);
        if parents.split_whitespace().count() > 2 {
            return Err(
                "This is a merge commit, which needs a mainline choice. Use Open in Terminal to cherry-pick it.".into(),
            );
        }
        let destination = destination.filter(|name| {
            self.status()
                .map(|s| s.branch.as_deref() != Some(name))
                .unwrap_or(true)
        });
        if let Some(branch) = destination {
            self.require_clean_worktree("Cherry-pick")?;
            self.switch(branch, false, execution)?;
        }
        let result = stream_git_without_editor(self.root(), &["cherry-pick", &commit], execution);
        self.report_pause(result)
    }

    /// Adds a commit that undoes one non-merge commit.
    pub fn revert_commit(&self, commit: &str, execution: &Execution<'_>) -> Result<(), String> {
        self.require_no_paused_operation()?;
        let commit = self.resolve_commit(commit)?;
        let parents = text(&git(
            self.root(),
            ["rev-list", "--parents", "-n1", &commit],
        )?);
        if parents.split_whitespace().count() > 2 {
            return Err(
                "This is a merge commit, which needs a mainline choice. Use Open in Terminal to revert it.".into(),
            );
        }
        self.require_clean_worktree("Revert")?;
        let result =
            stream_git_without_editor(self.root(), &["revert", "--no-edit", &commit], execution);
        self.report_pause(result)
    }

    /// Detaches HEAD at a commit from the history list.
    pub fn checkout_commit(&self, commit: &str, execution: &Execution<'_>) -> Result<(), String> {
        self.require_no_paused_operation()?;
        let commit = self.resolve_commit(commit)?;
        stream_git(self.root(), &["switch", "--detach", &commit], execution)
    }

    /// Creates a branch at a commit and checks it out.
    pub fn create_branch_at(
        &self,
        branch: &str,
        commit: &str,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        if branch.starts_with('-') || branch.starts_with('@') {
            return Err("Enter a valid branch name.".into());
        }
        git(
            self.root(),
            ["check-ref-format", &format!("refs/heads/{branch}")],
        )?;
        let commit = self.resolve_commit(commit)?;
        stream_git(
            self.root(),
            &["switch", "--create", branch, &commit],
            execution,
        )
    }

    /// Checks out a remote-tracking branch as a local branch that tracks it,
    /// reusing a local branch that already tracks the same remote branch.
    pub fn checkout_remote(
        &self,
        remote_branch: &str,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        let reference = self.branch_reference(remote_branch)?;
        if !reference.starts_with("refs/remotes/") {
            return Err("Choose a remote-tracking branch.".into());
        }
        let local = self
            .remotes()?
            .iter()
            .filter_map(|remote| remote_branch.strip_prefix(&format!("{remote}/")))
            .next()
            .ok_or("That remote is no longer configured.")?
            .to_string();
        if self.branches()?.contains(&local) {
            let upstream = git_allow_one(
                self.root(),
                [
                    "rev-parse",
                    "--abbrev-ref",
                    &format!("{local}@{{upstream}}"),
                ],
            )
            .map(|bytes| text(&bytes).trim().to_string())
            .unwrap_or_default();
            if upstream == remote_branch {
                return self.switch(&local, false, execution);
            }
            return Err(format!(
                "A local branch named {local} already exists and does not track {remote_branch}. Switch to it from the local list or rename it in Terminal."
            ));
        }
        stream_git(
            self.root(),
            &["switch", "--create", &local, "--track", &reference],
            execution,
        )
    }

    fn confirmed_reference(&self, name: &str, expected_id: &str) -> Result<String, String> {
        let reference = self.branch_reference(name)?;
        if self.resolve_commit(&reference)? != expected_id {
            return Err(format!(
                "{name} changed since you previewed it. Refresh the comparison and try again."
            ));
        }
        Ok(reference)
    }

    fn report_pause(&self, result: Result<(), String>) -> Result<(), String> {
        if result.is_err()
            && let Some(kind) = self.recovery()?.kind
        {
            return Err(format!(
                "{} paused. Review the unresolved files in the bar below, then continue, skip, or abort.",
                kind.label()
            ));
        }
        result
    }

    /// Reads which operation, if any, owns this worktree, using Git to locate
    /// the per-worktree state so linked worktrees are handled.
    pub fn recovery(&self) -> Result<Recovery, String> {
        let kind = [
            ("MERGE_HEAD", IntegrationKind::Merge),
            ("rebase-merge", IntegrationKind::Rebase),
            ("rebase-apply", IntegrationKind::Rebase),
            ("CHERRY_PICK_HEAD", IntegrationKind::CherryPick),
            ("REVERT_HEAD", IntegrationKind::Revert),
        ]
        .into_iter()
        .find_map(|(name, kind)| self.has_git_path(name).transpose().map(|r| r.map(|_| kind)))
        .transpose()?;
        let unmerged = self
            .status()?
            .files
            .into_iter()
            .filter(|file| file.has_conflict)
            .collect();
        Ok(Recovery { kind, unmerged })
    }

    fn has_git_path(&self, name: &str) -> Result<Option<()>, String> {
        let path = text(&git(
            self.root(),
            ["rev-parse", "--path-format=absolute", "--git-path", name],
        )?);
        Ok(std::path::Path::new(path.trim()).exists().then_some(()))
    }

    pub fn continue_integration(&self, execution: &Execution<'_>) -> Result<(), String> {
        let recovery = self.recovery()?;
        let kind = recovery.kind.ok_or("No operation is in progress.")?;
        if !recovery.unmerged.is_empty() {
            return Err(
                "Some files still have unresolved conflicts. Mark each one resolved first.".into(),
            );
        }
        let args: &[&str] = match kind {
            IntegrationKind::Merge => &["commit", "--no-edit"],
            IntegrationKind::Rebase => &["rebase", "--continue"],
            IntegrationKind::CherryPick => &["cherry-pick", "--continue"],
            IntegrationKind::Revert => &["revert", "--continue"],
        };
        let result = stream_git_without_editor(self.root(), args, execution);
        self.report_pause(result)
    }

    pub fn abort_integration(&self, execution: &Execution<'_>) -> Result<(), String> {
        let kind = self
            .recovery()?
            .kind
            .ok_or("No operation is in progress.")?;
        let args: &[&str] = match kind {
            IntegrationKind::Merge => &["merge", "--abort"],
            IntegrationKind::Rebase => &["rebase", "--abort"],
            IntegrationKind::CherryPick => &["cherry-pick", "--abort"],
            IntegrationKind::Revert => &["revert", "--abort"],
        };
        stream_git(self.root(), args, execution)
    }

    /// Drops the commit Git stopped on, for example one that became empty.
    pub fn skip_integration(&self, execution: &Execution<'_>) -> Result<(), String> {
        let kind = self
            .recovery()?
            .kind
            .ok_or("No operation is in progress.")?;
        let args: &[&str] = match kind {
            IntegrationKind::Merge => {
                return Err("A merge cannot be skipped. Continue or abort it.".into());
            }
            IntegrationKind::Rebase => &["rebase", "--skip"],
            IntegrationKind::CherryPick => &["cherry-pick", "--skip"],
            IntegrationKind::Revert => &["revert", "--skip"],
        };
        let result = stream_git_without_editor(self.root(), args, execution);
        self.report_pause(result)
    }

    /// Writes that move HEAD or the index must not run while a paused
    /// operation owns the worktree.
    pub(crate) fn require_no_paused_operation(&self) -> Result<(), String> {
        match self.recovery()?.kind {
            Some(kind) => Err(format!(
                "A {} is in progress. Continue or abort it first.",
                kind.label().to_lowercase()
            )),
            None => Ok(()),
        }
    }

    fn require_clean_worktree(&self, action: &str) -> Result<(), String> {
        if self.status()?.files.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "{action} needs a clean working tree. Commit or stash your changes in Changes first."
            ))
        }
    }
}
