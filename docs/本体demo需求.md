金盘科技

主计划编制场景
本体对象设计方案

基于本体论的主生产计划智能编制与动态调整

文档版本：V1.0
编制日期：2026 年
适用范围：金盘科技事业部主计划编制系统开发

目录
第一章  设计理念与核心原则
第二章  本体对象建模设计
第三章  语义对齐与同义词映射机制
第四章  Harness 运行时事务与人工在环机制
第五章  多层验证体系设计
第六章  推理场景一：计划编制与下发
第七章  推理场景二：需求变更导致计划变更
第八章  推理场景三：产线设备故障导致计划变更

第一章  设计理念与核心原则
1.1 总体架构哲学
本方案严格遵循"动静结合"的本体论落地方法论，核心架构哲学为：
• 本体是"模具+规章"（模式层/TBox），定义业务世界的类、属性、关系、约束、规则
• 运行时是"施工队"（Harness），负责将本体规则套用到具体业务数据上
• 求解器是"计算器"（CP-SAT/MILP），负责数学上严格正确的排产求解
• 大模型是"翻译器+解释器"（DeepSeek V4），负责非结构化信息抽取与自然语言交互
• 规则引擎是"合规守门员"，负责硬性业务规则的独立校验
• 人工在环是"最终决策者"，负责高风险动作的业务判断

核心原则：排产主引擎 = 求解器（数学严格），不是大模型（概率生成）。DeepSeek V4 仅在输入抽取和输出解释环节受控使用，所有 LLM 输出必须经过规则引擎校验 + 人工审核双重把关。
1.2 技术选型决策
各技术组件在排产流程中的定位与职责：
环节	选型	职责	是否使用LLM
非结构化信息抽取	DeepSeek V4	邮件/备注→结构化约束	是（受控）
自然语言交互	DeepSeek V4	用户指令→结构化请求	是（受控）
排产求解（核心）	CP-SAT / MILP	多目标约束优化	否
影响评估计算	规则引擎+本体推理	约束传播、容量计算	否
硬约束校验	Drools规则引擎	工艺/制度合规检查	否
方案解释生成	DeepSeek V4	变量赋值→自然语言	是（受控+审核）
策略建议生成	DeepSeek V4 + 求解器	无可行解时的选项	是（受控+审核）
事务编排执行	Harness 运行时	原子性、补偿、回滚	否
1.3 排产引擎的技术选型依据
排产本质是带约束的多目标组合优化问题（NP-hard），对求解工具有严格要求：
维度	求解器（CP-SAT/MILP）	大模型（DeepSeek V4）
数学正确性	严格满足约束，可证明最优性	概率性输出，可能违反硬约束
可复算性	同输入必得同输出	同输入可能不同输出
约束保证	硬约束绝不违反	幻觉可能导致"订单排在已占用产线"
计算效率	针对优化高度优化，秒~分钟级	生成式推理慢，token消耗巨大
规模扩展	万级订单可解	上下文受限，千级即撑爆
可解释性	完整变量赋值，可追溯数学依据	自然语言解释，但解释本身需校验

技术说明：本方案排产主引擎采用 Google OR-Tools CP-SAT 约束求解器，数学上严格保证约束满足和最优性。DeepSeek V4 承担非结构化信息抽取（输入侧）和方案自然语言解释生成（输出侧）两项辅助职能，不参与排产核心计算。所有 DeepSeek V4 输出均经过规则引擎校验和人工审核双重验证。


