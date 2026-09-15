import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from openpyxl import load_workbook


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.services import artifact_service


class ArtifactServiceXlsxTests(unittest.TestCase):
    def test_table_request_creates_xlsx_artifact(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            project_root = Path(temp_dir)
            workspace_root = project_root / "workspace"
            artifact_root = workspace_root / "generated"
            artifact_root.mkdir(parents=True, exist_ok=True)

            with patch.object(artifact_service, "PROJECT_ROOT", project_root), \
                 patch.object(artifact_service, "WORKSPACE_ROOT", workspace_root), \
                 patch.object(artifact_service, "ARTIFACT_ROOT", artifact_root):
                artifacts = artifact_service.create_artifacts_for_response(
                    user_request="请输出Excel表格",
                    response_text=(
                        "| 姓名 | 分数 |\n"
                        "| --- | --- |\n"
                        "| 张三 | 95 |\n"
                        "| 李四 | 88 |"
                    ),
                )

            self.assertEqual(len(artifacts), 1)
            artifact = artifacts[0]
            self.assertEqual(artifact["format"], "xlsx")
            self.assertTrue(artifact["name"].endswith(".xlsx"))

            file_path = project_root / artifact["relative_path"]
            self.assertTrue(file_path.exists())

            workbook = load_workbook(file_path)
            worksheet = workbook.active
            self.assertEqual(worksheet["A1"].value, "姓名")
            self.assertEqual(worksheet["B2"].value, "95")
            self.assertEqual(worksheet["A3"].value, "李四")


if __name__ == "__main__":
    unittest.main()