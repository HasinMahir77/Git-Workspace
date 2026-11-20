use crate::{
    Execution, PushTarget, Repository, SyncState,
    git::{git, git_allow_one, stream_git, text},
};

const UNSUPPORTED_PUSH: &str =
    "Git has no supported single-branch push target. Use Open in Terminal.";

impl Repository {
    pub fn sync_state(&self) -> Result<SyncState, String> {
        let remotes = self.remotes()?;
        let status = self.status()?;
        let mut state = SyncState {
            fetch_remote: remotes
                .iter()
                .find(|remote| *remote == "origin")
                .or(remotes.first())
                .cloned(),
            remotes,
            has_configured_upstream: false,
            push_target: None,
            push_ahead: None,
        };
        if let Some(branch) = status.branch.as_deref() {
            if let Some(remote) = self.config_value(&format!("branch.{branch}.remote"))?
                && state.remotes.contains(&remote)
            {
                state.fetch_remote = Some(remote);
            }
            state.has_configured_upstream =
                !self.config(&format!("branch.{branch}.merge"))?.is_empty();
            if !status.is_unborn
                && let Ok(target) = self.push_target(branch)
            {
                state.push_ahead = self.ahead_of(&target).ok().flatten();
                state.push_target = Some(target);
            }
        }
        Ok(state)
    }

    fn ahead_of(&self, target: &PushTarget) -> Result<Option<u32>, String> {
        let suffix = target
            .reference
            .strip_prefix("refs/heads/")
            .ok_or(UNSUPPORTED_PUSH)?;
        let tracking = format!("refs/remotes/{}/{suffix}", target.remote);
        let standard_mapping = format!("refs/heads/*:refs/remotes/{}/*", target.remote);
        let exact_mapping = format!("{}:{tracking}", target.reference);
        let mappings = self.config(&format!("remote.{}.fetch", target.remote))?;
        if !mappings.iter().any(|mapping| {
            let mapping = mapping.trim_start_matches('+');
            mapping == standard_mapping || mapping == exact_mapping
        }) {
            return Ok(None);
        }
        let range = format!("{tracking}..HEAD");
        let output = git(self.root(), ["rev-list", "--count", &range, "--"])?;
        Ok(text(&output).trim().parse().ok())
    }

    pub fn remotes(&self) -> Result<Vec<String>, String> {
        self.lines(&["remote"])
    }

    pub fn push_target(&self, branch: &str) -> Result<PushTarget, String> {
        let source = format!("refs/heads/{branch}");
        let pull_remote = self.config_value(&format!("branch.{branch}.remote"))?;
        let push_remote = self.config_value(&format!("branch.{branch}.pushRemote"))?;
        let default_remote = self.config_value("remote.pushDefault")?;
        let names = self.remotes()?;
        let remote = push_remote
            .or(default_remote)
            .or_else(|| pull_remote.clone())
            .unwrap_or_else(|| {
                if names.len() == 1 {
                    names[0].clone()
                } else {
                    "origin".into()
                }
            });
        let mappings = self.config(&format!("remote.{remote}.push"))?;
        let reference = if let [mapping] = mappings.as_slice() {
            let (from, to) = mapping.split_once(':').ok_or(UNSUPPORTED_PUSH)?;
            if from != source {
                return Err(UNSUPPORTED_PUSH.into());
            }
            to.to_owned()
        } else {
            let mode = self
                .config_value("push.default")?
                .unwrap_or_else(|| "simple".into());
            let upstreams = self.config(&format!("branch.{branch}.merge"))?;
            let is_pull_remote = pull_remote.as_ref() == Some(&remote);
            match (mode.as_str(), upstreams.as_slice()) {
                ("current", _) => source.clone(),
                ("simple", _) if !is_pull_remote => source.clone(),
                ("simple", [upstream]) if upstream == &source => source.clone(),
                ("upstream" | "tracking", [upstream]) if is_pull_remote => upstream.clone(),
                _ => return Err(UNSUPPORTED_PUSH.into()),
            }
        };
        let target = PushTarget { remote, reference };
        self.validate_push(&source, &target)?;
        Ok(target)
    }

    pub fn push(
        &self,
        publish_remote: Option<&str>,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.run_push(publish_remote, None, execution)
    }

    pub fn push_confirmed(
        &self,
        target: &PushTarget,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        self.run_push(None, Some(target), execution)
    }

