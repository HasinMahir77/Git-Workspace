mod commands;
mod repositories;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(repositories::Repositories::default())
        .manage(commands::AccountActions::default())
        .invoke_handler(tauri::generate_handler![
            commands::open_repository,
            commands::clone_repository,
            commands::get_status,
            commands::get_sync_state,
            commands::get_branches,
            commands::get_diff,
            commands::get_history,
            commands::get_commit_diff,
            commands::compare_branches,
            commands::get_branch_groups,
            commands::get_recovery,
            commands::get_stashes,
            commands::run_operation,
            commands::cancel_operation,
            commands::tool_versions,
            commands::open_terminal,
            commands::github_accounts,
            commands::sign_in_to_github,
            commands::cancel_github_sign_in,
            commands::switch_github_account,
            commands::setup_github_https,
            commands::open_github_device_verification,
        ])
        .run(tauri::generate_context!())
        .expect("could not start Git Workspace");
}
