---
name: replenishment-execution
description: 通用调补货执行 Skill。Use when 用户要求开始调补货、执行补货、计算门店库存调拨、查看调补货建议，或在人工审批后继续库存写回。通过 DES 调补货 HTTP 接口读取销售与库存、计算周转与调拨建议，并在需要审批时停止写回等待人工决定。
---

# 通用调补货执行

## 目标

把用户的调补货请求转换为一组严格、有状态且可审计的接口调用：

1. 获取近 14 天销售数据；
2. 获取最新库存快照；
3. 计算可销售周数；
4. 生成调入、调出或待判断决策；
5. 计算系统当前支持的调入数量；
6. 判断是否需要人工审批；
7. 在满足写回条件后调整库存；
8. 向用户返回执行结果。


## 适用场景

出现以下意图时使用本 Skill：

- “帮我开始调补货”
- “执行补货”
- “看看哪些门店需要调货”
- “根据最近销售和库存做调拨”
- “继续执行刚才的调补货方案”
- “我批准这个调补货方案”

仅咨询补货规则、解释库存概念但不要求计算或执行时，不要写回库存。

## 接口基础信息

默认服务地址：

```text
http://localhost:8000
```

所有业务接口前缀：

```text
/api/replenishment/functions
```

默认本体项目：

```text
0b1a25a9-f6b7-4f38-8007-38d4182e3e4a
```

若宿主已为数字员工绑定其他本体项目，应优先使用绑定的 `project_id`。不要根据用户自然语言自行编造项目 ID。

公共请求字段：

```json
{
  "project_id": "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a",
  "store_ids": [],
  "as_of_date": "2026-09-16",
  "limit": 5000
}
```

字段说明：

- `project_id`：调补货本体项目 ID。
- `store_ids`：空数组代表全部门店；用户指定门店时只传指定门店。
- `as_of_date`：统计截止日期，格式必须为 `YYYY-MM-DD`；未指定时可省略。
- `limit`：单次返回条数，范围为 1 至 100000。

## 执行原则

1. 严格按本 Skill 的调用顺序执行，不跳过销售、库存或审批判断。
2. 同一轮执行中的所有接口必须使用相同的 `project_id`、`store_ids` 和 `as_of_date`。
3. 每次执行先生成唯一 `request_id`，直到写回完成都保持不变。
4. 不得凭空生成门店、SKU、库存、销量、方向或数量。
5. 任何 `approval_required=true` 的条目都会使整批写回进入人工审批。
6. 在人工明确批准前，禁止调用库存写回接口。
7. 用户拒绝、取消或未明确表态时，停止执行且不写回。
8. 接口报错时停止后续调用，向用户说明失败阶段和可操作原因。
9. 重试库存写回时必须复用原 `request_id`，利用服务端幂等能力避免重复调整。
10. 不要把读取数据、计算建议描述成已经完成库存调整；只有写回接口返回 `status=completed` 才算执行完成。

## 标准流程

### 第 0 步：确定执行上下文

从用户请求或宿主配置中确定：

```json
{
  "project_id": "本体项目 ID",
  "store_ids": ["可选门店 ID"],
  "as_of_date": "可选截止日期",
  "request_id": "本轮唯一 ID",
  "initiated_by": "数字员工或当前用户 ID"
}
```

推荐 `request_id` 格式：

```text
replenishment-{yyyyMMddHHmmss}-{random}
```

若用户没有指定门店，使用全部门店，不必在调用前追问。

### 第 1 步：读取近 14 天销售数据

```http
POST /api/replenishment/functions/sales-14d
Content-Type: application/json
```

请求示例：

```json
{
  "project_id": "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a",
  "store_ids": [],
  "as_of_date": "2026-09-16",
  "limit": 5000
}
```

保留响应中的完整 `items`，下一步以 `sales_items` 传递。

关键返回字段：

- `sales_14d`
- `sales_7d`
- `average_weekly_sales`
- `store_id`
- `sku_id`

### 第 2 步：读取库存快照

```http
POST /api/replenishment/functions/inventory-snapshot
Content-Type: application/json
```

请求体与第 1 步相同。保留响应中的完整 `items`，下一步以 `inventory_items` 传递。

关键返回字段：

- `qty_on_hand`
- `qty_available`
- `qty_locked`
- `qty_in_transit`
- `adjustment_quantity`
- `store_id`
- `sku_id`

### 第 3 步：计算可销售周数

```http
POST /api/replenishment/functions/weeks-of-supply
Content-Type: application/json
```

请求示例：

```json
{
  "project_id": "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a",
  "store_ids": [],
  "as_of_date": "2026-09-16",
  "limit": 5000,
  "sales_items": [],
  "inventory_items": []
}
```

