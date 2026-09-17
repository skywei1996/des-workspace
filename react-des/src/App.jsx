import React from 'react'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import AddSiliconWorker from './pages/AddSiliconWorker'
import ChatWorkspace from './pages/ChatWorkspace'
import TaskProgressPage from './pages/TaskProgressPage'
import SiliconWorkforcePage from './pages/SiliconWorkforcePage'
import ProjectManagement from './pages/ProjectManagement'
import CreateProject from './pages/CreateProject'
import WorkforceManagement from './pages/WorkforceManagement'
import AddCarbonWorker from './pages/AddCarbonWorker'
import RoleManagement from './pages/RoleManagement'
import ObjectManagement from './pages/ObjectManagement'
import ModelConfiguration from './pages/ModelConfiguration'
import KnowledgeBase from './pages/KnowledgeBase'
import Database from './pages/Database'
import Datasets from './pages/Datasets'
import Tools from './pages/Tools'
import SkillEditor from './pages/SkillEditor'
import McpServers from './pages/McpServers'
import Connectors from './pages/Connectors'
import ConnectorOAuth from './pages/ConnectorOAuth'
import QQMailAuthorize from './pages/QQMailAuthorize'
import ConnectorAdminAuthorize from './pages/ConnectorAdminAuthorize'
import WorkerMarket from './pages/WorkerMarket'
import SiliconWorkmate from './pages/SiliconWorkmate'
import AgentApps from './pages/AgentApps'
import AgentAppRedirect from './pages/AgentAppRedirect'
import EvaluationAgent from './pages/EvaluationAgent'
import WatermarkAuditAgent from './pages/WatermarkAuditAgent'
import ContractReviewAgent from './pages/ContractReviewAgent'
import RecruitmentAssistant from './pages/RecruitmentAssistant'
import CandidateList from './pages/CandidateList'
import AutomationTaskListPage from './pages/AutomationTaskListPage'
import AutomationTaskHistoryPage from './pages/AutomationTaskHistoryPage'
import ConnectSiliconWorker from './pages/ConnectSiliconWorker'
import SiliconWorkerDifyConfig from './pages/SiliconWorkerDifyConfig'
import OntologyModeling from './pages/OntologyModeling'
import OntologyProjectWorkspacePage from './pages/OntologyProjectWorkspacePage'
import OntologyModelingRelations from './pages/OntologyModelingRelations'
import OntologyModelingMapping from './pages/OntologyModelingMapping'
import OntologyModelingValidation from './pages/OntologyModelingValidation'
import OntologyModelingGovernance from './pages/OntologyModelingGovernance'
import OntologyActionsPage from './pages/OntologyActionsPage'
import OntologyFunctionsPage from './pages/OntologyFunctionsPage'
import WorkflowList from './pages/WorkflowList'
import WorkflowWorkspace from './pages/WorkflowWorkspace'
import { LanguageProvider } from './i18n'

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/silicon-workmate" element={<SiliconWorkmate />} />
          <Route path="/agent-apps" element={<AgentApps />} />
          <Route path="/agent-apps/:projectKey" element={<AgentAppRedirect />} />
          <Route path="/evaluation-agent" element={<EvaluationAgent />} />
          <Route path="/watermark-audit-agent" element={<WatermarkAuditAgent />} />
          <Route path="/contract-review-agent" element={<ContractReviewAgent />} />
          <Route path="/contract-review-rules" element={<ContractReviewAgent />} />
          <Route path="/recruitment-assistant" element={<RecruitmentAssistant />} />
          <Route path="/candidate-list" element={<CandidateList />} />
          <Route path="/add-silicon-worker" element={<AddSiliconWorker />} />
          <Route path="/connect-silicon-worker" element={<ConnectSiliconWorker />} />
          <Route path="/silicon-workmate/dify/:id" element={<SiliconWorkerDifyConfig />} />
          <Route path="/worker-market" element={<WorkerMarket />} />
          <Route path="/add-carbon-worker" element={<AddCarbonWorker />} />
          <Route path="/chat-workspace" element={<ChatWorkspace />} />
          <Route path="/task-progress" element={<TaskProgressPage />} />
          <Route path="/automation-tasks" element={<AutomationTaskListPage />} />
          <Route path="/automation-tasks/new" element={<AutomationTaskListPage />} />
          <Route
            path="/automation-tasks/history"
            element={<AutomationTaskHistoryPage />}
          />
          <Route path="/silicon-workforce" element={<SiliconWorkforcePage />} />
          <Route path="/project-management" element={<ProjectManagement />} />
          <Route path="/create-project" element={<CreateProject />} />
          <Route path="/workforce-management" element={<WorkforceManagement />} />
          <Route path="/role-management" element={<RoleManagement />} />
          <Route path="/ontology-modeling" element={<OntologyModeling />} />
          <Route path="/ontology-modeling/projects/blank/*" element={<Navigate to="/ontology-modeling" replace />} />
          <Route path="/ontology-modeling/projects/:projectId" element={<OntologyProjectWorkspacePage />} />
          <Route path="/ontology-modeling/projects/:projectId/properties" element={<OntologyProjectWorkspacePage activeSection="properties" />} />
          <Route path="/ontology-modeling/projects/:projectId/relations" element={<OntologyModelingRelations />} />
          <Route path="/ontology-modeling/projects/:projectId/mapping" element={<OntologyModelingMapping />} />
          <Route path="/ontology-modeling/projects/:projectId/validation" element={<OntologyModelingValidation />} />
          <Route path="/ontology-modeling/projects/:projectId/governance" element={<OntologyModelingGovernance />} />
          <Route path="/ontology-modeling/projects/:projectId/actions" element={<OntologyActionsPage />} />
          <Route path="/ontology-modeling/projects/:projectId/functions" element={<OntologyFunctionsPage />} />
          <Route path="/workflows" element={<WorkflowList />} />
          <Route path="/workflows/:workflowId" element={<WorkflowWorkspace />} />
          <Route path="/object-management" element={<Navigate to="/object-management/object-types" replace />} />
          <Route path="/object-management/object-types/:objectTypeId" element={<ObjectManagement />} />
          <Route path="/object-management/:section" element={<ObjectManagement />} />
          <Route path="/model-configuration" element={<ModelConfiguration />} />
          <Route path="/connectors" element={<Connectors />} />
          <Route path="/connectors/oauth/:connectorId" element={<ConnectorOAuth />} />
          <Route path="/connectors/qq-mail/authorize" element={<QQMailAuthorize />} />
          <Route path="/connectors/admin-authorize/:connectorId" element={<ConnectorAdminAuthorize />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/database" element={<Database />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/tools/new" element={<SkillEditor />} />
          <Route path="/tools/:skillKey" element={<SkillEditor />} />
          <Route path="/mcp-server-management" element={<McpServers />} />
        </Routes>
      </Router>
    </LanguageProvider>
  )
}

export default App
