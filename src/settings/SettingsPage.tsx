import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { AccountSettings } from "../accounts/AccountSettings";
import { SidebarDivider, SidebarToggle } from "../components/SidebarControls";
import { SETTINGS } from "../components/sidebar.constants";
import { useSidebar } from "../components/useSidebar";
import { EnvironmentSettings } from "./EnvironmentSettings";
import { SETTINGS_SECTIONS, THEME_OPTIONS } from "./settings.constants";
import type { SettingsProps } from "./settings.types";

export function SettingsPage({
  section, selectSection, close, theme, changeTheme, repositoryId, accountState,
  accountError, refreshAccounts, isWorkspaceBusy,
}: SettingsProps) {
  const title = useRef<HTMLHeadingElement>(null);
  const sidebar = useSidebar(SETTINGS);
  useEffect(() => { title.current?.focus(); }, []);

  return (
    <main className="settings-page" aria-label="Settings">
      <header className="settings-bar row">
        <button className="button subtle" onClick={close}><ArrowLeft size={16} aria-hidden="true" /> Back to workspace</button>
        <SidebarToggle sidebar={sidebar} />
        <h1 ref={title} tabIndex={-1}>Settings</h1>
      </header>
      <div className="settings-body" style={sidebar.layout}>
        <nav className={`settings-nav${sidebar.isCollapsed ? " is-collapsed" : ""}`} id={sidebar.panelId} aria-label="Settings sections">
          {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => (
            <button type="button" className="button subtle" key={id} aria-current={section === id ? "page" : undefined} aria-label={label} title={label}
              onClick={() => selectSection(id)}><Icon size={17} aria-hidden="true" /><span className="settings-nav-label">{label}</span></button>
          ))}
        </nav>
        <SidebarDivider sidebar={sidebar} />
        <div className="settings-main">
          {section === "appearance" && (
            <section className="settings-stack" aria-labelledby="settings-appearance">
              <h2 id="settings-appearance">Appearance</h2>
              <fieldset className="theme-options">
                <legend>Theme</legend>
                <div className="theme-grid">
                  {THEME_OPTIONS.map(({ value, label }) => (
                    <label className="theme-card" key={value}>
                      <input type="radio" name="theme" value={value} checked={theme === value}
                        onChange={() => changeTheme(value)} />
                      <span className="theme-preview" data-preview={value} aria-hidden="true"><i /><i /><i /></span>
                      <span className="row"><strong>{label}</strong>{theme === value && <Check size={15} aria-hidden="true" />}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          )}
          <section className="settings-stack" aria-labelledby="settings-accounts" hidden={section !== "accounts"}>
            <h2 id="settings-accounts">GitHub accounts</h2>
            <AccountSettings accountState={accountState} loadError={accountError} refresh={refreshAccounts}
              isWorkspaceBusy={isWorkspaceBusy} />
          </section>
          {section === "environment" && (
            <section className="settings-stack" aria-labelledby="settings-environment">
              <h2 id="settings-environment">Git environment</h2>
              <EnvironmentSettings repositoryId={repositoryId} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
