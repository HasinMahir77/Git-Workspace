import { UserRound } from "lucide-react";
import { useState } from "react";

export function AccountAvatar({ login }: { login?: string }) {
  const [failedSource, setFailedSource] = useState("");
  const source = login ? `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=64` : "";

  return (
    <span className="account-avatar" aria-hidden="true">
      <UserRound size={16} />
      {source && source !== failedSource && (
        <img alt="" src={source} referrerPolicy="no-referrer" onError={() => setFailedSource(source)} />
      )}
    </span>
  );
}
