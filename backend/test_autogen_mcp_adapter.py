import unittest
import urllib.error
from unittest.mock import patch


from app import models
from app.services.mcp_client import MCPHTTPClient


class MCPHTTPClientRetryTests(unittest.TestCase):
    def test_call_tool_retries_transient_dingtalk_report_error_after_refresh(self):
        server = models.MCPServer(
            server_key="toolset_4",
            name="Ding_Talk_0323",
            transport="streamable-http",
            url="https://example.com/mcp",
            headers={},
            timeout_seconds=30,
        )
        client = MCPHTTPClient(server)

        http_error = urllib.error.HTTPError(
            url="https://example.com/mcp",
            code=401,
            msg="Unauthorized",
            hdrs=None,
            fp=None,
        )
        recovered_response = {"result": {"content": [{"type": "text", "text": "ok"}], "isError": False}}

        side_effects = [
            http_error,
            {"result": {}},
            {"result": {"tools": []}},
            recovered_response,
        ]

        with patch.object(client, "_post", side_effect=side_effects) as mocked_post:
            response = client.call_tool("getReportList", {"userid": "manager7295"})

        self.assertTrue(response.get("ok"))
        self.assertEqual(response.get("result"), recovered_response["result"])
        self.assertEqual(mocked_post.call_count, 4)


if __name__ == "__main__":
    unittest.main()