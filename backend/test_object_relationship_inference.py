import unittest
from unittest.mock import patch

from app.services.object_type_analyzer import infer_object_relationships


class ObjectRelationshipInferenceTests(unittest.TestCase):
    @patch("app.services.object_type_analyzer._complete_json", side_effect=RuntimeError("offline"))
    def test_fallback_generates_executable_foreign_key_mapping(self, _mock_complete):
        result = infer_object_relationships(
            [
                {"id": "quotation", "name": "报价单", "apiName": "Quotation"},
                {"id": "supplier", "name": "供应商", "apiName": "Supplier"},
            ],
            [
                {"id": "quotation-supplier-id", "objectTypeId": "quotation", "name": "supplier_id", "apiName": "supplierId", "dataType": "文本"},
                {"id": "supplier-id", "objectTypeId": "supplier", "name": "supplier_id", "apiName": "supplierId", "dataType": "文本", "primaryKey": True},
            ],
            [],
        )

        self.assertEqual(result["generatedBy"], "rules")
        self.assertEqual(len(result["suggestions"]), 1)
        suggestion = result["suggestions"][0]
        self.assertEqual(suggestion["sourceObjectTypeId"], "quotation")
        self.assertEqual(suggestion["targetObjectTypeId"], "supplier")
        self.assertEqual(suggestion["foreignKeyPropertyId"], "quotation-supplier-id")
        self.assertEqual(suggestion["primaryKeyPropertyId"], "supplier-id")
        self.assertEqual(suggestion["cardinality"], "多对一")


if __name__ == "__main__":
    unittest.main()