第二章  本体对象建模设计
2.1 本体类总览
本体类	说明	父类
SalesOrder	销售订单（已签约）	Order
Product	产品（成品/半成品）	Item
ProductionLine	产线（干变/油变/成套）	Resource
Equipment	关键设备（绕线机/试验台）	Resource
Material	关键物料（硅钢片/铜线）	Item
Personnel	人员（技能/排班/加班）	Resource
Calendar	生产日历（工作日/加班/节假日）	Schedule
CapacityLoad	产能负荷快照	Analysis
BottleneckWarning	瓶颈预警记录	Alert
MasterProductionSchedule	主生产计划（MPS）	Plan
ScheduleItem	计划项（订单×产线×时间段）	PlanElement
ChangeEvent	变更事件（交期变更/插单/故障/缺料）	Event
CoordinationTask	跨事业部协同任务	Task
TransactionContext	运行时事务上下文	SystemObject
ApprovalGate	人工审批门禁	SystemObject
2.2 各本体类详细建模
2.2.1 SalesOrder（销售订单）
维度	内容
属性	orderId, customer, productList[], quantity, deliveryDate, priority(urgent/high/normal/low), status(signed/in_production/delivered), projectCode, contractPenalty(float)
方法	calcPriorityWeight() 根据客户等级+交期紧迫度计算权重; isAlreadyStarted() 判断是否已开工（冻结不可调）
动作	adjustDeliveryDate(newDate) 调整交期，触发变更评估; splitOrder(config) 拆分订单（分批生产）
约束	deliveryDate >= today + leadTime; priority ∈ {urgent,high,normal,low}; status=in_production 时禁止自动调整
权限	计划员：读写; 销售：只读; 系统：自动更新status
2.2.2 Product（产品）
维度	内容
属性	productId, name, type, bomVersion, standardCycleTime, requiredMaterials[], requiredEquipment[], requiredSkill[], routingSteps[]
方法	estimateLeadTime(capacityContext) 根据当前产能估算实际提前期; getRouting() 返回工艺路线
动作	updateBOM(newVersion) 更新BOM，触发物料需求重算
约束	standardCycleTime > 0; requiredMaterials 非空; routingSteps 必须包含至少一道工序
权限	工艺工程师：读写; 计划员：只读
2.2.3 ProductionLine（产线）
维度	内容
属性	lineId, name, department(事业部), capacityPerDay, status(running/idle/maintenance), availableCalendars[], assignedOrders[], supportedProductTypes[]
方法	calcLoad(startDate, endDate) 计算时段负荷率; hasCapability(productType) 判断能否生产某产品
动作	assignOrder(order, timeSlot) 分配订单到时间段; releaseOrder(orderId) 释放产能占用; setMaintenanceWindow(window) 设置检修窗口; lockCapacity(reason) 锁定产能（故障/检修）
约束	loadRate <= 1.0（除非加班）; 同类型产线才能互相转移订单; maintenance 状态下 capacityPerDay = 0
权限	计划员：读写; MES：只读状态; 系统：自动更新负荷
2.2.4 Equipment（设备）
维度	内容
属性	equipmentId, type, status(normal/fault/maintenance), lastMaintenanceDate, faultHistory[], mttr(平均修复时间), 所属产线lineId
方法	checkHealth() 自检返回状态; estimateRepairTime() 预估修复时间
动作	reportFault(description) 上报故障→锁定产能→创建ChangeEvent; scheduleRepair(team, eta) 安排维修; confirmRepaired() 确认修复→解锁产能
约束	status=fault 时关联产线 capacityPerDay 降为0; 维修中不得分配新订单
权限	MES：读写状态; 计划员：只读; 维修班组：更新维修记录
2.2.5 Material（物料）
维度	内容
属性	materialId, name, supplier, leadTime, stockLevel, safetyStock, arrivalSchedule[], allocatedToOrders[]
方法	isAvailable(quantity, date) 检查指定日期库存是否充足; calcShortageDate(requiredQty) 计算缺料到货日期
动作	updateArrivalDate(newDate) 更新到货日期→触发缺料评估; allocate(orderId, qty) 分配物料给订单
约束	stockLevel >= safetyStock（否则触发预警）; allocatedToOrders 总量 <= stockLevel + 在途量
权限	SRM/采购：读写; 计划员：只读; 缺料监控数字员工：读写
2.2.6 Personnel（人员）
维度	内容
属性	employeeId, name, skills[], shiftPattern, maxOvertimeHours, availableHoursThisWeek
方法	calcAvailableHours(dateRange) 计算可用工时; hasSkill(skillType) 判断技能匹配
动作	assignOvertime(hours) 安排加班（需审批）; assignShift(schedule) 排班
约束	overtime <= maxOvertimeHours; 技能不匹配的工序不得分配
权限	HR：读写; 计划员：读+排班; 员工：查看自己的排班
2.2.7 Calendar（生产日历）
维度	内容
属性	calendarId, type(工作日/节假日/加班日), dateRange, workingHoursPerDay, applicableDepartment[]
动作	addSpecialWorkday(date) 增加加班日（需审批）; removeWorkday(date) 取消工作日
约束	无重叠日期区间; 加班日需关联具体产线/人员
权限	计划员：申请; 事业部总监：审批
2.2.8 MasterProductionSchedule（主生产计划）
维度	内容
属性	scheduleId, version, effectiveDate, status(draft/confirmed/released), items[ScheduleItem], metrics{deliveryRate, balanceScore, cost}
方法	solveOptimization(constraints, objectives) 调用CP-SAT求解器; compareAlternatives(plans[]) 多方案KPI对比; impactAnalysis(changeEvent) 变更影响评估
动作	confirmPlan() 确认计划（需审批）; releaseToShopFloor(txContext) 事务化下发SAP/MES; rollAdjust(changeEvent, txContext) 滚动调整; saveDraft() 保存草稿
约束	所有ScheduleItem时间必须在日历范围内; 同一产线同一时刻只能一个订单; 已开工订单(status=in_production)禁止自动调整
权限	计划员：编制+确认; 计划科长：审批下发; 事业部总监：审批重大变更
2.2.9 ScheduleItem（计划项）
维度	内容
属性	itemId, orderId, productId, lineId, startTime, endTime, batchSize, sequence, status(planned/started/completed)
方法	calcDuration() 计算工期; checkMaterialReady() 检查物料齐套
动作	reschedule(newStart, newEnd) 重排时间; transferToLine(newLineId) 转移产线
约束	endTime >= startTime; sequence 在同日产线内唯一; status=started 后禁止自动修改时间
权限	计划员：读写; MES：更新status
2.2.10 ChangeEvent（变更事件）
维度	内容
属性	eventId, type(customerChange/insertion/materialShortage/equipmentFault), description, affectedOrders[], severity(high/medium/low), proposedAction, detectedAt
方法	impactAnalysis(currentPlan) 遍历受影响ScheduleItem，计算延迟/连锁影响; classifySeverity() 根据影响范围自动定级
动作	triggerRollingAdjustment(txContext) 触发滚动调整流程; escalateToDirector() 升级到事业部总监
约束	至少影响一个订单; severity=high 时必须人工审批
权限	系统自动创建; 计划员：读写; 科长/总监：审批
2.2.11 CoordinationTask（跨事业部协同任务）
维度	内容
属性	taskId, projectCode, departments[], dependencyEdges[], conflictPoints[], status(pending/synced)
方法	resolveConflict(solution) 应用解决方案; checkDependencySatisfied() 检查跨部依赖是否满足
动作	syncScheduleWithDept(deptPlan) 与另一事业部同步; proposeCrossDeptSolution() 提出协同方案
约束	同一项目跨事业部订单必须满足前后工序依赖; 成套配套订单的交付节点必须同步
权限	各事业部计划员：读写; 项目经理：协调
2.2.12 TransactionContext（事务上下文）
维度	内容
属性	txId, status(active/committed/rolledback), compensationStack[], lockedResources[], createdAt
方法	begin() 开启事务; commit() 提交（释放锁+持久化）; rollback() 回滚（逆序执行补偿栈）
动作	pushCompensation(action) 压入补偿动作; acquireLock(resource) 获取分布式锁; releaseAllLocks() 释放所有锁
约束	同一资源只能被一个活跃事务锁定; 超时自动回滚
权限	Harness 系统内部使用
2.2.13 ApprovalGate（审批门禁）
维度	内容
属性	gateId, approvalStatus(pending/approved/rejected), reviewerRole, deadline, attachedContext{}
方法	evaluate() 检查审批条件是否满足; notifyReviewer() 发送审批通知
动作	approve(reviewer, comment) 审批通过; reject(reviewer, reason) 审批拒绝→触发回滚
约束	deadline 超时自动 escalate; 不同动作需不同角色审批
权限	按 reviewerRole 控制


