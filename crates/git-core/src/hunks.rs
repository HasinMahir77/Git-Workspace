use crate::{ChangedFile, Repository, git::git_with_input};

const WHOLE_FILE_ONLY: &str =
    "This change can only be staged as a whole file. Use the file's Stage or Unstage button.";
const HUNK_CHANGED: &str = "This hunk changed since you opened it. Refresh and try again.";

impl Repository {
    /// Stages one hunk from the unstaged diff after checking it against the current files.
    pub fn stage_hunk(&self, id: &str, index: usize, header: &str) -> Result<(), String> {
        self.apply_hunk(id, index, header, false)
    }

    /// Removes one hunk from the index by applying it in reverse.
    pub fn unstage_hunk(&self, id: &str, index: usize, header: &str) -> Result<(), String> {
        self.apply_hunk(id, index, header, true)
    }

    fn apply_hunk(
        &self,
        id: &str,
        index: usize,
        header: &str,
        is_staged: bool,
    ) -> Result<(), String> {
        self.require_no_paused_operation()?;
        let (_, file) = self.changed_file(id)?;
        if !is_hunk_editable(&file, is_staged) {
            return Err(WHOLE_FILE_ONLY.into());
        }
        let diff = self.patch_bytes(&file, is_staged)?;
        let (file_header, hunks) = split_hunks(&diff);
        if hunks.is_empty() {
            return Err(WHOLE_FILE_ONLY.into());
        }
        let hunk = hunks.get(index).ok_or(HUNK_CHANGED)?;
        if hunk.split(|byte| *byte == b'\n').next() != Some(header.as_bytes()) {
            return Err(HUNK_CHANGED.into());
        }
        let patch = [file_header, hunk].concat();
        let mut arguments = vec!["apply", "--cached", "--whitespace=nowarn"];
        if is_staged {
            arguments.push("--reverse");
        }
        arguments.push("-");
        git_with_input(self.root(), arguments, &patch)
            .map_err(|error| format!("{HUNK_CHANGED} ({})", error.trim()))?;
        Ok(())
    }

    fn patch_bytes(&self, file: &ChangedFile, is_staged: bool) -> Result<Vec<u8>, String> {
        let mut arguments = vec![
            "--literal-pathspecs",
            "diff",
            "--no-ext-diff",
            "--no-textconv",
        ];
        if is_staged {
            arguments.push("--cached");
        }
        arguments.push("--");
        self.with_path(&arguments, file, false)
    }
}

/// Only plain text modifications and additions to tracked files are offered by hunk.
fn is_hunk_editable(file: &ChangedFile, is_staged: bool) -> bool {
    let state = if is_staged {
        &file.staged
    } else {
        &file.unstaged
    };
    !file.has_conflict
        && file.original_path.is_none()
        && state != "?"
        && state != "R"
        && state != "C"
}

fn split_hunks(diff: &[u8]) -> (&[u8], Vec<&[u8]>) {
    let mut starts = Vec::new();
    let mut offset = 0;
    for line in diff.split_inclusive(|byte| *byte == b'\n') {
        if line.starts_with(b"@@ ") {
            starts.push(offset);
        }
        offset += line.len();
    }
    let header_end = starts.first().copied().unwrap_or(diff.len());
    let hunks = starts
        .iter()
        .enumerate()
        .map(|(position, start)| {
            let end = starts.get(position + 1).copied().unwrap_or(diff.len());
            &diff[*start..end]
        })
        .collect();
    (&diff[..header_end], hunks)
}
