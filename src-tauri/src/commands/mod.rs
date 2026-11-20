mod accounts;
pub use accounts::*;
mod environment;
mod operations;
mod workspace;

pub use environment::*;
pub use operations::*;
pub use workspace::*;

async fn blocking<T: Send + 'static>(
    action: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(action)
        .await
        .map_err(|error| format!("The Git task could not finish: {error}"))?
}
