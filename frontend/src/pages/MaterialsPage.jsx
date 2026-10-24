/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useMaterialUpload } from "../context/MaterialUploadContext";
import { API_BASE_URL } from "../config";
import useApprovalGuard from "../hooks/useApprovalGuard";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import LockedFeatureModal from "../components/LockedFeatureModal";
import { BookOpen, CheckCircle, FileText, Plus, Search, Sparkles, Trash2, Upload, X } from "lucide-react";

const MaterialsPage = () => {
  const { token } = useAuth();
  const { startUpload, upload, uploadRevision } = useMaterialUpload();
  const { guard, showLockedModal, lockedFeatureName, closeModal } =
    useApprovalGuard();

  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");
  const [search, setSearch] = useState("");
  const [summarizingId, setSummarizingId] = useState(null);
  const [summaryResult, setSummaryResult] = useState(null);
  const [summaryProvider, setSummaryProvider] = useState("groq");
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState(null);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const fetchingRef = useRef(false);
  const fetchQueuedRef = useRef(false);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (selectedFile && selectedFile.size > 2 * 1024 * 1024) {
      setFile(null);
      setError("This file is larger than 2 MB. Choose a smaller file.");
      event.target.value = "";
      return;
    }

    setError("");
    setFile(selectedFile);
  };

  const fetchMaterials = async ({ silent = false } = {}) => {
    if (!token) return;
    if (fetchingRef.current) {
      fetchQueuedRef.current = true;
      return;
    }

    fetchingRef.current = true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await fetch(`${API_BASE_URL}/materials/?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Failed to load materials (${response.status})`);
      }

      const data = await response.json();
      setMaterials(data.materials ?? []);
      const coursesResponse = await fetch(`${API_BASE_URL}/planner/courses`, {
        headers: { Authorization: "Bearer " + token },
      });
      const coursesData = await coursesResponse.json().catch(() => ({}));
      if (!coursesResponse.ok) {
        throw new Error(coursesData.detail || "Failed to load registered courses");
      }
      setCourses(coursesData.courses ?? []);
      setError("");
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      fetchingRef.current = false;
      if (!silent) setLoading(false);
      if (fetchQueuedRef.current) {
        fetchQueuedRef.current = false;
        window.setTimeout(() => void fetchMaterials({ silent: true }), 0);
      }
    }
  };

  useEffect(() => {
    void fetchMaterials();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchMaterials({ silent: true });
      }
    };
    const intervalId = window.setInterval(refreshIfVisible, 15_000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [token, uploadRevision]);

  const handleUpload = guard((event) => {
    event.preventDefault();

    if (!file) {
      setError("Please select a file");
      return;
    }

    if (!courseId) {
      setError("Register and select a course before uploading a material.");
      return;
    }

    if (!startUpload(file, title, courseId)) {
      setError("An upload is already in progress, or your session has expired.");
      return;
    }

    setError("");
    setSuccess("");
    setWarning("");
    setFile(null);
    setFileInputKey((key) => key + 1);
    setTitle("");
  }, "Study Materials Upload");

  const handleRegisterCourse = guard(async (event) => {
    event.preventDefault();
    setSavingCourse(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE_URL}/planner/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          course_code: courseCode,
          course_title: courseTitle,
          exam_date: examDate || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not register course");
      setCourseCode("");
      setCourseTitle("");
      setExamDate("");
      setCourseId(String(data.course_id));
      setSuccess("Course registered. You can now upload its materials.");
      await fetchMaterials();
    } catch (courseError) {
      setError(courseError.message || "Could not register course");
    } finally {
      setSavingCourse(false);
    }
  }, "Course Registration");

  const handleDeleteCourse = guard(async (course) => {
    setDeletingCourseId(course.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE_URL}/planner/courses/${course.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Failed to delete course");

      setCourses((currentCourses) =>
        currentCourses.filter((registeredCourse) => registeredCourse.id !== course.id),
      );
      setMaterials((currentMaterials) =>
        currentMaterials.filter((material) => material.course_id !== course.id),
      );
      if (courseId === String(course.id)) setCourseId("");
      setCourseToDelete(null);
      setSuccess(
        `${course.course_code} and ${data.deleted_material_count ?? 0} uploaded material(s) were deleted.`,
      );
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete course");
    } finally {
      setDeletingCourseId(null);
    }
  }, "Delete Registered Course");

  const handleDeleteMaterial = guard(async (material) => {
    setDeletingMaterialId(material.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE_URL}/materials/${material.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Failed to delete material");
      setMaterials((currentMaterials) =>
        currentMaterials.filter((currentMaterial) => currentMaterial.id !== material.id),
      );
      setMaterialToDelete(null);
      setSuccess("Material deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete material");
    } finally {
      setDeletingMaterialId(null);
    }
  }, "Delete Study Material");

  const handleSummarize = guard(async (materialId) => {
    setSummarizingId(materialId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/materials/summarize/${materialId}?provider=${summaryProvider}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to summarise material");
      }

      const data = await response.json();
      setSummaryResult({
        title: data.title || materials.find((material) => material.id === materialId)?.title || "Study material",
        summary: data.summary || "",
      });
    } catch (summarizeError) {
      setError(
        summarizeError.message ||
          "Could not generate the summary. Check the selected AI provider and try again.",
      );
    } finally {
      setSummarizingId(null);
    }
  }, "Material Summarisation");

  const searchTerm = search.trim().toLowerCase();
  const filteredMaterials = materials.filter(
    (material) =>
      !searchTerm ||
      material.title?.toLowerCase().includes(searchTerm) ||
      material.course_code?.toLowerCase().includes(searchTerm) ||
      material.course_title?.toLowerCase().includes(searchTerm)
  );

  return (
    <div>
      <ConfirmDialog
        open={Boolean(courseToDelete || materialToDelete)}
        title={courseToDelete ? "Delete registered course?" : "Delete study material?"}
        message={
          courseToDelete
            ? `Permanently delete ${courseToDelete.course_code} · ${courseToDelete.course_title}, all materials uploaded under it, and its planner topics? This cannot be undone.`
            : materialToDelete
              ? `Permanently delete “${materialToDelete.title}” and its related planner topics? This cannot be undone.`
              : ""
        }
        confirmLabel={
          deletingCourseId || deletingMaterialId
            ? "Deleting..."
            : courseToDelete
              ? "Delete course and materials"
              : "Delete material"
        }
        busy={Boolean(deletingCourseId || deletingMaterialId)}
        onCancel={() => {
          setCourseToDelete(null);
          setMaterialToDelete(null);
        }}
        onConfirm={() => {
          if (courseToDelete) handleDeleteCourse(courseToDelete);
          else if (materialToDelete) handleDeleteMaterial(materialToDelete);
        }}
      />
      <PageHeader
        title="Study Materials"
        subtitle="Upload, manage and summarise your lecture notes"
        showRefresh={true}
        onRefresh={fetchMaterials}
      />

      {summaryResult && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSummaryResult(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="material-summary-title"
            className="max-h-[85dvh] w-full max-w-2xl overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 px-5 py-4 dark:border-slate-700 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <CheckCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="material-summary-title" className="text-lg font-bold text-slate-900 dark:text-white">
                    Summary ready
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                    {summaryResult.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSummaryResult(null)}
                aria-label="Close summary"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X size={19} />
              </button>
            </div>
            <div className="max-h-[calc(85dvh-8rem)] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base">
                {summaryResult.summary}
              </div>
            </div>
            <div className="border-t border-blue-100 bg-slate-50 px-5 py-3 text-right dark:border-slate-700 dark:bg-slate-950/40 sm:px-6">
              <button
                type="button"
                onClick={() => setSummaryResult(null)}
                className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-800">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Register a course</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Add the course code and title before uploading its study materials.
            </p>
          </div>
        </div>
        <form onSubmit={handleRegisterCourse} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value.toUpperCase())}
            placeholder="Course code (e.g. SWE401)"
            maxLength={32}
            required
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            value={courseTitle}
            onChange={(event) => setCourseTitle(event.target.value)}
            placeholder="Course title"
            maxLength={200}
            required
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Exam date (optional)
            <input
              type="date"
              value={examDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setExamDate(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <button
            type="submit"
            disabled={savingCourse}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {savingCourse ? "Registering..." : "Register course"}
          </button>
        </form>
        {courses.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
              Registered courses — use the trash icon to remove a course registered by mistake.
            </p>
            <div className="flex flex-wrap gap-2">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className={`inline-flex items-center overflow-hidden rounded-full border text-xs font-semibold ${
                    courseId === String(course.id)
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-blue-200 bg-white text-blue-800 dark:border-gray-600 dark:bg-gray-800 dark:text-blue-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCourseId(String(course.id))}
                    aria-pressed={courseId === String(course.id)}
                    className="py-1.5 pl-3 pr-2 transition hover:opacity-80"
                  >
                    {course.course_code} · {course.course_title}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseToDelete(course)}
                    disabled={Boolean(deletingCourseId) || upload?.status === "uploading"}
                    aria-label={`Delete ${course.course_code} registered course`}
                    title={`Delete ${course.course_code}`}
                    className="flex min-h-8 min-w-8 items-center justify-center border-l border-current/20 px-2 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl text-sm whitespace-pre-wrap">
          {success}
        </div>
      )}
      {warning && (
        <div
          role="status"
          className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-xl text-sm"
        >
          {warning}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
            placeholder="e.g. Software Engineering Notes"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Course</label>
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            required
            disabled={!courses.length || upload?.status === "uploading"}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select a registered course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.course_code} — {course.course_title}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            File (PDF, DOCX, PPTX)
          </label>
          <input
            key={fileInputKey}
            type="file"
            accept=".pdf,.docx,.pptx"
            onChange={handleFileChange}
            className="w-full cursor-pointer px-3 py-2 file:cursor-pointer bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            PDF, DOCX or PPTX · Maximum file size: 2 MB
          </p>
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={upload?.status === "uploading" || !courses.length}
            className="flex cursor-pointer items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            {upload?.status === "uploading" ? "Uploading..." : "Upload Material"}
          </button>
          {!courses.length && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Register a course above before uploading materials.
            </p>
          )}
        </div>
      </form>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search materials..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
        />
      </div>

      <div className="mb-5 flex items-center justify-end gap-3">
        <label htmlFor="summary-provider" className="text-sm text-gray-600 dark:text-gray-300">
          Summary AI
        </label>
        <select
          id="summary-provider"
          value={summaryProvider}
          onChange={(event) => setSummaryProvider(event.target.value)}
          disabled={summarizingId !== null}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="groq">Groq (faster)</option>
          <option value="ollama">Local Ollama</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-10 text-center text-gray-500">
          No materials uploaded yet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMaterials.map((material) => (
            <div
              key={material.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 dark:text-white truncate">
                    {material.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {material.course_code
                      ? `${material.course_code} · ${material.course_title || ""}`
                      : material.subject || "No course assigned"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSummarize(material.id)}
                disabled={summarizingId === material.id}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg text-sm"
              >
                <Sparkles className="w-4 h-4" />
                {summarizingId === material.id ? "Summarising..." : "Summarise"}
              </button>
              <button
                type="button"
                onClick={() => setMaterialToDelete(material)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4" />
                Delete material
              </button>
            </div>
          ))}
        </div>
      )}

      <LockedFeatureModal
        isOpen={showLockedModal}
        onClose={closeModal}
        featureName={lockedFeatureName}
      />
    </div>
  );
};

export default MaterialsPage;