第三章  语义对齐与同义词映射机制
3.1 为什么需要语义对齐
在金盘科技主计划场景中，同一业务概念在不同系统中往往有不同的名称。这是制造企业信息化建设的普遍现象——各系统在不同时期建设、由不同供应商实施，导致"同物异名"问题突出。
业务概念	SAP中的名称	MES中的名称	ERP中的名称	客服系统中的名称
客户	KUNNR（客户编号）	CUSTOMER_ID	BusinessPartner	Account
订单	AUFNR（订单号）	WO_NUMBER	SalesOrder	Ticket
产线	ARBPL（工作中心）	LINE_ID	Resource	---
物料	MATNR（物料号）	MATERIAL_CODE	Item	Part
交期	VDATU（交货日期）	DUE_DATE	DeliveryDate	Promise Date
优先级	PRIORITY（1-9）	RANK	UrgencyLevel	Severity
如果不做语义对齐，系统会出现同一客户在 SAP 叫 KUNNR、在 ERP 叫 BusinessPartner、在客服系统叫 Account 的混乱，导致：
• 同一客户被识别为三个不同实体 → 计划编制时遗漏关联订单
• 物料名称不一致 → BOM 展开失败 → 物料齐套检查错误
• 产线命名不统一 → 跨系统产能查询返回空 → 排产失败
3.2 语义对齐的分层机制
语义对齐采用"模式层声明 + 运行时解析"两层协作机制：
3.2.1 模式层（TBox）：受控同义关系声明
OWL 构造	用途	示例
owl:equivalentClass	类等价声明	:CRM客户 owl:equivalentClass :ERP客户
owl:equivalentProperty	属性等价声明	:SAP_MATNR owl:equivalentProperty :MES_MATERIAL_CODE
rdfs:label (多语言)	多标签	:客户 rdfs:label "客户"@zh, "Customer"@en, "KUNNR"@sap
skos:altLabel	受控同义词	:产线 skos:altLabel "工作中心", "ARBPL", "LINE"
owl:sameAs	实例级等价	:客户张三 owl:sameAs :KUNNR-00123
3.2.2 运行时层：动态语义解析与实体消歧
对于大规模、跨源、模糊的同义关系，必须在运行时通过专门机制处理：
机制	触发时机	算法/方法	输出
候选对生成(Blocking)	数据接入时	哈希分块（按名称首字母/拼音）	可能匹配的实体对集合
字符串相似度计算	候选对生成后	Levenshtein/Jaro-Winkler/Soundex	每对的相似度得分(0-1)
上下文特征匹配	相似度>阈值时	NLP嵌入+属性交叉验证	增强的匹配置信度
DeepSeek V4 语义抽取	非结构化文本接入时	DeepSeek V4 + 结构化输出约束	标准化实体+属性JSON
ML粗筛+人工审核	置信度中等时	分类模型+人工确认界面	确认的实体映射关系
实体合并(Merge)	审核通过后	Golden Record合并策略	统一的本体实例
3.2.3 语义对齐的完整数据流
以"客户名称统一"为例，完整流程如下：
1. SAP 推送：KUNNR=00123, NAME="金盘电气科技有限公司"
2. CRM 推送：AccountID=AC-456, Company="金盘电气"
3. MES 推送：CUSTOMER="金盘电气科技股份公司"
4. Blocking：三者的名称首字母都是"J" → 进入同一候选集
5. 字符串相似度："金盘电气科技有限公司" vs "金盘电气" → 0.82；vs "金盘电气科技股份公司" → 0.71
6. 上下文验证：三者的产品类型重叠度 90% → 增强置信度
7. DeepSeek V4 语义判断："三者指向同一法人实体的概率：94%"
8. ML 置信度 = 0.93 > 阈值 0.90 → 自动合并
9. 人工审核（低优先级抽查）：确认合并 → 生成 Golden Record
10. 实例化：:统一客户_001 rdf:type :客户; :sapId "00123"; :crmId "AC-456"; :mesId "金盘电气"

