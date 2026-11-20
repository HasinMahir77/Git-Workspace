use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

use git_gui_core::{Cancellation, Repository, RepositoryInfo};

#[derive(Default)]
pub struct Repositories(Mutex<Vec<RegisteredRepository>>);

#[derive(Clone)]
pub struct RegisteredRepository {
    pub repository: Repository,
    active_operation: Arc<Mutex<Option<Cancellation>>>,
    info: RepositoryInfo,
}

pub struct ActiveOperation {
    slot: Arc<Mutex<Option<Cancellation>>>,
    pub cancellation: Cancellation,
}

impl RegisteredRepository {
    pub fn start_operation(&self) -> Result<ActiveOperation, String> {
        let slot = self.active_operation.clone();
        let cancellation = Cancellation::default();
        let mut active = slot.lock().map_err(|_| "Git operations are unavailable.")?;
        if active.is_some() {
            return Err("This repository already has a Git operation running.".into());
        }
        *active = Some(cancellation.clone());
        drop(active);
        Ok(ActiveOperation { slot, cancellation })
    }

    pub fn cancel_operation(&self) -> Result<(), String> {
        let active = self
            .active_operation
            .lock()
            .map_err(|_| "Git operations are unavailable.")?;
        if let Some(cancellation) = active.as_ref() {
            cancellation.cancel();
        }
        Ok(())
    }
}

impl Drop for ActiveOperation {
    fn drop(&mut self) {
        if let Ok(mut active) = self.slot.lock() {
            *active = None;
        }
    }
}

impl Repositories {
    pub fn register(&self, repository: Repository) -> Result<RepositoryInfo, String> {
        let mut entries = self
            .0
            .lock()
            .map_err(|_| "Repository list is unavailable.")?;
        if let Some(entry) = entries
            .iter()
            .find(|entry| entry.repository.root() == repository.root())
        {
            return Ok(entry.info.clone());
        }
        let active_operation = entries
            .iter()
            .find(|entry| entry.repository.common_directory() == repository.common_directory())
            .map(|entry| entry.active_operation.clone())
            .unwrap_or_default();
        let root = repository.root();
        let info = RepositoryInfo {
            id: entries.len().to_string(),
            name: root
                .file_name()
                .unwrap_or(root.as_os_str())
                .to_string_lossy()
                .into_owned(),
            path: root.to_string_lossy().into_owned(),
        };
        entries.push(RegisteredRepository {
            repository,
            active_operation,
            info: info.clone(),
        });
        Ok(info)
    }

    pub fn get(&self, id: &str) -> Result<RegisteredRepository, String> {
        let entries = self
            .0
            .lock()
            .map_err(|_| "Repository list is unavailable.")?;
        let index = id.parse::<usize>().map_err(|_| "Invalid repository ID.")?;
        entries
            .get(index)
            .cloned()
            .ok_or_else(|| "Open a repository first.".into())
    }

    pub fn directory(&self, id: Option<&str>) -> Result<Option<PathBuf>, String> {
        id.map(|id| self.get(id).map(|entry| entry.repository.root().to_owned()))
            .transpose()
    }
}
