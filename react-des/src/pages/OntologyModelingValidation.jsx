import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import {
  OntologyProjectHeader,
  OntologyProjectNav,
} from "../components/OntologyProjectWorkspace";
import {
  getModelingProject,
  listModelingReleases,
  publishModelingProject,
} from "../utils/ontologyModelingApi";

function formatReleaseTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function OntologyModelingValidation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const [project, setProject] = useState(location.state?.project || null);
  const [releases, setReleases] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(projectId && !location.state?.project));
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [canForcePublish, setCanForcePublish] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    Promise.all([getModelingProject(projectId), listModelingReleases(projectId)])
      .then(([savedProject, savedReleases]) => {
        if (!active) return;
        setProject(savedProject);
        setReleases(savedReleases);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "发布记录加载失败，请稍后重试。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const openPublishConfirm = () => {
    if (isPublishing) return;
    setError("");
    setCanForcePublish(false);
    setIsPublishConfirmOpen(true);
  };

  const publish = async (force = false) => {
    if (isPublishing || !project?.id) return;
    setIsPublishing(true);
    setError("");
    try {
      const publishedProject = await publishModelingProject(project.id, { force });
      const savedReleases = await listModelingReleases(project.id);
      setProject(publishedProject);
      setReleases(savedReleases);
      setIsPublishConfirmOpen(false);
    } catch (publishError) {
      if (publishError.status === 409) {
        setCanForcePublish(true);
        setError("项目存在未解决的校验问题，可选择强制发布。");
      } else {
        setError(publishError.message || "发布失败，请稍后重试。");
      }
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">
        正在加载发布记录...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f8fa]">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#20242b]">项目上下文已失效</h1>
          <button
            type="button"
            onClick={() => navigate("/ontology-modeling")}
            className="mt-5 h-10 bg-[#e3473c] px-4 text-sm font-medium text-white"
          >
            返回对象建模
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <Sidebar activeTab="objects" />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <OntologyProjectHeader
          project={project}
          actions={
            <button
              type="button"
              onClick={openPublishConfirm}
              disabled={isPublishing}
              className="h-9 bg-[#e3473c] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#e7a6a0]"
            >
              {isPublishing ? "发布中..." : "发布"}
            </button>
          }
        />
        <div className="flex min-h-0 flex-1">
          <OntologyProjectNav
            projectId={project.id}
            project={project}
            activeItem="validation"
          />
          <section className="min-w-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-[1180px] border border-[#e0e3e7] bg-white p-6">
              <div className="border-b border-[#eceef1] pb-5">
                <h2 className="text-xl font-semibold text-[#20242b]">版本发布</h2>
                <p className="mt-1.5 text-sm leading-6 text-[#717985]">
                  查看每次发布的版本、时间以及当时的对象和属性数量。
                </p>
              </div>

              {error && (
                <div className="mt-5 border border-[#f2c3bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#b83b31]">
                  {error}
                </div>
              )}
              <section className="mt-6 border border-[#e0e3e7]">
                <div className="flex items-center justify-between border-b border-[#eceef1] px-5 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-[#303741]">发布记录</h3>
                    <p className="mt-1 text-xs text-[#858d98]">每次发布都会保留当时的对象和属性数量。</p>
                  </div>
                  <span className="text-xs text-[#858d98]">共 {releases.length} 次</span>
                </div>
                {releases.length ? (
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px] grid grid-cols-[1fr_1.5fr_1fr_1fr_1.2fr] gap-4 border-b border-[#edf0f2] bg-[#fafbfc] px-5 py-3 text-xs font-semibold text-[#747d88]">
                      <span>版本</span>
                      <span>发布时间</span>
                      <span>对象数</span>
                      <span>属性数</span>
                      <span>实例更新进度</span>
                    </div>
                    {releases.map((release) => (
                      <div
                        key={release.id}
                        className="min-w-[760px] grid grid-cols-[1fr_1.5fr_1fr_1fr_1.2fr] gap-4 border-b border-[#edf0f2] px-5 py-4 text-sm text-[#4c5561] last:border-0"
                      >
                        <span className="font-medium text-[#303741]">{release.version}</span>
                        <span>{formatReleaseTime(release.published_at)}</span>
                        <span>{release.object_count}</span>
                        <span>{release.property_count}</span>
                        <span className={release.instance_update_status === "completed" ? "text-[#2f7f55]" : "text-[#a66a12]"}>
                          {release.instance_update_status === "completed" ? "已完成" : "进行中"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center text-sm text-[#858d98]">暂无发布记录</div>
                )}
              </section>
            </div>
          </section>
        </div>
      </main>

      {isPublishConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191f]/35 px-4"
          onMouseDown={() => !isPublishing && setIsPublishConfirmOpen(false)}
        >
          <div
            className="w-full max-w-[520px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[#eceef1] px-6 py-5">
              <h2 className="text-lg font-semibold text-[#20242b]">发布版本</h2>
              <p className="mt-2 text-sm leading-6 text-[#717985]">
                确认发布当前本体模型，并更新数据实例关系？
              </p>
            </div>
            {error && (
              <div className="px-6 py-5 text-sm text-[#b83b31]">{error}</div>
            )}
            <div className="flex justify-end gap-3 border-t border-[#eceef1] bg-[#fcfcfd] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsPublishConfirmOpen(false)}
                disabled={isPublishing}
                className="h-10 border border-[#cfd5dc] px-4 text-sm text-[#4c5561] disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => publish(canForcePublish)}
                disabled={isPublishing}
                className="h-10 bg-[#e3473c] px-5 text-sm font-medium text-white disabled:bg-[#e7a6a0]"
              >
                {isPublishing ? "发布中..." : canForcePublish ? "强制发布" : "确认发布"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OntologyModelingValidation;
