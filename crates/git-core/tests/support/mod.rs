use std::{path::Path, process::Command};
use tempfile::TempDir;

pub struct Checkout {
    pub directory: TempDir,
}

impl Checkout {
    pub fn new() -> Self {
        let checkout = Self {
            directory: tempfile::tempdir().unwrap(),
        };
        checkout.git(&["init", "--initial-branch=main"]);
        checkout.git(&["config", "user.name", "Fixture"]);
        checkout.git(&["config", "user.email", "fixture@example.test"]);
        checkout.git(&["config", "commit.gpgsign", "false"]);
        checkout
    }

    pub fn path(&self) -> &Path {
        self.directory.path()
    }

    pub fn git(&self, arguments: &[&str]) -> String {
        git(self.path(), arguments)
    }

    pub fn write(&self, path: &str, content: &str) {
        std::fs::write(self.path().join(path), content).unwrap();
    }
}

pub fn git(path: &Path, arguments: &[&str]) -> String {
    let output = Command::new("git")
        .current_dir(path)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .args(arguments)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}

pub fn install_hook(checkout: &Checkout, name: &str, body: &str) {
    use std::os::unix::fs::PermissionsExt;
    let directory = checkout.path().join(".fixture-hooks");
    std::fs::create_dir_all(&directory).unwrap();
    checkout.git(&["config", "core.hooksPath", directory.to_str().unwrap()]);
    let hook = directory.join(name);
    std::fs::write(&hook, format!("#!/bin/sh\n{body}\n")).unwrap();
    std::fs::set_permissions(hook, std::fs::Permissions::from_mode(0o755)).unwrap();
}
