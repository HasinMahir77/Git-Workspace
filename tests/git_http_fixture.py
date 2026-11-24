"""Serve a disposable Git remote that requires a configured credential helper."""

import base64
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import subprocess
from threading import Thread
from urllib.parse import urlsplit


@contextmanager
def authenticated_git_remote(directory):
    credentials = "fixture:local-test-password"
    authorization = "Basic " + base64.b64encode(credentials.encode()).decode()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_GET(self):
            self.serve_git()

        def do_POST(self):
            self.serve_git()

        def serve_git(self):
            if self.headers.get("Authorization") != authorization:
                self.send_response(401)
                self.send_header("WWW-Authenticate", 'Basic realm="Git fixture"')
                self.end_headers()
                return
            url = urlsplit(self.path)
            length = int(self.headers.get("Content-Length", "0"))
            response = subprocess.check_output(
                ["git", "http-backend"],
                input=self.rfile.read(length),
                env={
                    **os.environ,
                    "GIT_PROJECT_ROOT": str(directory),
                    "GIT_HTTP_EXPORT_ALL": "1",
                    "PATH_INFO": url.path,
                    "QUERY_STRING": url.query,
                    "REQUEST_METHOD": self.command,
                    "CONTENT_TYPE": self.headers.get("Content-Type", ""),
                    "CONTENT_LENGTH": str(length),
                    "REMOTE_USER": "fixture",
                },
            )
            headers, body = response.split(b"\r\n\r\n", 1)
            headers = dict(line.decode().split(": ", 1) for line in headers.splitlines())
            self.send_response(int(headers.pop("Status", "200").split()[0]))
            for name, value in headers.items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(body)

    with HTTPServer(("127.0.0.1", 0), Handler) as server:
        thread = Thread(target=server.serve_forever)
        thread.start()
        try:
            host = f"127.0.0.1:{server.server_port}"
            yield f"http://{host}", f"http://{credentials}@{host}"
        finally:
            server.shutdown()
            thread.join()