关键点：步骤1-7是运行时自动执行的，步骤8-9是人工在环。合并后的 Golden Record 作为统一本体实例存入图数据库，后续所有排产计算都基于这个统一实体。
3.3 语义映射与本体对象的关系
语义对齐的结果最终体现为本体实例的属性填充：
源系统字段	语义映射目标（本体属性）	映射方式
SAP.KUNNR	:客户.sapId	owl:equivalentProperty（模式层声明）
SAP.MATNR	:物料.sapMaterialId	owl:equivalentProperty
SAP.VDATU	:SalesOrder.deliveryDate	ETL管道映射
MES.LINE_ID	:ProductionLine.mesLineId	owl:sameAs
MES.DUE_DATE	:ScheduleItem.endTime	运行时时间格式转换
CRM.Account.Name	:客户.crmName	DeepSeek V4 抽取+实体消歧
SRM.ETA	:Material.arrivalSchedule	ETL管道+时间解析
邮件正文"尽量提前"	:SalesOrder.priority=urgent	DeepSeek V4 语义抽取→约束
3.4 语义对齐失败的处理策略
• 高置信度(>0.9)：自动合并，异步人工抽查
• 中等置信度(0.7-0.9)：进入人工审核队列，计划员确认后合并
• 低置信度(<0.7)：保持分离，标记为"待确认"，不阻塞排产
• 冲突检测：发现"同一订单号对应不同客户"时，立即告警并暂停相关排产


第四章  Harness 运行时事务与人工在环机制
4.1 Harness 核心职责
Harness 是本体驱动架构的"事务管理器 + 工作流引擎 + 安全监理"，负责：
• 创建和管理 TransactionContext（事务上下文）
• 编排本体对象动作的调用顺序
• 维护补偿栈（Compensation Stack），支持回滚
• 管理分布式锁，防止并发冲突
• 在关键决策点插入 ApprovalGate（人工审批门禁）
• 调度求解器、规则引擎、DeepSeek V4 等外部组件的调用
• 记录完整的审计日志（Audit Trail）
4.2 事务执行模型
以 MasterProductionSchedule.releaseToShopFloor() 为例，完整的事务执行流程：
步骤	动作	事务操作	失败处理
①	开启事务	acquireLock(planId); 创建txContext	锁冲突→排队重试
②	锁定计划版本	plan.status=draft_locked	已锁定→抛异常→回滚
③	审批门禁	ApprovalGate等待科长审批	拒绝→补偿解锁→事务结束
④	压入补偿栈	pushCompensation(unlockPlan)	---
⑤	写入SAP	syncToSAP(plan) 同步调用	失败→执行补偿栈→回滚
⑥	压入补偿栈	pushCompensation(undoSAPWrite)	---
⑦	下发MES	dispatchToMES(plan) 同步调用	失败→执行补偿栈→回滚
⑧	压入补偿栈	pushCompensation(undoMESDispatch)	---
⑨	发送通知	notifyStakeholders(plan) 异步	失败→记录日志→不回滚
⑩	提交事务	commit(); releaseAllLocks()	---

关键设计：步骤⑤⑦是同步调用，失败则触发补偿栈逆序执行（先撤销MES→再撤销SAP→最后解锁），保证数据最终一致性。步骤⑨是异步的，失败不影响主事务。
4.3 补偿栈机制详解
每个可回滚动作在执行前，将其补偿操作压入栈中。若后续失败，Harness 逆序弹出并执行：
执行顺序（正向）：
lockPlan → writeSAP → dispatchMES → notify
补偿顺序（逆向）：
undoNotify(忽略) → undoMESDispatch → undoSAPWrite → unlockPlan

正向动作	补偿动作	执行方式
lockPlan	unlockPlan	Redis DEL lock_key
writeSAP(plan)	undoSAPWrite(planId)	调用SAP删除接口
dispatchMES(plan)	undoMESDispatch(planId)	调用MES取消接口
assignOvertime(person)	cancelOvertime(person)	恢复原始排班
addSpecialWorkday(date)	removeWorkday(date)	恢复日历
allocateMaterial(mat, qty)	deallocateMaterial(mat, qty)	释放物料占用
4.4 人工在环门禁设计
不同风险等级的动作需要不同级别的人工审批：
动作类型	风险等级	审批人	超时策略	示例
保存草稿	低	无需审批	---	plan.saveDraft()
确认计划	中	计划科长	2小时→提醒	plan.confirmPlan()
计划下发	高	计划科长+事业部总监	4小时→升级	plan.releaseToShopFloor()
局部重排	中	计划科长	2小时→提醒	plan.rollAdjust(局部)
整体重排	高	计划科长+事业部总监	4小时→升级	plan.rollAdjust(整体)
加班排班	中	计划科长	2小时→提醒	personnel.assignOvertime()
跨事业部协同	高	双事业部总监会签	8小时→升级CEO	coord.syncScheduleWithDept()
设备故障锁定	紧急	无需审批（自动）	---	equipment.reportFault()
4.5 分布式锁机制
• 计划级锁：planId 为粒度，编制/修改/下发时加锁
• 产线级锁：lineId 为粒度，产能分配/释放时加锁
• 订单级锁：orderId 为粒度，调整/拆分时加锁
• 锁超时：默认 30 分钟，超时自动释放（防止死锁）
• 锁等待：冲突时进入队列，最多等待 5 分钟，超时返回"系统繁忙"


第五章  多层验证体系设计
5.1 验证体系总览
验证体系分为四层，各层解决不同类型的问题，相互补充：
层级	名称	验证什么	方式	何时执行
第一层	形式化推理校验	语义逻辑一致性	本体推理机(HermiT)	每次推理前后自动
第二层	独立求解器复算	数学最优性/可行性	CP-SAT vs MILP交叉验证	方案生成后自动
第三层	规则引擎硬约束	业务合规性	Drools规则引擎	方案确认前强制
第四层	人工在环审批	业务合理性	审批门禁	高风险动作前必须

