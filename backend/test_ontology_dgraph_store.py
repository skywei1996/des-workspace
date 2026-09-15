import json
import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.services.ontology_graph_store import DgraphOntologyGraphStore


class RecordingDgraphStore(DgraphOntologyGraphStore):
    def __init__(self):
        super().__init__(base_url="http://dgraph.test")
        self.requests = []
        self.responses = []

    def _request(self, path, body, content_type):
        self.requests.append((path, body, content_type))
        return self.responses.pop(0) if self.responses else {}


class DgraphOntologyGraphStoreTests(unittest.TestCase):
    def test_upsert_builds_schema_identity_and_property_indexes(self):
        store = RecordingDgraphStore()
        store.responses = [
            {},
            {"data": {"objects": []}},
            {},
        ]

        result = store.upsert_objects(
            [
                {
                    "id": "material-1",
                    "objectTypeId": "material",
                    "primaryKey": "MAT0081",
                    "displayName": "铜基电源连接器",
                    "properties": {"material_category": "电子元器件"},
                    "source": "dataset",
                }
            ]
        )

        self.assertEqual(result[0]["id"], "material-1")
        self.assertEqual(store.requests[0][0], "/alter")
        self.assertIn('eq(ontology.identity, ["material\\u0000MAT0081"])', store.requests[1][1])
        mutation = json.loads(store.requests[2][1])["set"][0]
        self.assertEqual(mutation["ontology.identity"], "material\u0000MAT0081")
        self.assertIn('["material_category","电子元器件"]', mutation["ontology.property_exact"])

    def test_exact_property_search_uses_indexed_token(self):
        store = RecordingDgraphStore()
        store._schema_ready = True
        store.responses = [{"data": {"objects": []}}]

        store.search_objects(
            property_name="material_category",
            property_value="电子元器件",
            limit=500,
        )

        query = store.requests[0][1]
        self.assertIn("eq(ontology.property_exact", query)
        self.assertIn("material_category", query)
        self.assertIn("电子元器件", query)
        self.assertIn("first: 500", query)

    def test_update_removes_stale_property_indexes_before_setting_new_values(self):
        store = RecordingDgraphStore()
        store._schema_ready = True
        store.responses = [
            {
                "data": {
                    "objects": [
                        {
                            "uid": "0x1",
                            "ontology.id": "material-1",
                            "ontology.identity": "material\u0000MAT0081",
                            "ontology.object_type_id": "material",
                            "ontology.primary_key": "MAT0081",
                        }
                    ]
                }
            },
            {},
        ]

        store.upsert_objects(
            [
                {
                    "objectTypeId": "material",
                    "primaryKey": "MAT0081",
                    "displayName": "铜基电源连接器",
                    "properties": {"material_category": "连接器"},
                }
            ]
        )

        mutation = json.loads(store.requests[1][1])
        self.assertEqual(
            mutation["delete"],
            [{"uid": "0x1", "ontology.property_exact": None}],
        )
        self.assertEqual(
            mutation["set"][0]["ontology.property_exact"],
            ['["material_category","连接器"]'],
        )


if __name__ == "__main__":
    unittest.main()