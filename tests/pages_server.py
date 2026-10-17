"""Serve dist exactly as a Pages project site, with no root fallback."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
PREFIX = '/reel-and-chill/'


class PagesHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send_head(self):
        path = urlsplit(self.path).path
        if not path.startswith(PREFIX):
            self.send_error(404)
            return None
        self.path = self.path[len(PREFIX) - 1:]
        return super().send_head()


@contextmanager
def pages_server():
    if not (ROOT / 'dist/index.html').is_file():
        raise SystemExit('Run npm run build before browser QA.')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(PagesHandler, directory=str(ROOT / 'dist')))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}{PREFIX}'
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
