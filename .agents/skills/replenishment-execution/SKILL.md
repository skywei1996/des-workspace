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

- 帮我开始调补货
- 执行补货
- 看看哪些门店需要调货
- 根据最近销售和库存做调拨
- 继续执行刚才的调补货方案
- 我批准这个调补货方案

仅咨询补货规则、解释库存概念但不要求计算或执行时，不要写回库存。

## 接口基础信息

默认服务地址：http://localhost:8000

所有业务接口前缀：/api/replenishment/functions

默认本体项目：0b1a25a9-f6b7-4f38-8007-38d4182e3e4a

若宿主已为数字员工绑定其他本体项目，应优先使用绑定的 project_id。不要根据用户自然语言自行编造项目 ID。

公共请求字段包含 project_id、store_ids、as_of_date、limit。

字段说明：
- project_id：调补货本体项目 ID。
- store_ids：空数组代表全部门店；用户指定门店时只传指定门店。
- as_of_date：统计截止日期，格式必须为 YYYY-MM-DD；未指定时可省略。
- limit：单次返回条数，范围为 1 至 100000。

## 执行原则

1. 严格按本 Skill 的调用顺序执行，不跳过销售、库存或审批判断。
2. 同一轮执行中的所有接口必须使用相同的 project_id、store_ids 和 as_of_date。
3. 每次执行先生成唯一 request_id，直到写回完成都保持不变。
4. 不得凭空生成门店、SKU、库存、销量、方向或数量。
5. 任何 approval_required=true 的条目都会使整批写回进入人工审批。
6. 在人工明确批准前，禁止调用库存写回接口。
7. 用户拒绝、取消或未明确表态时，停止执行且不写回。
8. 接口报错时停止后续调用，向用户说明失败阶段和可操作原因。
9. 重试库存写回时必须复用原 request_id，利用服务端幂等能力避免重复调整。
10. 不要把读取数据、计算建议描述成已经完成库存调整；只有写回接口返回 status=completed 才算执行完成。

## 标准流程

### 第 0 步：确定执行上下文

从用户请求或宿主配置中确定 project_id、store_ids、as_of_date、request_id、initiated_by。

推荐 request_id 格式：replenishment-{yyyyMMddHHmmss}-{random}

若用户没有指定门店，使用全部门店，不必在调用前追问。

### 第 1 步：读取近 14 天销售数据

POST /api/replenishment/functions/sales-14d

请求体包含 project_id、store_ids、as_of_date、limit。保留响应中的完整 items，下一步以 sales_items 传递。

关键返回字段：sales_14d、sales_7d、average_weekly_sales、store_id、sku_id。

### 第 2 步：读取库存快照

POST /api/replenishment/functions/inventory-snapshot

请求体与第 1 步相同。保留响应中的完整 items，下一步以 inventory_items 传递。

关键返回字段：qty_on_hand、qty_available、qty_locked、qty_in_transit、adjustment_quantity、store_id、sku_id。

### 第 3 步：计算可销售周数

POST /api/replenishment/functions/weeks-of-supply

请求体包含 project_id、store_ids、as_of_date、limit、sales_items、inventory_items。
- sales_items 必须使用第 1 步返回的 items
- inventory_items 必须使用第 2 步返回的 items
不要只传摘要。

### 第 4 步：生成调拨决策

POST /api/replenishment/functions/transfer-decision

请求体包含 project_id、store_ids、as_of_date、limit、items（使用第 3 步返回的 items）。

当前系统决策规则：
- inbound：近 7 天有销量，且 weeks_of_supply < 1
- outbound：近 14 天无销量，且可销售周数为空或大于 2
- undetermined：不满足自动调入或自动调出规则

不得修改接口返回的 decision 和 decision_reason。

### 第 5 步：计算调货数量和审批标记

POST /api/replenishment/functions/transfer-quantity

请求体包含 project_id、store_ids、as_of_date、limit、items（使用第 4 步返回的 items）。

当前数量规则：
- 目标可销售周数为 1.2
- 自动调入需求量为 ceil(1.2 * average_weekly_sales - available_inventory)，最低为 0
- 单个 SKU 的 inbound_quantity 当前最多为 2
- decision=undetermined 时需要审批
- 单店总调入数量大于 50 时需要审批

重要限制：当前接口只计算 inbound_quantity，没有计算自动调出数量。因此：
- 可以自动形成 inbound 写回项
- 不得把 required_quantity_to_target 当作调出数量
- 不得为 outbound 项猜测数量
- 只有其他可信业务模块或人工明确提供正数 quantity 时，才能形成 outbound 写回项

### 第 6 步：形成待执行方案

从第 5 步结果生成待执行项。

