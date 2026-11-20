use crate::{
    Repository,
    git::{git, git_allow_one, text},
};

const GITHUB_HOST: &str = "github.com";

impl Repository {
    /// The github.com page for this checkout's remote, or for one commit on it.
    /// Remotes on other hosts have no page here.
    pub fn github_url(&self, commit: Option<&str>) -> Result<Option<String>, String> {
        let remote = self.remote_for_links()?;
        let Ok(url) = git(self.root(), ["remote", "get-url", &remote]) else {
            return Ok(None);
        };
        let Some(slug) = github_slug(text(&url).trim()) else {
            return Ok(None);
        };
        let base = format!("https://{GITHUB_HOST}/{slug}");
        Ok(Some(match commit {
            Some(id) if id.bytes().all(|byte| byte.is_ascii_hexdigit()) && !id.is_empty() => {
                format!("{base}/commit/{id}")
            }
            Some(_) => return Err("Invalid commit ID".into()),
            None => base,
        }))
    }

    fn remote_for_links(&self) -> Result<String, String> {
        let branch = self.status()?.branch;
        if let Some(branch) = branch {
            let configured = git_allow_one(
                self.root(),
                ["config", "--get", &format!("branch.{branch}.remote")],
            )?;
            let configured = text(&configured).trim().to_owned();
            if !configured.is_empty() && configured != "." {
                return Ok(configured);
            }
        }
        Ok("origin".into())
    }
}

fn github_slug(url: &str) -> Option<String> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .or_else(|| url.strip_prefix("ssh://"))
        .map(|rest| rest.split_once('@').map_or(rest, |(_, host)| host))
        .map(|rest| rest.split_once('/'))
        .or_else(|| url.strip_prefix("git@").map(|rest| rest.split_once(':')))??;
    let (host, path) = rest;
    let host = host.split(':').next().unwrap_or(host);
    if !host.eq_ignore_ascii_case(GITHUB_HOST) {
        return None;
    }
    let path = path.trim_matches('/').trim_end_matches(".git");
    let mut parts = path.split('/');
    let (owner, name) = (parts.next()?, parts.next()?);
    (parts.next().is_none() && !owner.is_empty() && !name.is_empty())
        .then(|| format!("{owner}/{name}"))
}