设计说明：本方案不依赖"双模型裁判"作为独立验证层。DeepSeek V4 在输入抽取和输出解释环节受控使用，其输出通过"规则引擎校验 + 人工审核"双重把关。这样既保证了验证的严谨性，又避免了双模型裁判带来的高成本、高延迟和裁判模型自身可能出错的问题。
5.2 第一层：形式化推理校验
由本体推理机（如 HermiT、Pellet）执行，确保 TBox/ABox 的逻辑一致性：
• 本体一致性检测：检查 TBox 公理是否无矛盾
• 概念可满足性：检查某个类是否可能存在实例
• 实例分类校验：验证具体实例是否正确归类
• ABox 一致性：检查实例化数据是否与 TBox 约束冲突
• 约束传播：自动推导隐含事实（如"张三年消费15万 → VIP客户"）

这一层验证的是"语义逻辑正确性"，不是"业务最优性"。例如：推理机能发现"订单A既被标记为urgent又被标记为已取消"的逻辑矛盾，但不会判断"订单A的交期是否合理"。
5.3 第二层：独立求解器复算
这是制造业排产场景最核心的验证层。将同样的约束条件和目标函数，输入到不同的求解器（或同一求解器的不同配置）重新求解，对比结果：
主求解器	验证求解器	对比维度	差异阈值	触发动作
OR-Tools CP-SAT	Gurobi MILP	KPI对比（交付率/均衡度/成本）	>5%	触发人工审核
OR-Tools CP-SAT	CP-SAT(不同随机种子)	方案一致性	任一订单时间差异>1天	标记为"不稳定解"
CP-SAT(主配置)	启发式算法(快速)	可行性验证	启发式不可行	信任CP-SAT结果
验证流程：
1. 主求解器（CP-SAT）生成方案 A → 计算 KPI_A
2. 验证求解器（MILP）独立生成方案 B → 计算 KPI_B
3. 对比 KPI_A 与 KPI_B 的差异
4. 差异 > 阈值 → 标记为"需人工审核" → 进入审批门禁
5. 差异 ≤ 阈值 → 自动通过 → 进入下一验证层
5.4 第三层：规则引擎硬约束校验
独立部署规则引擎（如 Drools），封装企业不可违反的硬性业务规则：
规则编号	规则内容	违反后果
R001	已开工订单(status=started)不得自动调整时间	拦截+告警
R002	同一产线同一时刻只能排一个订单	拦截+提示冲突
R003	关键物料未齐套的订单不得排产	拦截+标记缺料
R004	VIP客户订单优先级必须≥high	自动修正+记录
R005	成套项目跨事业部订单必须满足前后工序依赖	拦截+提示依赖
R006	设备status=fault时不得分配新订单	拦截+提示故障
R007	加班工时不得超过人员maxOvertimeHours	拦截+提示超限
R008	计划下发前必须所有物料齐套检查通过	拦截+提示未齐套
R009	DeepSeek V4 抽取的结构化输出必须通过格式校验	拦截+退回重抽
R010	DeepSeek V4 生成的方案解释不得包含本体中不存在的实体	拦截+重写

规则引擎是"业务合规守门员"——确定性、可解释、可审计。它与求解器是互补关系：求解器保证"数学最优"，规则引擎保证"业务合规"。求解器输出的方案必须通过规则引擎的全部校验才能进入下一步。同时，规则引擎也承担了对 DeepSeek V4 输出的校验职责（R009/R010），确保大模型生成的内容不偏离本体事实。
5.5 第四层：人工在环审批
最高级别验证，不可替代的最终防线：
• 事前闸门：高风险动作（计划下发、整体重排、跨事业部协同）必须人工审批
• 事中闸门：DeepSeek V4 置信度低于阈值时自动暂停，等待人工介入
• 事后闸门：所有自动执行的操作打标，运营经理可抽样 100% 复核
• 审批界面展示：完整方案对比 + KPI 仪表盘 + 影响分析 + 风险提示

人工在环不是"弱 AI 的标志"，而是"成熟工程实践的标志"。制造业计划变更直接影响客户交付和合同履约，高风险决策的人的参与是法律和商业的双重刚需。DeepSeek V4 生成的方案解释和策略建议，在提交人工审批时一并展示，由审批人最终判断其合理性。
5.6 四层验证的关系总结
验证层	保证什么	不保证什么	执行者
①形式化推理	语义逻辑无矛盾	业务最优性	HermiT推理机
②求解器复算	数学最优/可行	业务合规	CP-SAT vs MILP
③规则引擎	业务合规	语义一致性	Drools
④人工审批	业务合理性	数学证明	计划科长/总监
Harness事务	过程可控可回滚	结果正确性	运行时引擎

五者关系：形式化校验保证"语义对"，求解器复算保证"算得准"，规则引擎保证"合规"（同时校验DeepSeek V4输出），人工审批保证"决策对"，Harness事务保证"过程可控"。五层互补，构成企业级AI排产系统的完整安全网。


