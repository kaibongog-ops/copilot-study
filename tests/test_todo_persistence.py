import functools
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class TodoPersistenceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(
            SimpleHTTPRequestHandler,
            directory=str(PROJECT_ROOT),
        )
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.server_thread = threading.Thread(
            target=cls.server.serve_forever,
            daemon=True,
        )
        cls.server_thread.start()

        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        port = self.server.server_address[1]
        self.page.goto(f"http://127.0.0.1:{port}/index.html")

    def tearDown(self):
        self.context.close()

    def test_added_todo_survives_page_reload(self):
        todo_text = "再読み込み後に残るタスク"
        self.page.get_by_label("ToDoの入力").fill(todo_text)
        self.page.get_by_role("button", name="追加").click()

        self.page.reload()

        self.assertTrue(
            self.page.get_by_text(todo_text, exact=True).is_visible(),
            "再読み込み後も追加したタスクが表示されること",
        )
        self.assertEqual(
            self.page.locator("#todo-count").inner_text(),
            "1",
            "再読み込み後も未完了数が保持されること",
        )


if __name__ == "__main__":
    unittest.main()