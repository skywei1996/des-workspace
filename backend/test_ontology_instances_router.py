import sys
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.routers.ontology_instances import router
from app.services.ontology_graph_store import InMemoryOntologyGraphStore, get_ontology_store


class OntologyInstancesRouterTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.store = InMemoryOntologyGraphStore()
        app.dependency_overrides[get_ontology_store] = lambda: self.store
        self.client = TestClient(app)
        self._seed_chain()

    def _seed_chain(self):
        response = self.client.post(
            "/ontology/instances/batch-upsert",
            json={
                "objects": [
                    {"id": "employee-1", "objectTypeId": "employee", "primaryKey": "E-001", "displayName": "张三"},
                    {"id": "rfq-1", "objectTypeId": "rfq", "primaryKey": "RFQ-001", "displayName": "询价单 RFQ-001"},
                    {"id": "material-1", "objectTypeId": "material", "primaryKey": "M-001", "displayName": "物料 M-001"},
                ]
            },
        )
        self.assertEqual(response.status_code, 200)
        response = self.client.post(
            "/ontology/links/batch-upsert",
            json={
                "links": [
                    {"id": "responsible-1", "linkTypeId": "responsibleFor", "sourceInstanceId": "employee-1", "targetInstanceId": "rfq-1"},
                    {"id": "contains-1", "linkTypeId": "contains", "sourceInstanceId": "rfq-1", "targetInstanceId": "material-1"},
                ]
            },
        )
        self.assertEqual(response.status_code, 200)

    def test_batch_upsert_updates_existing_business_identity(self):
        response = self.client.post(
            "/ontology/instances/batch-upsert",
            json={
                "objects": [
                    {
                        "objectTypeId": "employee",
                        "primaryKey": "E-001",
                        "displayName": "张三（采购）",
                        "properties": {"department": "采购部"},
                    }
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["objects"]
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["id"], "employee-1")
        self.assertEqual(payload[0]["displayName"], "张三（采购）")

        search_response = self.client.get("/ontology/instances", params={"query": "采购", "object_type_id": "employee"})
        self.assertEqual(search_response.status_code, 200)
        self.assertEqual([item["id"] for item in search_response.json()["objects"]], ["employee-1"])

    def test_search_matches_property_values(self):
        response = self.client.post(
            "/ontology/instances/batch-upsert",
            json={
                "objects": [
                    {
                        "objectTypeId": "material",
                        "primaryKey": "M-002",
                        "displayName": "物料 M-002",
                        "properties": {"物料名称": "铜基电源连接器"},
                    }
                ]
            },
        )
        self.assertEqual(response.status_code, 200)

        search_response = self.client.get(
            "/ontology/instances",
            params={"query": "铜基电源连接器", "object_type_id": "material"},
        )

        self.assertEqual(search_response.status_code, 200)
        self.assertEqual(
            [item["primaryKey"] for item in search_response.json()["objects"]],
            ["M-002"],
        )

    def test_search_filters_by_exact_property_name_and_value(self):
        response = self.client.post(
            "/ontology/instances/batch-upsert",
            json={
                "objects": [
                    {
                        "objectTypeId": "employee",
                        "primaryKey": "E-002",
                        "displayName": "李四",
                        "properties": {"部门": "电子元器件"},
                    },
                    {
                        "objectTypeId": "material",
                        "primaryKey": "M-003",
                        "displayName": "连接器",
                        "properties": {"material_category": "电子元器件"},
                    },
                ]
            },
        )
        self.assertEqual(response.status_code, 200)

        search_response = self.client.get(
            "/ontology/instances",
            params={"property_name": "material_category", "property_value": "电子元器件"},
        )

        self.assertEqual(search_response.status_code, 200)
        self.assertEqual(
            [item["primaryKey"] for item in search_response.json()["objects"]],
            ["M-003"],
        )

    def test_traverse_respects_hop_depth(self):
        one_hop = self.client.post(
            "/ontology/traverse",
            json={"startInstanceIds": ["employee-1"], "maxHops": 1, "direction": "out"},
        )
        two_hops = self.client.post(
            "/ontology/traverse",
            json={"startInstanceIds": ["employee-1"], "maxHops": 2, "direction": "out"},
        )

        self.assertEqual(one_hop.status_code, 200)
        self.assertEqual({node["id"] for node in one_hop.json()["nodes"]}, {"employee-1", "rfq-1"})
        self.assertEqual(two_hops.status_code, 200)
        self.assertEqual({node["id"] for node in two_hops.json()["nodes"]}, {"employee-1", "rfq-1", "material-1"})
        self.assertEqual(two_hops.json()["maxDepthReached"], 2)

    def test_traverse_supports_inbound_direction_and_link_filter(self):
        inbound = self.client.post(
            "/ontology/traverse",
            json={"startInstanceIds": ["material-1"], "maxHops": 2, "direction": "in"},
        )
        filtered = self.client.post(
            "/ontology/traverse",
            json={
                "startInstanceIds": ["employee-1"],
                "maxHops": 3,
                "direction": "out",
                "linkTypeIds": ["responsibleFor"],
            },
        )

        self.assertEqual(inbound.status_code, 200)
        self.assertEqual({node["id"] for node in inbound.json()["nodes"]}, {"employee-1", "rfq-1", "material-1"})
        self.assertEqual(filtered.status_code, 200)
        self.assertEqual({node["id"] for node in filtered.json()["nodes"]}, {"employee-1", "rfq-1"})


if __name__ == "__main__":
    unittest.main()