use crate::{
    Execution, Repository, StashEntry,
    git::{git, stream_git, text},
};

impl Repository {
    pub fn stashes(&self) -> Result<Vec<StashEntry>, String> {
        let output = git(self.root(), ["stash", "list", "-z", "--format=%H%x1f%gs"])?;
        output
            .split(|byte| *byte == 0)
            .filter(|record| !record.is_empty())
            .map(|record| {
                let record = text(record);
                let (id, message) = record.split_once('\x1f').ok_or("Invalid stash record")?;
                Ok(StashEntry {
                    id: id.into(),
                    message: message.into(),
                })
            })
            .collect()
    }

    pub fn stash_push(
        &self,
        should_include_untracked: bool,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        let files = self.status()?.files;
        if files.is_empty() {
            return Err("There are no changes to stash.".into());
        }
        if !should_include_untracked && files.iter().all(|file| file.unstaged == "?") {
            return Err(
                "Only untracked files changed. Turn on Include untracked files to stash them."
                    .into(),
            );
        }
        let mut arguments = vec!["stash", "push"];
        if should_include_untracked {
            arguments.push("--include-untracked");
        }
        stream_git(self.root(), &arguments, execution)
    }

    /// Restores a stash with its staging and keeps the entry until it is dropped.
    pub fn stash_apply(&self, id: &str, execution: &Execution<'_>) -> Result<(), String> {
        self.require_no_paused_operation()?;
        let reference = self.stash_reference(id)?;
        stream_git(
            self.root(),
            &["stash", "apply", "--index", &reference],
            execution,
        )
    }

    pub fn stash_drop(&self, id: &str) -> Result<(), String> {
        let reference = self.stash_reference(id)?;
        git(self.root(), ["stash", "drop", &reference])?;
        Ok(())
    }

    /// Finds the entry the user reviewed, since positions shift as stashes change.
    fn stash_reference(&self, id: &str) -> Result<String, String> {
        self.stashes()?
            .iter()
            .position(|entry| entry.id == id)
            .map(|index| format!("stash@{{{index}}}"))
            .ok_or_else(|| {
                "That stash entry changed or no longer exists. Refresh and try again.".into()
            })
    }
}
