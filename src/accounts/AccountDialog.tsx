import { Check, ExternalLink, LogIn, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { Modal } from "../components/Modal";
import { messageOf } from "../git/workspace.helpers";
import type { AccountDialogProps } from "./account-dialog.types";
import { github } from "./client";

export function AccountDialog({ accountState, loadError, refresh, close }: AccountDialogProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingSetup, setIsConfirmingSetup] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cancelled = useRef(false);
  const isBusy = isSigningIn || isSaving;
  const hasEnvironmentToken = Boolean(accountState?.hasEnvironmentToken);
  const hasActiveAccount = accountState?.accounts.some((account) => account.isActive && account.isAuthenticated);

  async function signIn() {
    cancelled.current = false;
    setIsSigningIn(true);
    setError("");
    setNotice("");
    try {
      await github.signIn(setCode);
      await refresh();
    } catch (reason) {
      if (!cancelled.current) {
        setError(`Could not finish sign-in. ${messageOf(reason)}`);
      }
    } finally {
      setCode("");
      setIsSigningIn(false);
      setIsCancelling(false);
    }
  }

  async function cancelSignIn() {
    if (isCancelling) return;
    cancelled.current = true;
    setIsCancelling(true);
    try {
      await github.cancel();
    } catch (reason) {
      cancelled.current = false;
      setError(messageOf(reason));
      setIsCancelling(false);
    }
  }

  async function update(action: () => Promise<void>, success?: string) {
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
      if (success) setNotice(success);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsSaving(false);
      setIsConfirmingSetup(false);
    }
  }

  return (
    <Modal title="GitHub accounts" close={() => {
      if (isSigningIn) void cancelSignIn();
      else if (!isSaving) close();
    }}>
      <div className="dialog-form">
        {(error || loadError) && <p className="dialog-error" role="alert">{error || loadError}</p>}
        {notice && <p role="status">{notice}</p>}
        {!accountState && !loadError && <p className="muted">Checking GitHub CLI…</p>}
        {accountState?.accounts.length === 0 && <p className="muted">Sign in to GitHub to add an account.</p>}
        {Boolean(accountState?.accounts.length) && (
          <ul className="account-list" aria-label="Saved GitHub accounts">
            {accountState?.accounts.map((account) => (
              <li className="account-row row" key={account.login}>
                <span className="account-avatar"><UserRound size={16} aria-hidden="true" /></span>
                <span className="account-details truncate">
                  <strong className="truncate" title={account.login}>{account.login}</strong>
                  <small>{account.isAuthenticated ? "github.com" : "Sign-in needs attention"}</small>
                </span>
                <span className="spacer" />
                {account.isActive ? <span className="active-badge row"><Check size={13} aria-hidden="true" /> Active</span> : (
                  <button className="button" aria-label={`Switch to ${account.login}`} disabled={isBusy || hasEnvironmentToken}
                    onClick={() => void update(() => github.switchAccount(account.login))}>Switch</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {hasEnvironmentToken && <p className="muted">A GitHub token from your environment is active. Remove it and restart Git Workspace to switch saved accounts.</p>}
        {isSigningIn ? (
          <div className="device-card">
            <strong>Verify in your browser</strong>
            <p className="muted">{code ? "Copy this one-time code, then open GitHub to authorize GitHub CLI." : "Waiting for a one-time code from GitHub…"}</p>
            {code && (
              <div className="row">
                <input className="field device-code" aria-label="One-time device code" value={code} readOnly onFocus={(event) => event.currentTarget.select()} />
                <button className="button primary" onClick={() => void github.verifyInBrowser().catch((reason) => setError(messageOf(reason)))}>
                  Open GitHub <ExternalLink size={14} />
                </button>
              </div>
            )}
            <button className="button" disabled={isCancelling} onClick={() => void cancelSignIn()}>{isCancelling ? "Cancelling…" : "Cancel sign-in"}</button>
          </div>
        ) : (
          <>
            <div className="row account-actions">
              {loadError ? <button className="button" onClick={() => void refresh()}>Refresh accounts</button> : (
                <button className="button primary" disabled={isBusy || !accountState || hasEnvironmentToken} onClick={() => void signIn()}>
                  <LogIn size={16} /> {accountState?.accounts.length ? "Add account" : "Sign in with GitHub"}
                </button>
              )}
              {hasActiveAccount && !isConfirmingSetup && !hasEnvironmentToken && (
                <button className="button" disabled={isBusy} onClick={() => setIsConfirmingSetup(true)}>Set up Git HTTPS</button>
              )}
            </div>
            {isConfirmingSetup && (
              <div className="device-card">
                <p>Use GitHub CLI as the HTTPS credential helper for github.com across your Git tools?</p>
                <div className="row">
                  <button className="button" disabled={isBusy} onClick={() => setIsConfirmingSetup(false)}>Cancel</button>
                  <button className="button primary" disabled={isBusy} onClick={() => void update(github.setupGitHttps, "GitHub CLI is configured for Git HTTPS.")}>Use GitHub CLI</button>
                </div>
              </div>
            )}
            <small>GitHub CLI account selection is shared with your terminal. Git HTTPS follows it when using the GitHub CLI credential helper. SSH keys and commit authors are configured separately.</small>
          </>
        )}
      </div>
    </Modal>
  );
}
