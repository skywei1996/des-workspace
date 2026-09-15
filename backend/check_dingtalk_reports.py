import argparse
import json
from datetime import datetime, timedelta

from app.database import SessionLocal
from app import models
from app.services.mcp_client import MCPHTTPClient


def _to_millis(days: int) -> tuple[int, int]:
    end = datetime.now()
    start = end - timedelta(days=days)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe DingTalk MCP report visibility.")
    parser.add_argument("--userid", required=True, help="DingTalk userId to query")
    parser.add_argument("--days", type=int, default=3, help="How many days back to query")
    parser.add_argument("--template-name", default="日报", help="Optional template name filter")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        server = (
            db.query(models.MCPServer)
            .filter(models.MCPServer.server_key == "dingtalk_mcp")
            .first()
        )
        if not server:
            raise SystemExit("dingtalk_mcp server not found in database")

        client = MCPHTTPClient(server)
        client.list_tools()

        start_ms, end_ms = _to_millis(args.days)

        probes = [
            ("searchUser", {"queryWord": args.userid, "offset": 0, "size": 10}),
            ("getUserDetailByUserId", {"userid": args.userid}),
            (
                "getReportList",
                {
                    "userid": args.userid,
                    "template_name": args.template_name,
                    "start_time": start_ms,
                    "end_time": end_ms,
                    "cursor": 0,
                    "size": 20,
                },
            ),
        ]

        for tool_name, payload in probes:
            print(f"=== {tool_name} ===")
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            result = client.call_tool(tool_name, payload)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            print()
    finally:
        db.close()


if __name__ == "__main__":
    main()