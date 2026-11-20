use regex::Regex;
use std::sync::LazyLock;

pub(super) const OUTPUT_LIMIT: usize = 8 * 1024 * 1024;
pub(super) const LINE_LIMIT: usize = 4096;
pub(super) const CANCEL_MESSAGE: &str =
    "Operation cancelled. Refresh and verify its result before retrying.";

pub(super) static CREDENTIAL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(https?://)[^\s/]+@|\b(?:gh[pousr]_[a-z0-9_]{8,}|github_pat_[a-z0-9_]{8,})\b|(?:authorization:\s*(?:basic|bearer)\s+)\S+")
        .expect("credential pattern")
});

pub(super) static ANSI_SEQUENCE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\))")
        .expect("ANSI sequence pattern")
});
