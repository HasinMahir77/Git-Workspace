export type PullRequestButtonProps = {
  repo: string;
  branch: string | null;
  hasUpstream: boolean;
  hasGitHubRemote: boolean;
  onError: (message: string) => void;
};