其中：

- `sales_items` 必须使用第 1 步返回的 `items`；
- `inventory_items` 必须使用第 2 步返回的 `items`。

不要只传摘要。

### 第 4 步：生成调拨决策

```http
POST /api/replenishment/functions/transfer-decision
Content-Type: application/json
```

请求示例：

```json
{
  "project_id": "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a",
  "store_ids": [],
  "as_of_date": "2026-09-16",
  "limit": 5000,
  "items": []
}
```

`items` 必须使用第 3 步返回的 `items`。

当前系统决策规则：

- `inbound`：近 7 天有销量，且 `weeks_of_supply < 1`；
- `outbound`：近 14 天无销量，且可销售周数为空或大于 2；
- `undetermined`：不满足自动调入或自动调出规则。

不得修改接口返回的 `decision` 和 `decision_reason`。

### 第 5 步：计算调货数量和审批标记

```http
POST /api/replenishment/functions/transfer-quantity
Content-Type: application/json
```

请求示例：

```json
{
  "project_id": "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a",
  "store_ids": [],
  "as_of_date": "2026-09-16",
  "limit": 5000,
  "items": []
}
```

`items` 必须使用第 4 步返回的 `items`。

当前数量规则：

- 目标可销售周数为 `1.2`；
- 自动调入需求量为 `ceil(1.2 × average_weekly_sales - available_inventory)`，最低为 0；
- 单个 SKU 的 `inbound_quantity` 当前最多为 2；
- `decision=undetermined` 时需要审批；
- 单店总调入数量大于 50 时需要审批。

重要限制：当前接口只计算 `inbound_quantity`，没有计算自动调出数量。因此：

- 可以自动形成 `inbound` 写回项；
- 不得把 `required_quantity_to_target` 当作调出数量；
- 不得为 `outbound` 项猜测数量；
- 只有其他可信业务模块或人工明确提供正数 `quantity` 时，才能形成 `outbound` 写回项。

### 第 6 步：形成待执行方案

从第 5 步结果生成待执行项。

自动调入项转换规则：

```json
{
  "store_id": "STORE-1",
  "sku_id": "SKU-A",
  "direction": "inbound",
  "quantity": 2
}
```

仅包含满足以下全部条件的条目：

- `decision == "inbound"`
- `inbound_quantity > 0`

可信来源提供的调出项格式：

```json
{
  "store_id": "STORE-1",
  "sku_id": "SKU-B",
  "direction": "outbound",
  "quantity": 2
}
```

如果最终没有任何带正数数量的待执行项，直接向用户返回“计算完成，但没有可写回的调补货项”，不要调用写回接口。

### 第 7 步：判断是否需要人工审批

满足任一条件时，整批方案进入人工审批：

- 第 5 步任一条目 `approval_required == true`；
- 第 5 步摘要 `approval_required_count > 0`；
- 方案包含人工提供的调出数量；
- 宿主系统配置了更严格的审批规则。

需要审批时，向宿主返回或展示以下结构：

```json
{
  "status": "approval_required",
  "request_id": "replenishment-20260916103000-a1b2",
  "project_id": "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a",
  "summary": {
    "total_items": 3,
    "total_inbound_quantity": 4,
    "total_outbound_quantity": 2,
    "approval_required_count": 1
  },
  "reasons": [
    "存在无法自动判断的商品"
  ],
  "writeback_items": []
}
```

审批展示至少包含：

- 门店 ID；
- SKU ID；
- 调入或调出方向；
- 数量；
- 当前可用库存；
- 近 7 天和近 14 天销量；
- 可销售周数；
- 决策原因；
- 需要审批的原因。

此时立即暂停，不得调用 `/inventory-writeback`。

### 第 8 步：处理人工决定

只有以下明确表达可视为批准：

- “批准”
- “审批通过”
- “确认执行这个方案”
- 宿主审批控件返回结构化 `approved=true`

以下情况不算批准：

- “看看吧”
- “应该可以”
- “继续分析”
- 没有回复
- 仅修改了某个条目

如果用户修改了门店、SKU、方向或数量，应把修改后的方案视为新版本，重新展示并再次请求批准。

拒绝时返回：

```json
{
  "status": "rejected",
  "request_id": "原 request_id",
  "message": "用户已拒绝调补货方案，库存未发生变化。"
}
```

### 第 9 步：库存写回

无需审批，或人工审批通过后，调用：

```http
POST /api/replenishment/functions/inventory-writeback
Content-Type: application/json
```

无需审批的请求示例：

