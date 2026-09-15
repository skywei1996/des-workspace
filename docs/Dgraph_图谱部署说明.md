# WorkMate Dgraph 图谱部署

本体实例、实例关系、属性检索和多跳遍历由 Dgraph 持久化。前端与 `/ontology` API 保持不变，SQLite 继续服务 WorkMate 的其他业务模块。

## 启动

1. 安装并启动 Docker Desktop。
2. 在项目根目录启动 Dgraph：

   ```powershell
   docker compose -f compose.dgraph.yml up -d
   ```

3. 在 `backend/.env` 中配置：

   ```dotenv
   ONTOLOGY_GRAPH_BACKEND=dgraph
   DGRAPH_URL=http://127.0.0.1:8080
   ```

4. 首次迁移原 SQLite 本体数据：

   ```powershell
   .\.venv\Scripts\python.exe backend\migrate_ontology_to_dgraph.py
   ```

5. 按现有方式启动 WorkMate 后端和前端。

Dgraph schema 会在第一次图谱请求时自动初始化。Dgraph 不可连接时，本体接口返回 HTTP 503，不会静默切回 SQLite。

## 数据模型

- `OntologyObject`：实体实例，包含对象类型、业务主键、显示名称、JSON 属性、检索文本与数据来源。
- `OntologyLink`：关系实例，包含关系类型、源实体、目标实体、关系属性与来源。
- `ontology.property_exact`：属性名与属性值的精确索引，用于属性值节点的实时反查。
- `ontology.search_text`：实体名称、业务主键和属性值的全文检索字段。

## 运维端口

- `8080`：Dgraph HTTP/DQL API，WorkMate 后端使用。
- `9080`：Dgraph gRPC API，保留给管理与后续集成。

生产环境应固定 Dgraph 镜像版本、启用备份，并限制 `8080`、`9080` 仅供内部网络访问。