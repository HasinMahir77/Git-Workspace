#!/bin/sh
set -eu
directory=$(dirname "$0")
current=$(cat "$directory/active" 2>/dev/null || printf work-fixture)
case "$*" in
    'auth status --hostname github.com --json hosts')
        printf '{"hosts":{"github.com":[{"login":"work-fixture","active":%s,"state":"success","tokenSource":"keyring"},{"login":"personal-fixture","active":%s,"state":"success","tokenSource":"keyring"}]}}\n' \
            "$(test "$current" = work-fixture && printf true || printf false)" \
            "$(test "$current" = personal-fixture && printf true || printf false)"
        ;;
    "auth switch --hostname github.com --user personal-fixture")
        printf personal-fixture > "$directory/active"
        ;;
    "auth login --hostname github.com --web --clipboard=false")
        printf "! First copy your one-time code: ABCD-1234\n" >&2
        printf "Other CLI output stays private\n" >&2
        sleep "${GIT_WORKSPACE_FIXTURE_WAIT:-0}"
        printf %s "${GIT_WORKSPACE_FIXTURE_LOGIN:-personal-fixture}" > "$directory/active"
        ;;
    "auth setup-git --hostname github.com")
        touch "$directory/setup-completed"
        ;;
    'pr view --json number,title,state,url,isDraft,statusCheckRollup')
        if test -f "$directory/pr"; then cat "$directory/pr"; else
            printf 'no pull requests found for branch "feature"\n' >&2
            exit 1
        fi
        ;;
    *) exit 1 ;;
esac
