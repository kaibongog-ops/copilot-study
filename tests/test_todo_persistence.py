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

    def add_todo(self, text):
        self.page.get_by_label("ToDoの入力").fill(text)
        self.page.get_by_role("button", name="追加").click()

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

    def test_filters_show_matching_todos_and_global_pending_count(self):
        self.add_todo("未完了タスク")
        self.add_todo("完了タスク")
        self.page.get_by_label("完了: 完了タスク").check()

        self.page.get_by_role("button", name="未完了", exact=True).click()
        self.assertEqual(self.page.locator("#todo-list .todo-item").count(), 1)
        self.assertTrue(self.page.get_by_text("未完了タスク", exact=True).is_visible())
        self.assertEqual(self.page.locator("#todo-count").inner_text(), "1")

        self.page.get_by_role("button", name="完了", exact=True).click()
        self.assertEqual(self.page.locator("#todo-list .todo-item").count(), 1)
        self.assertTrue(self.page.get_by_text("完了タスク", exact=True).is_visible())
        self.assertEqual(self.page.locator("#todo-count").inner_text(), "1")

        self.page.get_by_role("button", name="すべて", exact=True).click()
        self.assertEqual(self.page.locator("#todo-list .todo-item").count(), 2)

    def test_adding_todo_keeps_completed_filter_and_explains_hidden_todo(self):
        self.add_todo("既存の完了タスク")
        self.page.get_by_label("完了: 既存の完了タスク").check()
        self.page.get_by_role("button", name="完了", exact=True).click()

        self.add_todo("新しい未完了タスク")

        completed_filter = self.page.get_by_role("button", name="完了", exact=True)
        self.assertEqual(completed_filter.get_attribute("aria-pressed"), "true")
        self.assertTrue(self.page.get_by_text("新しい未完了タスク", exact=True).count() == 0)
        self.assertTrue(
            self.page.get_by_text("タスクを追加しました。現在の「完了」表示には含まれません。").is_visible()
        )
        self.assertEqual(self.page.locator("#todo-count").inner_text(), "1")

        self.page.get_by_role("button", name="すべて", exact=True).click()
        self.assertTrue(self.page.get_by_text("新しい未完了タスク", exact=True).is_visible())

    def test_empty_filter_message_and_reload_reset(self):
        self.page.get_by_role("button", name="完了", exact=True).click()
        self.assertTrue(self.page.get_by_text("まだタスクがありません").is_visible())

        self.add_todo("未完了タスク")
        self.assertTrue(
            self.page.get_by_text("条件に一致するタスクがありません").is_visible()
        )

        self.page.reload()
        all_filter = self.page.get_by_role("button", name="すべて", exact=True)
        self.assertEqual(all_filter.get_attribute("aria-pressed"), "true")
        self.assertTrue(self.page.get_by_text("未完了タスク", exact=True).is_visible())

    def test_filter_change_preserves_unsaved_edit_draft(self):
        self.add_todo("完了タスク")
        self.page.get_by_label("完了: 完了タスク").check()
        self.page.get_by_role("button", name="編集: 完了タスク").click()
        self.page.get_by_label("タスク編集: 完了タスク").fill("編集中の内容")

        self.page.get_by_role("button", name="未完了", exact=True).click()
        self.page.get_by_role("button", name="完了", exact=True).click()

        edit_input = self.page.get_by_label("タスク編集: 完了タスク")
        self.assertEqual(edit_input.input_value(), "編集中の内容")
        self.page.get_by_role("button", name="保存").click()
        self.assertTrue(self.page.get_by_text("編集中の内容", exact=True).is_visible())

    def test_clear_completed_removes_all_completed_todos_in_active_filter(self):
        self.add_todo("削除する完了タスク")
        self.page.get_by_label("完了: 削除する完了タスク").check()
        self.add_todo("残す未完了タスク")
        self.add_todo("もう一つ削除する完了タスク")
        self.page.get_by_label("完了: もう一つ削除する完了タスク").check()

        self.page.get_by_role("button", name="未完了", exact=True).click()
        self.page.get_by_role("button", name="完了済みのタスクを削除").click()

        self.assertEqual(self.page.locator("#todo-count").inner_text(), "1")
        self.assertTrue(self.page.get_by_text("残す未完了タスク", exact=True).is_visible())
        self.page.get_by_role("button", name="すべて", exact=True).click()
        self.assertEqual(self.page.locator("#todo-list .todo-item").count(), 1)


if __name__ == "__main__":
    unittest.main()