第六章  推理场景一：计划编制与下发
6.1 场景概述
触发条件：每月/每周固定时间，或计划员手动发起"编制主计划"。
业务目标：基于多源数据和多重约束，自动生成最优主生产计划（MPS），经审批后下发至 SAP 和 MES。
6.2 完整推理步骤
步骤① 语义对齐与数据汇聚
维度	内容
触发对象	TransactionContext.begin() 开启事务
语义对齐	DeepSeek V4 抽取非结构化信息（邮件/备注）→ 结构化约束; 多系统字段映射（SAP↔MES↔SRM）
数据查询	SAP: 已签约订单(订单号/客户/产品/数量/交期/优先级); MES: 产线状态/设备日历/在制品; SRM: 物料到货周期/库存; HR: 人员排班/技能
外部系统	SAP(读), MES(读), SRM(读), HR(读)
DeepSeek V4	是 —— 非结构化信息抽取（受控，输出经规则引擎R009/R010校验 + 人工审核）
事务操作	acquireLock(dataSync); 数据快照存入txContext
失败处理	任一接口超时→补偿:释放锁→事务回滚→通知计划员
验证层	①形式化校验: 汇聚数据是否符合本体约束
步骤② 物料齐套预校验
维度	内容
触发对象	Material.allocate(orderId, qty) 为每个订单预留物料
逻辑推理	遍历每个SalesOrder的Product.requiredMaterials[]; 检查Material.isAvailable(requiredQty, requiredDate); 标记缺料订单清单
外部系统	SRM(读库存/在途); SAP(读BOM)
DeepSeek V4	否
事务操作	压入补偿: deallocateMaterial（回滚时释放预留）
失败处理	缺料订单标记为"等待物料"→不纳入本次排产→通知采购
验证层	③规则引擎: R003(缺料不得排产); R008(下发前必须齐套)
步骤③ 构建求解模型（CP-SAT）
维度	内容
触发对象	MasterProductionSchedule.solveOptimization(constraints, objectives)
输入数据	订单集合(交期/优先级/数量/BOM); 资源集合(产线/设备/人员/日历); 约束集合(产能/工艺/物料/技能); 目标函数(交付率+均衡度+成本)
求解器调用	Google OR-Tools CP-SAT（主求解器）; 可选：Gurobi MILP（验证求解器）
DeepSeek V4	否 —— 纯数学优化
输出	变量赋值：每个订单的产线分配/开始时间/结束时间/批次大小/顺序
事务操作	求解结果存入txContext临时区（不持久化）
失败处理	求解器超时/无可行解→触发备选策略生成（见步骤③b）
验证层	②独立求解器复算: 主求解器 vs 验证求解器 KPI 对比
步骤③b 无可行解时的策略生成
当求解器报告"无可行解"时，系统自动尝试以下策略：
• 策略A：放松约束 —— 允许部分订单延迟（需人工审批）
• 策略B：启用加班 —— 调用 Calendar.addSpecialWorkday() + Personnel.assignOvertime()（需审批）
• 策略C：转移产线 —— 调用 ProductionLine.transferOrder()（需验证目标产线能力）
• 策略D：拆分订单 —— 调用 SalesOrder.splitOrder()（部分先产、部分后产）
每个策略由 DeepSeek V4 生成自然语言解释（受控，经规则引擎校验 + 人工审核）→ 人工选择
步骤④ 多方案对比与人工选择
维度	--
触发对象	MasterProductionSchedule.compareAlternatives(plans[])
计算内容	方案A/B/C的KPI: 交付达成率/产能均衡度/成本/加班时长/瓶颈数量
DeepSeek V4	是 —— 生成方案对比的自然语言摘要（受控，经规则引擎校验 + 人工审核）
事务操作	Harness挂起事务，等待人工输入（最长2小时）
人工在环	计划员选择方案或手动微调 → 确认后事务恢复
超时处理	2小时无操作→提醒; 4小时→事务自动回滚
验证层	①形式化校验: 选定方案是否仍满足本体约束
步骤⑤ 规则引擎硬约束校验
维度	内容
触发对象	Drools规则引擎（独立调用）
校验内容	R001-R010全部规则逐条检查（含DeepSeek V4输出校验R009/R010）
DeepSeek V4	否
通过	进入步骤⑥审批门禁
不通过	列出违反规则→返回步骤④重新调整→不执行后续步骤
验证层	③规则引擎（强制）
步骤⑥ 方案解释生成（DeepSeek V4，受控）
维度	内容
触发对象	DeepSeek V4 生成方案解释（为何如此排产）
输入	求解器输出(变量赋值) + 本体实例数据(订单/产线/物料属性)
输出	"订单A排第一因为客户是VIP且交期紧迫..."
DeepSeek V4	是 —— 主模型生成 → 规则引擎校验(R009/R010) → 人工审核
校验方式	规则引擎检查解释中引用的实体/属性是否存在于本体; 人工审核判断解释是否合理
验证层	③规则引擎 + ④人工审批
步骤⑦ 审批门禁
维度	内容
触发对象	ApprovalGate —— 计划科长审批
展示内容	方案对比仪表盘 + KPI + 影响分析 + 风险提示 + DeepSeek V4解释
审批通过	进入步骤⑧下发
审批拒绝	事务回滚（释放锁/撤销临时数据）→ 返回步骤③重新求解
超时	4小时→升级到事业部总监
验证层	④人工在环（必须）
步骤⑧ 事务化下发至SAP/MES
维度	内容
触发对象	MasterProductionSchedule.releaseToShopFloor(txContext)
子步骤	a.锁定计划版本→b.写SAP(订单生产节点)→c.下发MES(派工单)→d.通知相关方
外部系统	SAP(写), MES(写), 企微/邮件(通知)
DeepSeek V4	否
事务保障	每步前压入补偿栈; 任意同步步骤失败→逆序执行补偿→全部回滚
成功	commit(); 计划status=released; 版本号+1
验证层	①形式化校验: 下发后数据一致性
6.3 场景一步骤总览图
步骤	动作	语义解析	求解器	规则引擎	审批/事务
①数据汇聚	语义对齐+ETL	✓抽取+对齐			✓加锁
②物料齐套	预留物料			✓R003/R008	✓补偿
③求解	CP-SAT求解		✓主+验证		✓临时存储
③b无可行解	策略生成	✓解释	✓重算		
④方案对比	KPI对比				✓挂起+人工
⑤规则校验	硬约束检查			✓R001-R010	
⑥解释生成	自然语言	✓抽取		✓校验LLM	✓人工审核
⑦审批	科长审批				✓必须
⑧下发	SAP+MES写入				✓提交/回滚


