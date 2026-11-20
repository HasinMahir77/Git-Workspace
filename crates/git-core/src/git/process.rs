use super::constants::{ANSI_SEQUENCE, CANCEL_MESSAGE, CREDENTIAL, LINE_LIMIT, OUTPUT_LIMIT};
use crate::{Cancellation, Execution};
use std::{
    ffi::OsStr,
    io::{self, Read},
    os::unix::process::CommandExt,
    path::Path,
    process::{Child, Command, ExitStatus, Stdio},
    thread,
    time::{Duration, Instant},
};

fn command(directory: &Path) -> Command {
    let mut command = Command::new("git");
    command
        .current_dir(directory)
        .args(["--no-pager", "-c", "color.ui=false"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C.UTF-8");
    for name in [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_PREFIX",
        "GIT_IMPLICIT_WORK_TREE",
        "GIT_QUARANTINE_PATH",
        "GIT_TRACE",
        "GIT_TRACE_PACKET",
        "GIT_TRACE_CURL",
        "GIT_CURL_VERBOSE",
        "GIT_TRACE2",
        "GIT_TRACE2_EVENT",
        "GIT_TRACE2_PERF",
    ] {
        command.env_remove(name);
    }
    command
}

fn capture(stream: impl Read) -> io::Result<Vec<u8>> {
    let mut stream = stream;
    let mut bytes = Vec::new();
    (&mut stream)
        .take(OUTPUT_LIMIT as u64 + 1)
        .read_to_end(&mut bytes)?;
    io::copy(&mut stream, &mut io::sink())?;
    Ok(bytes)
}

pub(crate) fn git(
    directory: &Path,
    args: impl IntoIterator<Item = impl AsRef<OsStr>>,
) -> Result<Vec<u8>, String> {
    collect(directory, args, false)
}

/// Runs Git with `input` written to its stdin, for commands such as `git apply -`.
pub(crate) fn git_with_input(
    directory: &Path,
    args: impl IntoIterator<Item = impl AsRef<OsStr>>,
    input: &[u8],
) -> Result<Vec<u8>, String> {
    use io::Write;
    let mut child = command(directory)
        .args(args)
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start Git: {error}"))?;
    let mut stdin = child.stdin.take().expect("Git stdin is piped");
    let stderr = child.stderr.take().expect("Git stderr is piped");
    let stderr = thread::spawn(move || capture(stderr));
    let stdout = child.stdout.take().expect("Git stdout is piped");
    let stdout = thread::spawn(move || capture(stdout));
    // A Git that exits early closes the pipe; its error is read below.
    let _ = stdin.write_all(input);
    drop(stdin);
    let status = child.wait().map_err(|error| error.to_string())?;
    let stderr = stderr
        .join()
        .map_err(|_| "Could not read Git errors")?
        .map_err(|error| error.to_string())?;
    let stdout = stdout
        .join()
        .map_err(|_| "Could not read Git output")?
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok(stdout)
    } else {
        Err(sanitize_output(&text(&stderr)))
    }
}

pub(crate) fn git_allow_one(
    directory: &Path,
    args: impl IntoIterator<Item = impl AsRef<OsStr>>,
) -> Result<Vec<u8>, String> {
    collect(directory, args, true)
}

fn collect(
    directory: &Path,
    args: impl IntoIterator<Item = impl AsRef<OsStr>>,
    can_exit_one: bool,
) -> Result<Vec<u8>, String> {
    let mut child = command(directory)
        .args(args)
        .spawn()
        .map_err(|error| format!("Could not start Git: {error}"))?;
    let stderr = child.stderr.take().expect("Git stderr is piped");
    let stderr = thread::spawn(move || capture(stderr));
    let stdout = capture(child.stdout.take().expect("Git stdout is piped"));
    let status = child.wait().map_err(|error| error.to_string())?;
    let stderr = stderr
        .join()
        .map_err(|_| "Could not read Git errors")?
        .map_err(|error| error.to_string())?;
    if !(status.success() || can_exit_one && status.code() == Some(1)) {
        let output = if stderr.len() <= LINE_LIMIT {
            sanitize_output(&text(&stderr))
        } else {
            "Git reported a long error. Repeat the operation in Terminal to inspect it.".into()
        };
        return Err(if output.trim().is_empty() {
            format!("Git exited with {status}")
        } else {
            output
        });
    }
    let stdout = stdout.map_err(|error| error.to_string())?;
    if stdout.len() > OUTPUT_LIMIT {
        return Err("Git output exceeded 8 MiB. Try narrowing the selection.".into());
    }
    Ok(stdout)
}

pub(crate) fn stream_git(
    directory: &Path,
    args: &[&str],
    execution: &Execution<'_>,
) -> Result<(), String> {
    let mut child_command = command(directory);
    child_command.args(args);
    stream_command(child_command, "Git", execution)
}

/// Runs a Git command that could open an editor with `true` as the editor, so
/// it accepts Git's prepared message. Hooks stay enabled.
pub(crate) fn stream_git_without_editor(
    directory: &Path,
    args: &[&str],
    execution: &Execution<'_>,
) -> Result<(), String> {
    let mut child_command = command(directory);
    child_command.args(args).env("GIT_EDITOR", "true");
    stream_command(child_command, "Git", execution)
}

pub(crate) fn stream_command(
    mut command: Command,
    program: &str,
    execution: &Execution<'_>,
) -> Result<(), String> {
    if execution
        .cancellation
        .is_some_and(Cancellation::is_cancelled)
    {
        return Err(CANCEL_MESSAGE.into());
    }
    let mut child = command
        .process_group(0)
        .spawn()
        .map_err(|error| format!("Could not start {program}: {error}"))?;
    let stdout = child.stdout.take().expect("Git stdout is piped");
    let stderr = child.stderr.take().expect("Git stderr is piped");
    let (status, stdout, stderr) = thread::scope(|scope| {
        let out = scope.spawn(|| stream(stdout, execution.emit));
        let err = scope.spawn(|| stream(stderr, execution.emit));
        (
            wait(&mut child, execution.cancellation),
            out.join(),
            err.join(),
        )
    });
    let (status, is_cancelled) = status.map_err(|error| error.to_string())?;
    stdout
        .map_err(|_| "Could not read Git output")?
        .map_err(|error| error.to_string())?;
    stderr
        .map_err(|_| "Could not read Git errors")?
        .map_err(|error| error.to_string())?;
    if is_cancelled {
        Err(CANCEL_MESSAGE.into())
    } else if status.success() {
        Ok(())
    } else {
        Err(format!("{program} exited with {status}."))
    }
}

fn wait(child: &mut Child, cancellation: Option<&Cancellation>) -> io::Result<(ExitStatus, bool)> {
    let Some(cancellation) = cancellation else {
        return child.wait().map(|status| (status, false));
    };
    let mut cancelled_at = None;
    loop {
        if let Some(status) = child.try_wait()? {
            return Ok((status, cancelled_at.is_some()));
        }
        match cancelled_at {
            None if cancellation.is_cancelled() => {
                signal_group(child, libc::SIGTERM);
                cancelled_at = Some(Instant::now());
            }
            Some(when) if when.elapsed() >= Duration::from_millis(500) => {
                signal_group(child, libc::SIGKILL);
                return child.wait().map(|status| (status, true));
            }
            _ => {}
        }
        thread::sleep(Duration::from_millis(25));
    }
}

fn signal_group(child: &Child, signal: libc::c_int) {
    // The spawned Git process owns a new group with its PID as the group ID.
    unsafe { libc::kill(-(child.id() as libc::pid_t), signal) };
}

fn stream(mut input: impl Read, emit: &dyn Fn(String)) -> io::Result<()> {
    let mut chunk = [0; LINE_LIMIT];
    let mut line = Vec::new();
    let mut is_oversized = false;
    loop {
        let count = input.read(&mut chunk)?;
        if count == 0 {
            if !line.is_empty() || is_oversized {
                emit_line(&line, is_oversized, emit);
            }
            return Ok(());
        }
        for byte in &chunk[..count] {
            match byte {
                b'\r' | b'\n' if !line.is_empty() || is_oversized => {
                    emit_line(&line, is_oversized, emit);
                    line.clear();
                    is_oversized = false;
                }
                b'\r' | b'\n' => {}
                _ if line.len() < LINE_LIMIT => line.push(*byte),
                _ => is_oversized = true,
            }
        }
    }
}

fn emit_line(bytes: &[u8], is_oversized: bool, emit: &dyn Fn(String)) {
    if is_oversized {
        emit("[Long output line omitted]\n".into());
    } else {
        emit(format!("{}\n", sanitize_output(&text(bytes))));
    }
}

fn sanitize_output(line: &str) -> String {
    let plain = ANSI_SEQUENCE.replace_all(line, "");
    CREDENTIAL
        .replace_all(&plain, "${1}[redacted]")
        .into_owned()
}

pub(crate) fn text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}
