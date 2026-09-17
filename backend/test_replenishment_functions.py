import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import database, models
from app.main import app


PROJECT_ID = "test-replenishment-project"


class ReplenishmentFunctionsTest(unittest.TestCase):
    def setUp(self):
        database_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        database_file.close()
        self.database_path = database_file.name
        self.engine = create_engine(
            f"sqlite:///{self.database_path}", connect_args={"check_same_thread": False}
        )
        self.testing_session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        models.Base.metadata.create_all(bind=self.engine)

        def override_db():
            db = self.testing_session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[database.get_db] = override_db
        self.client = TestClient(app)
        self._seed_data()

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()
        os.unlink(self.database_path)

    def _seed_data(self):
        sales_content = (
            "sale_date,store_id,sku_id,qty\n"
            "2026-09-10,STORE-1,SKU-A,2\n"
            "2026-09-15,STORE-1,SKU-A,2\n"
            "2026-09-03,STORE-1,SKU-C,2\n"
        ).encode()
        inventory_content = (
            "snapshot_date,store_id,sku_id,qty_on_hand,qty_available,qty_locked,qty_in_transit\n"
            "2026-09-16,STORE-1,SKU-A,0,0,0,0\n"
            "2026-09-16,STORE-1,SKU-B,5,5,0,0\n"
            "2026-09-16,STORE-1,SKU-C,2,2,0,0\n"
        ).encode()
        with self.testing_session() as db:
            db.add(models.OntologyModelingProject(
                id=PROJECT_ID,
                name="Smart replenishment",
                domain="Retail",
                goal="Test replenishment",
                owner="Tester",
                terminology_owner="Tester",
                datasource_ids=[],
            ))
            sales_dataset = models.Dataset(
                id="sales-dataset",
                name="fact_sales.csv",
                size=len(sales_content),
                content_type="text/csv",
                extension="csv",
                content=sales_content,
            )
            inventory_dataset = models.Dataset(
                id="inventory-dataset",
                name="fact_inventory.csv",
                size=len(inventory_content),
                content_type="text/csv",
                extension="csv",
                content=inventory_content,
            )
            db.add_all([sales_dataset, inventory_dataset])
            self._add_object_mapping(
                db,
                "sales-object",
                "销售明细",
                sales_dataset.id,
                {"sale_date": "sale_date", "store_id": "store_id", "sku_id": "sku_id", "qty": "qty"},
            )
            self._add_object_mapping(
                db,
                "inventory-object",
                "库存快照",
                inventory_dataset.id,
                {
                    "snapshot_date": "snapshot_date",
                    "store_id": "store_id",
                    "sku_id": "sku_id",
                    "qty_on_hand": "qty_on_hand",
                    "qty_available": "qty_available",
                    "qty_locked": "qty_locked",
                    "qty_in_transit": "qty_in_transit",
                },
            )
            db.commit()

    def _add_object_mapping(self, db, object_id: str, name: str, dataset_id: str, columns: dict[str, str]):
        db.add(models.OntologyModelingObject(
            id=object_id,
            project_id=PROJECT_ID,
            name=name,
            definition=name,
            object_key=f"{object_id}-key",
            owner="Tester",
        ))
        field_mappings = []
        for api_name, source_column in columns.items():
            property_id = f"{object_id}-{api_name}"
            db.add(models.OntologyModelingProperty(
                id=property_id,
                project_id=PROJECT_ID,
                name=api_name,
                api_name=api_name,
                object_ids=[object_id],
                data_type="Text",
            ))
            field_mappings.append({"propertyId": property_id, "sourceColumn": source_column})
        db.add(models.OntologyModelingMapping(
            id=f"mapping-{object_id}",
            project_id=PROJECT_ID,
            object_id=object_id,
            dataset_id=dataset_id,
            dataset_name=f"{name}.csv",
            field_mappings=field_mappings,
            status="completed",
        ))

    def test_real_replenishment_flow_and_approved_writeback(self):
        scope = {
            "project_id": PROJECT_ID,
            "store_ids": ["STORE-1"],
            "as_of_date": "2026-09-16",
            "limit": 100,
        }
        sales = self.client.post("/api/replenishment/functions/sales-14d", json=scope)
        self.assertEqual(200, sales.status_code, sales.text)
        self.assertEqual(2, sales.json()["total"])

        inventory = self.client.post("/api/replenishment/functions/inventory-snapshot", json=scope)
        self.assertEqual(200, inventory.status_code, inventory.text)
        self.assertEqual(3, inventory.json()["total"])

        weeks = self.client.post(
            "/api/replenishment/functions/weeks-of-supply",
            json={**scope, "sales_items": sales.json()["items"], "inventory_items": inventory.json()["items"]},
        )
        self.assertEqual(200, weeks.status_code, weeks.text)

        decisions = self.client.post(
            "/api/replenishment/functions/transfer-decision",
            json={**scope, "items": weeks.json()["items"]},
        )
        self.assertEqual(200, decisions.status_code, decisions.text)
        by_sku = {item["sku_id"]: item for item in decisions.json()["items"]}
        self.assertEqual("inbound", by_sku["SKU-A"]["decision"])
        self.assertEqual("outbound", by_sku["SKU-B"]["decision"])
        self.assertEqual("undetermined", by_sku["SKU-C"]["decision"])

        quantities = self.client.post(
            "/api/replenishment/functions/transfer-quantity",
            json={**scope, "items": decisions.json()["items"]},
        )
        self.assertEqual(200, quantities.status_code, quantities.text)
        quantity_by_sku = {item["sku_id"]: item for item in quantities.json()["items"]}
        self.assertEqual(2, quantity_by_sku["SKU-A"]["inbound_quantity"])
        self.assertEqual(2, quantity_by_sku["SKU-A"]["store_total_inbound_quantity"])

        writeback = {
            "project_id": PROJECT_ID,
            "request_id": "approved-transfer-1",
            "items": [{"store_id": "STORE-1", "sku_id": "SKU-B", "direction": "outbound", "quantity": 2}],
            "approval_required": True,
            "approval_status": "pending",
            "initiated_by": "employee-1",
        }
        pending = self.client.post("/api/replenishment/functions/inventory-writeback", json=writeback)
        self.assertEqual(409, pending.status_code, pending.text)

        approved = self.client.post(
            "/api/replenishment/functions/inventory-writeback",
            json={**writeback, "approval_status": "approved", "approved_by": "manager-1"},
        )
        self.assertEqual(200, approved.status_code, approved.text)
        self.assertEqual(3, approved.json()["items"][0]["qty_available_after"])

        duplicate = self.client.post(
            "/api/replenishment/functions/inventory-writeback",
            json={**writeback, "approval_status": "approved", "approved_by": "manager-1"},
        )
        self.assertEqual(200, duplicate.status_code, duplicate.text)
        self.assertEqual(1, duplicate.json()["already_applied"])

        updated = self.client.post("/api/replenishment/functions/inventory-snapshot", json=scope)
        updated_by_sku = {item["sku_id"]: item for item in updated.json()["items"]}
        self.assertEqual(3, updated_by_sku["SKU-B"]["qty_available"])
        self.assertEqual(-2, updated_by_sku["SKU-B"]["adjustment_quantity"])


if __name__ == "__main__":
    unittest.main()