第七章  推理场景二：需求变更导致计划变更
7.1 场景概述
触发条件：客户通过 CRM 发起交期变更请求（如"订单 SO-12345 能否提前到 6 月 15 日"）。
业务目标：评估变更对现有计划的影响，生成调整方案，经审批后更新计划并同步下游系统。
7.2 完整推理步骤
步骤① 变更事件录入与语义解析
维度	内容
触发对象	ChangeEvent 构造函数 —— type=customerChange
语义解析	CRM推送/邮件/电话记录 → DeepSeek V4 抽取: 订单号/新交期/变更原因/紧迫度
语义对齐	"提前交货"="交期提前"="advance delivery" → 统一映射为 :deliveryDate 变更
外部系统	CRM(读), 邮件服务器(读)
DeepSeek V4	是 —— 非结构化抽取（受控，输出经规则引擎R009校验 + 人工审核）
事务操作	TransactionContext.begin(); acquireLock(eventId)
校验	新交期 >= 最早可生产日期? 否则拒绝并通知销售
验证层	①形式化校验 + ③规则引擎(R009校验DeepSeek V4抽取)
步骤② 影响评估（本体推理 + 约束传播）
维度	内容
触发对象	ChangeEvent.impactAnalysis(currentPlan)
推理过程	1.定位受影响订单的ScheduleItem; 2.计算新交期下所需产能; 3.检查目标时段产能是否充足; 4.识别被挤占的其他订单; 5.传播连锁影响（后续工序/跨事业部配套）
本体对象调用	ScheduleItem.reschedule()（仅计算，不执行）; ProductionLine.calcLoad()（计算新负荷）; CoordinationTask.checkDependencySatisfied()（检查跨部依赖）
外部系统	MES(读产线实时状态); SAP(读订单当前状态)
DeepSeek V4	否 —— 纯逻辑推理+数学计算
输出	影响报告: 受影响订单清单/延迟天数/产能负荷变化/连锁影响/合同违约风险
事务操作	影响报告存入txContext临时区; 锁定相关ScheduleItem（防止并发修改）
验证层	①形式化校验: 推理结果一致性; ②求解器复算: 影响计算交叉验证
步骤③ 生成调整方案（CP-SAT 重排）
维度	内容
触发对象	MasterProductionSchedule.rollAdjust(changeEvent, txContext)
策略A	局部重排: 仅调整受影响时段内的订单顺序（锁定已开工订单不变）
策略B	整体重排: 重新运行求解器，但锁定已开工订单+冻结订单不变
策略C	加班补产: 启用Calendar.addSpecialWorkday() + Personnel.assignOvertime()（需审批）
策略D	跨事业部协同: 触发CoordinationTask.syncScheduleWithDept()（需会签）
求解器	CP-SAT 对每个策略生成候选方案 → 计算KPI
DeepSeek V4	是 —— 生成各策略的自然语言解释（受控，经规则引擎校验 + 人工审核）
事务操作	候选方案存入txContext; 不持久化
验证层	②求解器复算: 主CP-SAT vs 验证MILP; ③规则引擎: R001-R010
步骤④ 变更影响叙述生成（DeepSeek V4，受控）
维度	内容
触发对象	DeepSeek V4 生成变更影响叙述
输入	影响报告(步骤②) + 候选方案(步骤③) + 本体实例数据
输出	"将SO-12345交期提前至6月15日，需要挤占L1产线6月10-14日的产能，影响SO-006(延迟3天)和SO-007(延迟5天)。建议启用6月13-14日周末加班..."
DeepSeek V4	是 —— 主模型生成 → 规则引擎校验(R009/R010) → 人工审核
校验方式	规则引擎核查叙述中的订单号/延迟天数/产线/日期是否存在于本体且数值一致
验证层	③规则引擎 + ④人工审批
步骤⑤ 人工审核与决策
维度	内容
触发对象	ApprovalGate —— 计划科长 + 事业部总监（影响大时）
展示内容	影响报告 + 候选方案对比仪表盘 + DeepSeek V4叙述 + 风险提示
审批通过	进入步骤⑥执行
审批拒绝	事务回滚（释放锁/撤销临时方案）→ 可重新触发
部分接受	计划员选择策略A+策略C组合 → 重新计算 → 再次审批
超时	4小时→升级; 8小时→事务自动回滚
验证层	④人工在环（必须）
步骤⑥ 执行调整与事务下发
维度	内容
触发对象	MasterProductionSchedule.confirmPlan() + releaseToShopFloor()
子步骤	a.更新计划版本(版本号+1) → b.更新ScheduleItem → c.写SAP(更新交期) → d.下发MES(更新派工单) → e.通知销售/采购/车间
外部系统	SAP(写), MES(写), 企微/邮件(通知)
DeepSeek V4	否
事务保障	同步步骤失败→补偿栈逆序回滚→恢复上一版本快照
成功	commit(); 释放所有锁; 计划status=released
验证层	①形式化校验: 下发后一致性
7.3 场景二步骤总览图
步骤	动作	语义解析	求解器	规则引擎	审批/事务
①事件录入	CRM/邮件→变更事件	✓对齐+抽取			✓加锁
②影响评估	约束传播+连锁分析		✓复算		✓锁Item
③方案生成	4策略CP-SAT重排	✓解释	✓主+验证	✓R001-R010	✓临时
④叙述生成	变更影响叙述	✓抽取		✓校验LLM	✓人工审核
⑤人工审核	科长/总监审批				✓必须
⑥执行下发	SAP+MES更新				✓提交/回滚


