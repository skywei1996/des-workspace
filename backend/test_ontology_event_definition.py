import unittest
from fastapi import HTTPException

from app.routers.ontology_definitions import _normalize_event_definition, _validate_kind


class OntologyEventDefinitionTests(unittest.TestCase):
    def test_accepts_object_action_definition_kind(self):
        self.assertEqual(_validate_kind("object_action"), "object_action")

    def test_normalizes_valid_event_definition(self):
        definition = _normalize_event_definition({
            "subjectObjectTypeId": "inventory",
            "triggerSource": "scheduled_check",
            "triggerConfig": {"intervalMinutes": 15},
        })

        self.assertEqual(definition["subjectObjectTypeId"], "inventory")
        self.assertEqual(definition["triggerConfig"], {"intervalMinutes": 15})
        self.assertNotIn("condition", definition)
        self.assertNotIn("dedupStrategy", definition)

    def test_normalizes_legacy_field_change_event(self):
        definition = _normalize_event_definition({
            "objectTypeId": "contract",
            "triggerType": "updated",
            "propertyId": "contract-amount",
        })

        self.assertEqual(definition["subjectObjectTypeId"], "contract")
        self.assertEqual(definition["triggerSource"], "object_change")
        self.assertEqual(definition["triggerConfig"], {
            "changeType": "field_changed",
            "propertyId": "contract-amount",
        })

    def test_rejects_incomplete_external_event(self):
        with self.assertRaises(HTTPException) as error:
            _normalize_event_definition({
                "subjectObjectTypeId": "inventory",
                "triggerSource": "external_event",
                "triggerConfig": {"sourceSystem": "WMS", "integrationType": "webhook"},
            })

        self.assertEqual(error.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()