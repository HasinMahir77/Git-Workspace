use crate::{
    BlameLine, ConflictSides, Repository,
    git::{git, text},
    repository::decode_path,
};

const NOT_TEXT: &str = "This file is not text, so it cannot be resolved here. Use Open in Terminal.";

impl Repository {
    /// Who last changed each line of a tracked file at HEAD.
    pub fn blame(&self, path: &str) -> Result<Vec<BlameLine>, String> {
        if path.starts_with('-') || path.contains('\0') {
            return Err("Choose a tracked file.".into());
        }
        let output = text(&git(
            self.root(),
            ["--literal-pathspecs", "blame", "--line-porcelain", "HEAD", "--", path],
        )?);
        let mut lines = Vec::new();
        let mut current: Option<BlameLine> = None;
        for row in output.split('\n') {
            if let Some(text) = row.strip_prefix('\t') {
                if let Some(mut line) = current.take() {
                    line.text = text.to_owned();
                    lines.push(line);
                }
            } else if let Some(line) = current.as_mut() {
                if let Some(author) = row.strip_prefix("author ") {
                    line.author = author.to_owned();
                } else if let Some(time) = row.strip_prefix("author-time ") {
                    line.authored_at = time.parse().unwrap_or(0);
                } else if let Some(summary) = row.strip_prefix("summary ") {
                    line.summary = summary.to_owned();
                }
            } else {
                let mut fields = row.split(' ');
                let (Some(commit), Some(_), Some(number)) =
                    (fields.next(), fields.next(), fields.next())
                else {
                    continue;
                };
                current = Some(BlameLine {
                    line: number.parse().unwrap_or(0),
                    commit: commit.to_owned(),
                    author: String::new(),
                    authored_at: 0,
                    summary: String::new(),
                    text: String::new(),
                });
            }
        }
        Ok(lines)
    }

    /// The common ancestor, our side, their side, and the working copy of a conflicted file.
    pub fn conflict_sides(&self, id: &str) -> Result<ConflictSides, String> {
        let (_, file) = self.changed_file(id)?;
        if !file.has_conflict {
            return Err("This file has no conflict.".into());
        }
        let path = decode_path(id)?;
        let working = std::fs::read(self.root().join(&path)).unwrap_or_default();
        if working.contains(&0) {
            return Err(NOT_TEXT.into());
        }
        let stage = |number: u8| -> Option<String> {
            let mut reference = std::ffi::OsString::from(format!(":{number}:"));
            reference.push(&path);
            let bytes = git(self.root(), [std::ffi::OsString::from("show"), reference]).ok()?;
            (!bytes.contains(&0)).then(|| text(&bytes))
        };
        Ok(ConflictSides {
            base: stage(1),
            ours: stage(2),
            theirs: stage(3),
            working: text(&working),
        })
    }

    /// Writes the chosen result into a conflicted file and marks it resolved.
    pub fn resolve_conflict(&self, id: &str, content: &str) -> Result<(), String> {
        let (_, file) = self.changed_file(id)?;
        if !file.has_conflict {
            return Err("This file has no conflict.".into());
        }
        let path = decode_path(id)?;
        std::fs::write(self.root().join(&path), content)
            .map_err(|error| format!("Could not save the resolved file: {error}"))?;
        git(
            self.root(),
            [
                std::ffi::OsString::from("--literal-pathspecs"),
                "add".into(),
                "--".into(),
                path,
            ],
        )
        .map(drop)
    }
}
