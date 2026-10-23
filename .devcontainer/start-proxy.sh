#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/cs-assignment-portfolio

port="${PORT:-8081}"
log_file="/tmp/codespace-proxy-${port}.log"

if ! pgrep -f '[n]ode src/index.js' >/dev/null; then
    nohup env PORT="$port" npm start >"$log_file" 2>&1 </dev/null &
fi

for attempt in {1..30}; do
    if curl --fail --silent "http://127.0.0.1:${port}/api/proxy-usage" >/dev/null; then
        exit 0
    fi
    sleep 2
done

echo "Proxy app did not respond on port ${port}; server log follows:"
cat "$log_file"
exit 1