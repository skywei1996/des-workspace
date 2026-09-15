import sys
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app import models
from app.database import Base
from app.mcp_server import _build_effective_user_request


class EffectiveUserRequestTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test_effective_user_request.db"
        self.engine = create_engine(
            f"sqlite:///{db_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_uses_primary_request_when_no_follow_up_exists(self):
        self.db.add(models.ChatMessage(chat_id=301, sender_role="user", content="生成OpenClaw分析报告"))
        self.db.commit()

        effective_request = _build_effective_user_request(301, "生成OpenClaw分析报告", self.db)

        self.assertEqual(effective_request, "生成OpenClaw分析报告")

    def test_combines_primary_request_and_follow_up_constraints(self):
        self.db.add(models.ChatMessage(chat_id=302, sender_role="user", content="生成OpenClaw分析报告"))
        self.db.add(models.ChatMessage(chat_id=302, sender_role="assistant", content="请补充目标读者和篇幅要求"))
        self.db.add(models.ChatMessage(chat_id=302, sender_role="user", content="目标给老板看，1000个字数，25-26年，需要竞品分析"))
        self.db.commit()

        effective_request = _build_effective_user_request(302, "目标给老板看，1000个字数，25-26年，需要竞品分析", self.db)

        self.assertIn("原始任务：生成OpenClaw分析报告", effective_request)
        self.assertIn("补充要求：目标给老板看，1000个字数，25-26年，需要竞品分析", effective_request)


if __name__ == "__main__":
    unittest.main()