use std::fs;

use crate::Repository;

const IGNORE_FILE: &str = ".gitignore";

impl Repository {
    /// Appends one rule to the repository's root `.gitignore`.
    pub fn add_to_gitignore(&self, pattern: &str) -> Result<(), String> {
        let pattern = pattern.trim();
        if pattern.is_empty() || pattern.contains(['\n', '\r']) {
            return Err("Enter a single ignore pattern.".into());
        }
        let path = self.root().join(IGNORE_FILE);
        let mut content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
            Err(error) => return Err(format!("Could not read .gitignore: {error}")),
        };
        if content.lines().any(|line| line == pattern) {
            return Ok(());
        }
        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
        content.push_str(pattern);
        content.push('\n');
        fs::write(&path, content).map_err(|error| format!("Could not write .gitignore: {error}"))
    }
}