自动调入项转换规则：store_id、sku_id、direction=inbound、quantity=inbound_quantity

仅包含满足以下全部条件的条目：
- decision == inbound
- inbound_quantity > 0

可信来源提供的调出项格式：store_id、sku_id、direction=outbound、quantity=正数

如果最终没有任何带正数数量的待执行项，直接向用户返回计算完成但没有可写回的调补货项，不要调用写回接口。

### 第 7 步：判断是否需要人工审批

满足任一条件时，整批方案进入人工审批：
- 第 5 步任一条目 approval_required == true
- 第 5 步摘要 approval_required_count > 0
- 方案包含人工提供的调出数量
- 宿主系统配置了更严格的审批规则

需要审批时展示：status=approval_required、request_id、project_id、summary（total_items、total_inbound_quantity、total_outbound_quantity、approval_required_count）、reasons、writeback_items。

审批展示至少包含：门店 ID、SKU ID、调入或调出方向、数量、当前可用库存、近 7 天和近 14 天销量、可销售周数、决策原因、需要审批的原因。

此时立即暂停，不得调用 /inventory-writeback。

### 第 8 步：处理人工决定

只有以下明确表达可视为批准：批准、审批通过、确认执行这个方案、宿主审批控件返回结构化 approved=true。

以下情况不算批准：看看吧、应该可以、继续分析、没有回复、仅修改了某个条目。

如果用户修改了门店、SKU、方向或数量，应把修改后的方案视为新版本，重新展示并再次请求批准。

拒绝时返回 status=rejected、request_id、message=用户已拒绝调补货方案，库存未发生变化。

### 第 9 步：库存写回

无需审批或人工审批通过后，调用 POST /api/replenishment/functions/inventory-writeback。

写回前必须检查：
- 每条都有非空 store_id 和 sku_id
- direction 只能为 inbound 或 outbound
- quantity 必须为正整数
- 需要审批时 approval_status 必须为 approved
- 需要审批时 approved_by 必须来自真实审批人
- 必须使用第 0 步生成的原 request_id

### 第 10 步：返回最终结果

成功示例：调补货已执行完成。包含本体项目、调整条目、首次写回、重复项、请求编号。

status=applied 表示本次已写回，status=already_applied 表示已处理不能再次调整。qty_available_before 和 qty_available_after 用于展示库存变化。

如果全部为 already_applied，应告诉用户该请求此前已经执行。

## 错误处理

### 本体对象不存在
HTTP 404，停止执行并提示检查项目中是否存在销售明细和库存快照对象。

### 数据映射未配置
HTTP 409，停止执行并提示到本体项目的数据映射页面补齐字段映射。

### 写回未经审批
HTTP 409，不得自动改成已批准。重新进入人工审批步骤。

### 库存不足
HTTP 409，停止当前写回，不得把调出数量改小后自动重试。向用户展示对应门店和 SKU，等待人工调整方案。

### 参数不合法
HTTP 422，检查日期格式、direction、数量是否为正整数、必填 ID 是否为空、items 是否为空。修正确定性的格式错误后可以重试；不得修改业务方向或业务数量来绕过校验。

### 返回被截断
如果任一计算接口返回 truncated=true：不得使用不完整结果写回；增大 limit 后从第 1 步重新执行；若数据量超过 100000，应按门店拆分执行并为每批生成独立 request_id。

## 审批恢复所需上下文

宿主系统必须至少保存以下内容才能在人工批准后安全继续：request_id、project_id、store_ids、as_of_date、writeback_items、approval_required、plan_summary、approval_reasons。

若宿主无法保存这些上下文，审批后应从第 1 步重新计算、重新展示方案并重新审批，而不是直接写回旧的自然语言描述。

## 禁止事项

- 不得在人工批准前调用库存写回。
- 不得将 Codex 的命令执行审批等同于业务调补货审批。
- 不得把 undetermined 自动改成 inbound 或 outbound。
- 不得为 outbound 猜测数量。
- 不得使用不同项目的数据混合计算。
- 不得为绕过阈值而拆分同一门店的审批批次。
- 不得在重试时生成新的 request_id，否则会破坏幂等保护。
- 不得声称库存已修改，除非写回接口明确返回完成状态。

## 快速调用清单

1. POST /sales-14d
2. POST /inventory-snapshot
3. POST /weeks-of-supply       <- sales_items + inventory_items
4. POST /transfer-decision     <- weeks-of-supply.items
5. POST /transfer-quantity     <- transfer-decision.items
6. 生成 writeback_items
7. 若需审批：展示方案并暂停
8. 批准后或无需审批：POST /inventory-writeback
9. 返回 applied / already_applied 和库存前后值