    fn run_push(
        &self,
        publish_remote: Option<&str>,
        expected: Option<&PushTarget>,
        execution: &Execution<'_>,
    ) -> Result<(), String> {
        let status = self.status()?;
        let branch = status
            .branch
            .as_deref()
            .ok_or("Switch to a branch before pushing.")?;
        if status.is_unborn {
            return Err("Create a commit before pushing this branch.".into());
        }
        let source = format!("refs/heads/{branch}");
        let target = if let Some(remote) = publish_remote {
            if !self.config(&format!("branch.{branch}.merge"))?.is_empty() {
                return Err(
                    "This branch already has an upstream. Check the remote in Terminal.".into(),
                );
            }
            let target = PushTarget {
                remote: remote.into(),
                reference: source.clone(),
            };
            self.validate_push(&source, &target)?;
            target
        } else {
            self.push_target(branch)?
        };
        if expected.is_some_and(|expected| expected != &target) {
            return Err(
                "The push destination changed. Refresh and confirm the new destination.".into(),
            );
        }
        let mapping = format!("{source}:{}", target.reference);
        let mut args = vec![
            "push",
            "--progress",
            "--porcelain",
            "--no-follow-tags",
            "--recurse-submodules=check",
        ];
        if publish_remote.is_some() {
            args.push("--set-upstream");
        }
        args.extend(["--", &target.remote, &mapping]);
        stream_git(self.root(), &args, execution)
    }

    pub fn fetch(&self, remote: &str, execution: &Execution<'_>) -> Result<(), String> {
        self.require_remote(remote)?;
        stream_git(
            self.root(),
            &["fetch", "--progress", "--", remote],
            execution,
        )
    }

    pub fn pull(&self, execution: &Execution<'_>) -> Result<(), String> {
        let status = self.status()?;
        let branch = status
            .branch
            .as_deref()
            .ok_or("Switch to a branch before pulling.")?;
        let upstreams = self.config(&format!("branch.{branch}.merge"))?;
        if upstreams.len() != 1 {
            return Err(
                "Pull needs one configured upstream. Use Open in Terminal to check this branch."
                    .into(),
            );
        }
        stream_git(
            self.root(),
            &[
                "pull",
                "--ff-only",
                "--no-rebase",
                "--no-autostash",
                "--progress",
            ],
            execution,
        )
    }

    fn validate_push(&self, source: &str, target: &PushTarget) -> Result<(), String> {
        self.require_remote(&target.remote)
            .map_err(|_| UNSUPPORTED_PUSH)?;
        if !target.reference.starts_with("refs/heads/") {
            return Err(UNSUPPORTED_PUSH.into());
        }
        git(self.root(), ["check-ref-format", &target.reference])?;
        let remote = &target.remote;
        let mirror = git_allow_one(
            self.root(),
            [
                "config",
                "--type=bool",
                "--get",
                &format!("remote.{remote}.mirror"),
            ],
        )?;
        if mirror == b"true\n" {
            return Err(UNSUPPORTED_PUSH.into());
        }
        let mappings = self.config(&format!("remote.{remote}.push"))?;
        let expected = format!("{source}:{}", target.reference);
        if !mappings.is_empty() && mappings.as_slice() != [expected] {
            return Err(UNSUPPORTED_PUSH.into());
        }
        let urls = git(
            self.root(),
            ["remote", "get-url", "--push", "--all", "--", remote],
        )?;
        if urls
            .split(|byte| *byte == b'\n')
            .filter(|line| !line.is_empty())
            .count()
            != 1
        {
            return Err(UNSUPPORTED_PUSH.into());
        }
        Ok(())
    }

    fn require_remote(&self, remote: &str) -> Result<(), String> {
        if self.remotes()?.iter().any(|name| name == remote) {
            Ok(())
        } else {
            Err("The selected remote is no longer configured.".into())
        }
    }

    pub(crate) fn config(&self, key: &str) -> Result<Vec<String>, String> {
        let output = git_allow_one(self.root(), ["config", "--null", "--get-all", key])?;
        Ok(output
            .split(|byte| *byte == 0)
            .filter(|value| !value.is_empty())
            .map(text)
            .collect())
    }

    fn config_value(&self, key: &str) -> Result<Option<String>, String> {
        Ok(self.config(key)?.pop())
    }

    pub(crate) fn lines(&self, args: &[&str]) -> Result<Vec<String>, String> {
        Ok(text(&git(self.root(), args)?)
            .lines()
            .map(str::to_owned)
            .collect())
    }
}