第八章  推理场景三：产线设备故障导致计划变更
8.1 场景概述
触发条件：MES 系统上报设备故障（如"L1产线绕线机故障，预计修复5天"）。
业务目标：快速锁定故障产线产能，评估对现有计划的影响，生成应急调整方案，经审批后更新计划并同步维修工单。
8.2 完整推理步骤
步骤① 故障事件创建与产能原子化锁定
维度	内容
触发对象	Equipment.reportFault(faultInfo, txContext)
语义解析	MES推送故障代码 → DeepSeek V4 抽取: 设备ID/故障描述/预计修复时间/影响产线
语义对齐	"停机"="故障"="out of service" → 统一映射为 Equipment.status=fault
原子操作	1.立即锁定该设备所属产线的全部产能(loadRate=0); 2.创建ChangeEvent(type=equipmentFault); 3.关联所有占用该产线的ScheduleItem
外部系统	MES(读故障信号), CMMS(读维修历史/MTTR)
DeepSeek V4	是 —— 非结构化故障报告抽取（受控，输出经规则引擎R009校验 + 人工审核）
事务操作	TransactionContext.begin(); acquireLock(lineId); acquireLock(allAffectedOrderIds)
优先级	紧急操作，无需审批（自动执行，防止连锁恶化）
验证层	①形式化校验: 锁定后状态一致性
步骤② 影响范围计算（时间线传播推理）
维度	内容
触发对象	ChangeEvent.impactAnalysis(currentPlan)
推理过程	1.扫描占用该产线的所有ScheduleItem; 2.根据预计修复时间计算每单延迟; 3.检查延迟订单的后续工序(跨事业部配套); 4.识别合同违约风险订单
本体对象调用	ScheduleItem.calcDuration(); ProductionLine.calcLoad(修复后窗口); CoordinationTask.checkDependencySatisfied()
外部系统	MES(读实时在制品状态); SAP(读合同违约金条款)
DeepSeek V4	否 —— 纯时间线推理+数学计算
输出	影响报告: 受影响订单/延迟天数/违约风险清单/跨部连锁影响
事务操作	影响报告存入txContext; 保持产线锁定状态
验证层	②求解器复算: 影响计算交叉验证
步骤③ 应急方案生成（按优先级尝试）
维度	内容
策略A:转移产线	检查同类型空闲产线 → 验证工艺能力匹配 → CP-SAT生成转移方案
策略B:顺序重排	不转移产线，调整受影响订单的先后顺序 → 优先紧急订单 → CP-SAT求解
策略C:加班补产	Calendar.addSpecialWorkday() + Personnel.assignOvertime() → 需审批
策略D:跨事业部协同	CoordinationTask.proposeCrossDeptSolution() → 检查配套产线产能 → 需会签
求解器	CP-SAT 对每个可行策略生成方案 → 计算KPI
DeepSeek V4	是 —— 生成策略解释+维修影响分析报告（受控，经规则引擎校验 + 人工审核）
事务操作	候选方案存入txContext; 不持久化
验证层	②求解器复算 + ③规则引擎(R001-R010)
步骤④ 故障影响叙述与策略建议（DeepSeek V4，受控）
维度	内容
触发对象	DeepSeek V4 生成故障影响分析报告
输入	故障信息 + 影响报告 + 候选方案 + 本体数据
输出	"L1产线绕线机故障，预计修复5天(6月10-14日)。影响8个订单，其中SO-001(客户A,VIP)延迟5天→合同违约风险高。建议：(1)SO-001转移至L2产线(已验证能力匹配); (2)SO-003/SO-005启用周末加班..."
DeepSeek V4	是 —— 主模型生成 → 规则引擎校验(R009/R010) → 人工审核
校验方式	规则引擎核查设备ID/订单号/延迟天数/产线能力/维修时间是否与本体一致
验证层	③规则引擎 + ④人工审批
步骤⑤ 人工审核与决策
维度	内容
触发对象	ApprovalGate —— 计划科长(策略A/B) + 总监(策略C/D)
展示内容	故障信息 + 影响报告 + 产能负荷图 + 候选方案对比 + DeepSeek V4叙述 + 违约风险
审批通过	进入步骤⑥执行
审批拒绝	事务回滚 → 可手动指定其他策略 → 重新计算
超时	2小时→提醒科长; 4小时→升级总监
验证层	④人工在环（必须）
步骤⑥ 执行调整 + 维修工单同步
维度	内容
触发对象	MasterProductionSchedule.confirmPlan() + Equipment.scheduleRepair()
子步骤	a.更新计划版本 → b.更新ScheduleItem(转移/重排) → c.写SAP → d.下发MES → e.创建维修工单(CMMS) → f.通知相关方
外部系统	SAP(写), MES(写), CMMS(写维修工单), 企微/邮件(通知)
DeepSeek V4	否
事务保障	同步步骤失败→补偿栈逆序回滚→恢复上一版本+解锁产能
成功	commit(); 释放锁; 计划status=released; 设备status=maintenance
验证层	①形式化校验: 最终一致性
8.3 场景三步骤总览图
步骤	动作	语义解析	求解器	规则引擎	审批/事务
①故障锁定	产能原子化锁定	✓对齐+抽取			✓紧急锁
②影响计算	时间线传播		✓复算		✓保持锁
③应急方案	4策略CP-SAT	✓解释	✓主+验证	✓R001-R010	✓临时
④叙述生成	故障分析报告	✓抽取		✓校验LLM	✓人工审核
⑤人工审核	科长/总监审批				✓必须
⑥执行下发	SAP+MES+CMMS				✓提交/回滚
