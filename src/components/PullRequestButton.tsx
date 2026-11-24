import { GitPullRequestClosedIcon, GitPullRequestDraftIcon, GitPullRequestIcon, GitMergeIcon } from "@primer/octicons-react";
import { git } from "../git/client";
import { canCreatePullRequest, pullRequestDescription } from "../git/pull-request.helpers";
import { usePullRequest } from "../git/usePullRequest";
import { messageOf } from "../git/workspace.helpers";
import type { PullRequestButtonProps } from "./pull-request-button.types";
import { ToolbarButton } from "./ToolbarButton";

export function PullRequestButton({ repo, branch, hasUpstream, hasGitHubRemote, onError }: PullRequestButtonProps) {
  const pullRequest = usePullRequest(repo, branch, hasGitHubRemote);
  const open = (url?: string) => void git.openPullRequest(repo, url).catch((reason: unknown) => onError(messageOf(reason)));
  if (pullRequest) {
    const Icon = pullRequest.isDraft ? GitPullRequestDraftIcon : pullRequest.state === "MERGED" ? GitMergeIcon : pullRequest.state === "CLOSED" ? GitPullRequestClosedIcon : GitPullRequestIcon;
    return (
      <div className="toolbar-sync pull-request-control">
        <ToolbarButton className={`sync-control pull-request-${pullRequest.checks}`} icon={<Icon />} text={`#${pullRequest.number} ${pullRequest.title}`}
          description={pullRequestDescription(pullRequest)} title={`Open #${pullRequest.number} on GitHub`} onClick={() => open(pullRequest.url)} />
      </div>
    );
  }
  if (!hasGitHubRemote || !canCreatePullRequest(branch, hasUpstream)) return null;
  return (
    <div className="toolbar-sync pull-request-control">
      <ToolbarButton className="sync-control" icon={<GitPullRequestIcon />} text="Create pull request" description="Opens GitHub"
        onClick={() => open()} />
    </div>
  );
}
