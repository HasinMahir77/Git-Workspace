use crate::{
    CommitMessage, Execution, Repository,
    git::{git, git_allow_one, stream_git, stream_git_with_todo, text},
};

impl Repository {
    /// The subject and body of the commit HEAD points at.
    pub fn head_message(&self) -> Result<CommitMessage, String> {
        let output = text(&git(self.root(), ["log", "-1", "--format=%s%x00%b"])?);
        let (summary, body) = output.split_once('\0').unwrap_or((&output, ""));
        Ok(CommitMessage {
            summary: summary.trim().to_owned(),
            body: body.trim().to_owned(),
        })
    }

    /// Takes the last commit back and keeps its changes staged.
    pub fn undo_commit(&self) -> Result<(), String> {
        self.require_no_paused_operation()?;
        if self.status()?.is_unborn {
            return Err("There is no commit to undo.".into());
        }
        let parents = text(&git(self.root(), ["rev-list", "--parents", "-n1", "HEAD"])?);
        match parents.split_whitespace().count() {
            0 => Err("There is no commit to undo.".into()),
            1 => git(self.root(), ["update-ref", "-d", "HEAD"]).map(drop),
            2 => git(self.root(), ["reset", "--soft", "HEAD~1"]).map(drop),
            3.. => Err("Undo is not available for a merge commit.".into()),
        }
    }

    /// Replaces the last commit with its staged changes and a new message.
    pub fn amend(
        &self,
        summary: &str,
        body: &str,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        if self.status()?.is_unborn {
            return Err("There is no commit to amend.".into());
        }
        if summary.trim().is_empty() || summary.contains(['\r', '\n']) {
            return Err("Enter a one-line commit summary.".into());
        }
        let mut arguments = vec!["commit", "--amend", "-m", summary.trim()];
        if !body.trim().is_empty() {
            arguments.extend(["-m", body]);
        }
        stream_git(self.root(), &arguments, execution)
    }

    pub fn delete_branch(&self, branch: &str, should_force: bool) -> Result<(), String> {
        if self.status()?.branch.as_deref() == Some(branch) {
            return Err("You cannot delete the current branch. Switch to another one first.".into());
        }
        self.require_local_branch(branch)?;
        let flag = if should_force { "-D" } else { "-d" };
        git(self.root(), ["branch", flag, "--", branch]).map(drop)
    }

    pub fn rename_branch(&self, from: &str, to: &str) -> Result<(), String> {
        self.require_local_branch(from)?;
        if to.starts_with('-') || to.starts_with('@') {
            return Err("Enter a valid branch name.".into());
        }
        git(self.root(), ["check-ref-format", &format!("refs/heads/{to}")])?;
        git(self.root(), ["branch", "--move", "--", from, to]).map(drop)
    }

    fn require_local_branch(&self, branch: &str) -> Result<(), String> {
        if self.branches()?.iter().any(|name| name == branch) {
            Ok(())
        } else {
            Err("That local branch is no longer available.".into())
        }
    }

    /// Folds `commit` into the older `onto` commit on the current branch, keeping `onto`'s message.
    pub fn squash(
        &self,
        commit: &str,
        onto: &str,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        if self.status()?.branch.is_none() {
            return Err("Switch to a branch before squashing.".into());
        }
        if !self.status()?.files.is_empty() {
            return Err(
                "Squash needs a clean working tree. Commit or stash your changes in Changes first."
                    .into(),
            );
        }
        let commit = self.resolve_commit(commit)?;
        let onto = self.resolve_commit(onto)?;
        if commit == onto {
            return Err("Choose two different commits.".into());
        }
        let range = text(&git(self.root(), ["rev-list", "--first-parent", "--reverse", "HEAD"])?);
        let chain: Vec<&str> = range.lines().collect();
        let (Some(onto_index), Some(commit_index)) = (
            chain.iter().position(|id| *id == onto),
            chain.iter().position(|id| *id == commit),
        ) else {
            return Err("Both commits must be on the current branch.".into());
        };
        if commit_index < onto_index {
            return Err("Drop a commit onto an older commit to squash them.".into());
        }
        let affected = &chain[onto_index..];
        let merges = text(&git(
            self.root(),
            ["rev-list", "--merges", "--first-parent", &format!("{onto}..HEAD")],
        )?);
        if !merges.trim().is_empty() {
            return Err("There is a merge commit in between. Squash it in Terminal.".into());
        }
        let mut todo = String::new();
        for id in affected {
            if *id == commit {
                continue;
            }
            todo.push_str(&format!("pick {id}\n"));
            if *id == onto {
                todo.push_str(&format!("fixup {commit}\n"));
            }
        }
        let directory = tempfile::Builder::new()
            .prefix("git-workspace-squash")
            .tempdir()
            .map_err(|error| format!("Could not prepare the squash: {error}"))?;
        let todo_path = directory.path().join("todo");
        std::fs::write(&todo_path, todo).map_err(|error| error.to_string())?;
        let has_parent = git_allow_one(self.root(), ["rev-parse", "--verify", &format!("{onto}^")])
            .map(|bytes| !bytes.is_empty())
            .unwrap_or(false);
        let base = format!("{onto}^");
        let arguments: Vec<&str> = if has_parent {
            vec!["rebase", "--interactive", &base]
        } else {
            vec!["rebase", "--interactive", "--root"]
        };
        let result = stream_git_with_todo(self.root(), &arguments, &todo_path, execution);
        if result.is_err() && self.recovery()?.kind.is_some() {
            return Err("Squash paused. Review the unresolved files in the bar below, then continue, skip, or abort.".into());
        }
        result
    }
}