```json
{
  "project_id": "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a",
  "request_id": "replenishment-20260916103000-a1b2",
  "items": [
    {
      "store_id": "STORE-1",
      "sku_id": "SKU-A",
      "direction": "inbound",
      "quantity": 2
    }
  ],
  "approval_required": false,
  "approval_status": "not_required",
  "initiated_by": "digital_employee",
  "approved_by": ""
}
```

审批通过后的请求示例：

```json
{
  "project_id": "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a",
  "request_id": "replenishment-20260916103000-a1b2",
  "items": [
    {
      "store_id": "STORE-1",
      "sku_id": "SKU-A",
      "direction": "inbound",
      "quantity": 2
    }
  ],
  "approval_required": true,
  "approval_status": "approved",
  "initiated_by": "digital_employee",
  "approved_by": "manager-1"
}
```

写回前必须检查：

- 每条都有非空 `store_id` 和 `sku_id`；
- `direction` 只能为 `inbound` 或 `outbound`；
- `quantity` 必须为正整数；
- 需要审批时 `approval_status` 必须为 `approved`；
- 需要审批时 `approved_by` 必须来自真实审批人；
- 必须使用第 0 步生成的原 `request_id`。

### 第 10 步：返回最终结果

成功示例：

```text
调补货已执行完成。
- 本体项目：0b1a25a9-f6b7-4f38-8007-38d4182e3e4a
- 调整条目：3
- 首次写回：3
- 重复项：0
- 请求编号：replenishment-20260916103000-a1b2
```

响应中的：

- `status == "applied"` 表示本次已写回；
- `status == "already_applied"` 表示相同 `request_id + store_id + sku_id` 已处理，不能再次调整；
- `qty_available_before` 和 `qty_available_after` 用于展示库存变化。

如果全部为 `already_applied`，应告诉用户该请求此前已经执行，不要描述成再次写回成功。

## 错误处理

### 本体对象不存在

HTTP 404，常见信息：

```text
Ontology object not found
```

停止执行并提示检查项目中是否存在“销售明细”和“库存快照”对象。

### 数据映射未配置

HTTP 409，常见信息：

```text
Dataset mapping is not configured
Required property is not mapped
```

停止执行并提示到本体项目的数据映射页面补齐字段映射。

### 写回未经审批

HTTP 409：

```text
Inventory writeback requires approved status
```

不得自动改成已批准。重新进入人工审批步骤。

### 库存不足

HTTP 409：

```text
Insufficient inventory
```

停止当前写回，不得把调出数量改小后自动重试。向用户展示对应门店和 SKU，等待人工调整方案。

### 参数不合法

HTTP 422：

检查：

- 日期格式；
- `direction`；
- 数量是否为正整数；
- 必填 ID 是否为空；
- `items` 是否为空。

修正确定性的格式错误后可以重试；不得修改业务方向或业务数量来绕过校验。

### 返回被截断

如果任一计算接口返回 `truncated=true`：

1. 不得使用不完整结果写回；
2. 增大 `limit` 后从第 1 步重新执行；
3. 若数据量超过 100000，应按门店拆分执行，并为每批生成独立 `request_id`。

## 审批恢复所需上下文

宿主系统必须至少保存以下内容，才能在人工批准后安全继续：

```json
{
  "request_id": "本轮请求 ID",
  "project_id": "本体项目 ID",
  "store_ids": [],
  "as_of_date": "2026-09-16",
  "writeback_items": [],
  "approval_required": true,
  "plan_summary": {},
  "approval_reasons": []
}
```

若宿主无法保存这些上下文，审批后应从第 1 步重新计算、重新展示方案并重新审批，而不是直接写回旧的自然语言描述。

## 禁止事项

- 不得在人工批准前调用库存写回。
- 不得将 Codex 的命令执行审批等同于业务调补货审批。
- 不得把 `undetermined` 自动改成 `inbound` 或 `outbound`。
- 不得为 `outbound` 猜测数量。
- 不得使用不同项目的数据混合计算。
- 不得为绕过阈值而拆分同一门店的审批批次。
- 不得在重试时生成新的 `request_id`，否则会破坏幂等保护。
- 不得声称库存已修改，除非写回接口明确返回完成状态。

## 快速调用清单

```text
1. POST /sales-14d
2. POST /inventory-snapshot
3. POST /weeks-of-supply       <- sales_items + inventory_items
4. POST /transfer-decision     <- weeks-of-supply.items
5. POST /transfer-quantity     <- transfer-decision.items
6. 生成 writeback_items
7. 若需审批：展示方案并暂停
8. 批准后或无需审批：POST /inventory-writeback
9. 返回 applied / already_applied 和库存前后值
```
