from app import database, models
from app.services.ontology_graph_store import DgraphOntologyGraphStore


BATCH_SIZE = 200


def batches(items, size=BATCH_SIZE):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def migrate():
    store = DgraphOntologyGraphStore()
    store.ensure_schema()
    db = database.SessionLocal()
    try:
        objects = db.query(models.OntologyObjectInstance).all()
        links = db.query(models.OntologyLinkInstance).all()

        object_payloads = [
            {
                "id": item.id,
                "objectTypeId": item.object_type_id,
                "primaryKey": item.primary_key,
                "displayName": item.display_name,
                "properties": item.properties or {},
                "source": item.source,
            }
            for item in objects
        ]
        link_payloads = [
            {
                "id": item.id,
                "linkTypeId": item.link_type_id,
                "sourceInstanceId": item.source_instance_id,
                "targetInstanceId": item.target_instance_id,
                "properties": item.properties or {},
                "source": item.source,
            }
            for item in links
        ]

        for batch in batches(object_payloads):
            store.upsert_objects(batch)
        for batch in batches(link_payloads):
            store.upsert_links(batch)

        print(f"Migrated {len(object_payloads)} objects and {len(link_payloads)} links to Dgraph.")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()