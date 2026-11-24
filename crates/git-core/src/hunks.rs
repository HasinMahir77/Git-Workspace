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

    /// Stages the chosen changed lines of one hunk. `lines` are positions below the hunk header.
    pub fn stage_lines(
        &self,
        id: &str,
        index: usize,
        header: &str,
        lines: &[u32],
    ) -> Result<(), String> {
        self.apply_lines(id, index, header, false, Some(lines))
    }

    /// Removes the chosen changed lines of one hunk from the index.
    pub fn unstage_lines(
        &self,
        id: &str,
        index: usize,
        header: &str,
        lines: &[u32],
    ) -> Result<(), String> {
        self.apply_lines(id, index, header, true, Some(lines))
    }

    fn apply_hunk(
        &self,
        id: &str,
        index: usize,
        header: &str,
        is_staged: bool,
    ) -> Result<(), String> {
        self.apply_lines(id, index, header, is_staged, None)
    }

    fn apply_lines(
        &self,
        id: &str,
        index: usize,
        header: &str,
        is_staged: bool,
        lines: Option<&[u32]>,
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
        let hunk = match lines {
            Some(lines) => select_lines(hunk, lines, is_staged).ok_or(HUNK_CHANGED)?,
            None => hunk.to_vec(),
        };
        let patch = [file_header, &hunk].concat();
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

/// Rewrites a hunk so applying it changes only the selected lines and leaves the rest of the index as it is.
fn select_lines(hunk: &[u8], selected: &[u32], is_staged: bool) -> Option<Vec<u8>> {
    let mut lines = hunk.split_inclusive(|byte| *byte == b'\n');
    let header = parse_header(lines.next()?)?;
    let (kept_as_context, dropped) = if is_staged {
        (b'+', b'-')
    } else {
        (b'-', b'+')
    };
    let mut body = Vec::new();
    let (mut old_count, mut new_count, mut context_count) = (0, 0, 0);
    let mut was_dropped = false;
    for (position, line) in lines.enumerate() {
        let is_selected = selected.contains(&(position as u32));
        let is_newline_marker = line.first() == Some(&b'\\');
        if is_newline_marker && was_dropped {
            continue;
        }
        was_dropped = !is_newline_marker && !is_selected && line.first() == Some(&dropped);
        match line.first() {
            Some(b'+') | Some(b'-') if is_selected => {
                if line[0] == b'+' {
                    new_count += 1
                } else {
                    old_count += 1
                }
                body.extend_from_slice(line);
            }
            Some(&prefix) if prefix == dropped => {}
            Some(&prefix) if prefix == kept_as_context => {
                old_count += 1;
                new_count += 1;
                context_count += 1;
                body.push(b' ');
                body.extend_from_slice(&line[1..]);
            }
            Some(b' ') => {
                old_count += 1;
                new_count += 1;
                context_count += 1;
                body.extend_from_slice(line);
            }
            _ => body.extend_from_slice(line),
        }
    }
    if old_count == context_count && new_count == context_count {
        return None;
    }
    let mut rewritten = format!(
        "@@ -{},{} +{},{} @@{}",
        header.old_start, old_count, header.new_start, new_count, header.context
    )
    .into_bytes();
    rewritten.extend(body);
    Some(rewritten)
}

struct HunkHeader {
    old_start: u32,
    new_start: u32,
    context: String,
}

fn parse_header(line: &[u8]) -> Option<HunkHeader> {
    let text = std::str::from_utf8(line).ok()?.strip_prefix("@@ -")?;
    let (ranges, context) = text.split_once(" @@")?;
    let (old, new) = ranges.split_once(" +")?;
    let start = |range: &str| range.split(',').next()?.parse().ok();
    Some(HunkHeader {
        old_start: start(old)?,
        new_start: start(new)?,
        context: context.to_string(),
    })
}
