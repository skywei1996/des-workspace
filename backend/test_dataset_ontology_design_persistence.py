import os
import sys
import tempfile

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(__file__))

from app import database, models
from app.main import app


def test_dataset_and_ontology_design_are_persisted():
    database_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    database_file.close()
    engine = create_engine(f"sqlite:///{database_file.name}", connect_args={"check_same_thread": False})
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    def override_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[database.get_db] = override_db
    try:
        with TestClient(app) as client:
            upload = client.post(
                "/api/datasets/",
                files={"file": ("employees.csv", b"id,name\n1,Ada\n", "text/csv")},
            )
            assert upload.status_code == 200
            dataset = upload.json()
            assert dataset["name"] == "employees.csv"

            listed = client.get("/api/datasets/")
            assert listed.status_code == 200
            assert listed.json()[0]["id"] == dataset["id"]

            content = client.get(f"/api/datasets/{dataset['id']}/content")
            assert content.status_code == 200
            assert content.content == b"id,name\n1,Ada\n"

            saved = client.put(
                "/api/ontology-design/workmate-object-types",
                json={"items": [{"id": "employee", "name": "Employee"}]},
            )
            assert saved.status_code == 200

            loaded = client.get("/api/ontology-design/workmate-object-types")
            assert loaded.status_code == 200
            assert loaded.json()["items"] == [{"id": "employee", "name": "Employee"}]

            project = client.post(
                "/api/ontology-modeling/projects",
                json={
                    "name": "Main Plan",
                    "domain": "Production",
                    "goal": "Define planning objects",
                    "owner": "Zhang San",
                    "terminology_owner": "Li Si",
                },
            )
            assert project.status_code == 201
            project_id = project.json()["id"]

            object_response = client.post(
                f"/api/ontology-modeling/projects/{project_id}/objects",
                json={
                    "name": "Material",
                    "definition": "Production material",
                    "object_key": "material_id",
                    "owner": "Zhang San",
                },
            )
            assert object_response.status_code == 201
            object_id = object_response.json()["id"]

            property_response = client.post(
                f"/api/ontology-modeling/projects/{project_id}/objects/{object_id}/properties",
                json={
                    "name": "Material code",
                    "api_name": "material_code",
                    "data_type": "Text",
                    "description": "Unique material identifier",
                    "required": True,
                    "primary_key": True,
                    "source": "Pending mapping",
                },
            )
            assert property_response.status_code == 201

            properties = client.get(f"/api/ontology-modeling/projects/{project_id}/properties")
            assert properties.status_code == 200
            assert properties.json()[0]["api_name"] == "material_code"
            assert properties.json()[0]["primary_key"] is True

            second_object = client.post(
                f"/api/ontology-modeling/projects/{project_id}/objects",
                json={
                    "name": "Product",
                    "definition": "Finished product",
                    "object_key": "product_id",
                    "owner": "Zhang San",
                },
            )
            assert second_object.status_code == 201

            shared_property = client.post(
                f"/api/ontology-modeling/projects/{project_id}/properties",
                json={
                    "name": "Created at",
                    "api_name": "created_at",
                    "data_type": "Date",
                    "description": "Record creation time",
                },
            )
            assert shared_property.status_code == 201
            shared_property_id = shared_property.json()["id"]
            assert shared_property.json()["object_ids"] == []

            first_link = client.post(
                f"/api/ontology-modeling/projects/{project_id}/objects/{object_id}/properties/{shared_property_id}"
            )
            second_link = client.post(
                f"/api/ontology-modeling/projects/{project_id}/objects/{second_object.json()['id']}/properties/{shared_property_id}"
            )
            assert first_link.status_code == 201
            assert second_link.status_code == 201
            assert set(second_link.json()["object_ids"]) == {object_id, second_object.json()["id"]}
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
        os.unlink(database_file.name)