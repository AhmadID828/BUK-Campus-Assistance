/* eslint-disable react-hooks/exhaustive-deps */ 
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import useApprovalGuard from "../hooks/useApprovalGuard";
import PageHeader from "../components/PageHeader";
import LockedFeatureModal from "../components/LockedFeatureModal";
import {
  Calendar,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";

const PlannerSchedule = ({
  plan,
  loading,
  onUpdateTopic,
  onCompleteTopic,
  onRemoveTopic,
}) => {
  const items = plan?.plan || [];
  const completedCount = items.filter((item) => item.completed).length;
  const completion = items.length
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-white/15 p-2.5">
              <Calendar className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                Your generated schedule
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {plan?.title || "Active study plan"}
              </h2>
              {plan && (
                <p className="mt-1 text-sm text-blue-100">
                  {plan.start_date || "--"} <span aria-hidden="true">→</span>{" "}
                  {plan.end_date || "--"}
                </p>
              )}
            </div>
          </div>
          {plan && (
            <div className="rounded-xl bg-white/10 px-3 py-2 text-right">
              <p className="text-lg font-bold">{completedCount}/{items.length}</p>
              <p className="text-[11px] text-blue-100">topics completed</p>
            </div>
          )}
        </div>
        {plan && (
          <div className="mt-4">
            <div
              className="h-2 overflow-hidden rounded-full bg-white/20"
              role="progressbar"
              aria-label="Study plan completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
            >
              <div
                className="h-full rounded-full bg-emerald-300 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-xs text-blue-100">
              {completion}% complete
            </p>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={28} />
          </div>
        ) : !plan ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-8 text-center dark:border-gray-600 dark:bg-gray-700/30">
            <Calendar className="mx-auto h-8 w-8 text-blue-500" />
            <p className="mt-3 font-semibold text-gray-800 dark:text-white">
              Your study schedule will appear here
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
              Select <strong>Generate Plan</strong> above to create a schedule from your topics and study materials.
            </p>
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:bg-gray-700/40 dark:text-gray-300">
            Your plan is active, but it has no scheduled topics yet. Add a topic or material below, then regenerate the plan.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((item, index) => (
              <li
                key={item.topic_id || `${item.topic}-${item.date}-${index}`}
                className={`relative rounded-xl border p-4 transition ${
                  item.completed
                    ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-900/10"
                    : "border-gray-100 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-700/30"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        item.completed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
                      }`}
                    >
                      {item.completed ? <CheckCircle2 size={16} /> : index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-800 dark:text-white">
                        {item.topic}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                        {item.course || "Study topic"} <span aria-hidden="true">·</span> {item.date || "Date to be scheduled"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                      {item.hours}h study time
                    </span>
                    {item.topic_id && !item.completed && (
                      <select
                        value={item.priority}
                        onChange={(event) =>
                          onUpdateTopic(item.topic_id, {
                            priority: Number(event.target.value),
                          })
                        }
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        aria-label={`Priority for ${item.topic}`}
                      >
                        <option value={1}>High priority</option>
                        <option value={2}>Medium priority</option>
                        <option value={3}>Low priority</option>
                      </select>
                    )}
                    {item.completed ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Completed
                      </span>
                    ) : item.topic_id ? (
                      <button
                        onClick={() => onCompleteTopic(item.topic_id)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Mark complete
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Regenerate to track
                      </span>
                    )}
                    {item.topic_id && (
                      <button
                        onClick={() => onRemoveTopic(item.topic_id)}
                        className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove from planner"
                        aria-label={`Remove ${item.topic} from planner`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

const PlannerPage = () => {
  const { token } = useAuth();
  const { guard, showLockedModal, lockedFeatureName, closeModal } = useApprovalGuard();

  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState(null);
  const [reminders, setReminders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [topicCourse, setTopicCourse] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [topicHours, setTopicHours] = useState("2");
  const [topicPriority, setTopicPriority] = useState("2");
  const [savingTopic, setSavingTopic] = useState(false);

  const fetchAll = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const [planRes, progressRes, reminderRes, coursesRes, materialsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/planner/active`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/planner/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/planner/reminders/today`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/planner/courses`, {
          headers: { Authorization: "Bearer " + token },
        }),
        fetch(`${API_BASE_URL}/materials/`, {
          headers: { Authorization: "Bearer " + token },
        }),
      ]);

      const responses = [
        ["planner progress", progressRes],
        ["planner reminders", reminderRes],
      ];
      for (const [name, response] of responses) {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || `Failed to load ${name} (${response.status})`);
        }
      }
      if (!coursesRes.ok || !materialsRes.ok) {
        throw new Error("Unable to load courses or study materials. Please refresh and try again.");
      }

      setPlan(planRes.ok ? await planRes.json() : null);
      setProgress(await progressRes.json());
      setReminders(await reminderRes.json());
      setCourses((await coursesRes.json()).courses || []);
      setMaterials((await materialsRes.json()).materials || []);
    } catch (err) {
      setError(err?.message || "Failed to load planner data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [token]);

  const handleAddCourse = guard(async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_BASE_URL}/planner/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          course_code: courseCode,
          course_title: courseTitle,
          credit_units: 3,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to add course");
      }

      await response.json();
      setSuccess("Course added successfully.");
      setCourseCode("");
      setCourseTitle("");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to add course");
    }
  }, "Study Planner");

  const handleAddTopic = guard(async (event) => {
    event.preventDefault();
    if (!topicCourse || !topicTitle.trim()) {
      setError("Choose a course and enter a topic title.");
      return;
    }

    setSavingTopic(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/planner/courses/${topicCourse}/topics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: topicTitle.trim(),
            estimated_hours: Number(topicHours),
            priority: Number(topicPriority),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Failed to add study topic");

      const planResponse = await fetch(`${API_BASE_URL}/planner/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const planData = await planResponse.json().catch(() => ({}));
      if (!planResponse.ok) {
        throw new Error(planData.detail || "Topic was added, but the plan could not be refreshed.");
      }

      setTopicTitle("");
      setSuccess("Topic added and your study plan updated.");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to add study topic");
    } finally {
      setSavingTopic(false);
    }
  }, "Add Study Topic");

  const handleUpdateTopic = guard(async (topicId, changes) => {
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE_URL}/planner/topics/${topicId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(changes),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Failed to update topic");

      const planResponse = await fetch(`${API_BASE_URL}/planner/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const planData = await planResponse.json().catch(() => ({}));
      if (!planResponse.ok) {
        throw new Error(planData.detail || "Topic updated, but the plan could not be refreshed.");
      }
      setSuccess("Topic updated and plan rescheduled.");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to update topic");
    }
  }, "Update Study Topic");

  const handleImportMaterial = guard(async (e) => {
    e.preventDefault();

    if (!selectedCourse || !selectedMaterial) {
      setError("Select both a course and an uploaded material.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/planner/materials/${selectedMaterial}/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ course_id: Number(selectedCourse) }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to import material");
      }

      setSuccess("Material added to the selected course.");
      setSelectedMaterial("");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to import material");
    }
  }, "Import Material");

  const handleGenerate = guard(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/planner/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to generate plan");
      }

      setSuccess("Study plan generated successfully.");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to generate plan");
    }
  }, "Generate Study Plan");

  const handleRegenerate = guard(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/planner/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to regenerate plan");
      }

      setSuccess("Plan regenerated successfully.");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to regenerate plan");
    }
  }, "Regenerate Study Plan");

  const handleCompleteTopic = guard(async (topicId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/planner/topics/${topicId}/complete`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to mark topic complete");
      }
      setSuccess("Study topic marked as completed.");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to mark topic complete");
    }
  }, "Complete Study Topic");

  const handleRemoveTopic = guard(async (topicId) => {
    if (!window.confirm("Remove this topic from your study planner?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/planner/topics/${topicId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to remove topic");
      }
      setSuccess("Topic removed from the planner.");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to remove topic");
    }
  }, "Remove Planner Topic");

  const handleDeleteMaterial = guard(async () => {
    if (!selectedMaterial) {
      setError("Select an uploaded material first.");
      return;
    }
    if (!window.confirm("Delete this uploaded material permanently?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/materials/${selectedMaterial}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to delete material");
      }
      setSelectedMaterial("");
      setSuccess("Uploaded material deleted.");
      await fetchAll();
    } catch (err) {
      setError(err?.message || "Failed to delete material");
    }
  }, "Delete Uploaded Material");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      <PageHeader
        title="Adaptive Study Planner"
        subtitle="Plan your revision and track progress"
        showRefresh={true}
        onRefresh={fetchAll}
        actionLabel="Generate Plan"
        onAction={handleGenerate}
      >
        <button
          onClick={handleRegenerate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-gray-700 dark:text-blue-200 rounded-lg text-sm font-medium transition"
        >
          <RefreshCw className="w-4 h-4" />
          Regenerate
        </button>
      </PageHeader>

      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Generate a plan to automatically import your uploaded materials. Completed quiz scores
        adjust priorities so weaker material is scheduled earlier and given more study time.
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 rounded-xl text-sm">
          {success}
        </div>
      )}

      <PlannerSchedule
        plan={plan}
        loading={loading}
        onUpdateTopic={handleUpdateTopic}
        onCompleteTopic={handleCompleteTopic}
        onRemoveTopic={handleRemoveTopic}
      />

      {progress && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Topics", value: progress.total_topics ?? 0 },
            { label: "Completed", value: progress.completed_topics ?? 0 },
            { label: "Completion", value: `${progress.completion_rate ?? 0}%` },
            { label: "Avg Quiz Score", value: `${progress.average_quiz_score ?? 0}%` },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 p-4 shadow-sm"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white mt-1">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <form
          onSubmit={handleAddCourse}
          className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 p-4 space-y-3 shadow-sm"
        >
          <h3 className="font-semibold text-gray-800 dark:text-white">Add Course</h3>
          <input
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            placeholder="Course code (e.g. SWE401)"
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            placeholder="Course title"
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            Add Course
          </button>
        </form>

        <form
          onSubmit={handleAddTopic}
          className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 p-4 space-y-3 shadow-sm"
        >
          <h3 className="font-semibold text-gray-800 dark:text-white">Add a study topic</h3>
          <select
            value={topicCourse}
            onChange={(event) => setTopicCourse(event.target.value)}
            required
            disabled={!courses.length || savingTopic}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="">Choose a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.course_code} - {course.course_title}
              </option>
            ))}
          </select>
          <input
            value={topicTitle}
            onChange={(event) => setTopicTitle(event.target.value)}
            placeholder="Topic to study"
            maxLength={200}
            required
            disabled={savingTopic}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-600 dark:text-gray-300">
              Study time
              <select
                value={topicHours}
                onChange={(event) => setTopicHours(event.target.value)}
                disabled={savingTopic}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              >
                {["0.5", "1", "1.5", "2", "3", "4", "6", "8", "12"].map((hours) => (
                  <option key={hours} value={hours}>{hours} hours</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">
              Priority
              <select
                value={topicPriority}
                onChange={(event) => setTopicPriority(event.target.value)}
                disabled={savingTopic}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="1">High</option>
                <option value="2">Medium</option>
                <option value="3">Low</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={!courses.length || savingTopic}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {savingTopic ? "Adding and scheduling..." : "Add topic to plan"}
          </button>
          {!courses.length && (
            <p className="text-xs text-gray-500">Add a course first to organize topics.</p>
          )}
        </form>

        <form
          onSubmit={handleImportMaterial}
          className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 p-4 space-y-3 shadow-sm"
        >
          <h3 className="font-semibold text-gray-800 dark:text-white">Add uploaded material</h3>
          <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} required
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm">
            <option value="">Select course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.course_code} - {course.course_title}</option>
            ))}
          </select>
          <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)} required
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm">
            <option value="">Select uploaded material</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>{material.title} ({material.subject || "General"})</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            Add to Planner
          </button>
          <button
            type="button"
            onClick={handleDeleteMaterial}
            disabled={!selectedMaterial}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 rounded-lg text-sm font-medium transition"
          >
            <Trash2 className="w-4 h-4" />
            Delete material
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 p-5 mb-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
          Registered Courses and Study Materials
        </h3>
        {courses.length === 0 ? (
          <p className="text-sm text-gray-500">
            No courses registered yet. Add a course to organize your study materials.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {course.course_code}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {course.course_title}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">
                    {course.completed_topics || 0}/{course.total_topics || 0} complete
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{
                      width: `${course.total_topics
                        ? (course.completed_topics / course.total_topics) * 100
                        : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-3 space-y-1">
                  {(course.topics || []).length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No materials added to this course yet.
                    </p>
                  ) : (
                    course.topics.map((topic) => (
                      <div
                        key={topic.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className={topic.is_completed ? "text-green-600 line-through" : "text-gray-600 dark:text-gray-300"}>
                          {topic.title}
                        </span>
                        <span className="text-gray-400">
                          {topic.is_completed ? "Completed" : `${topic.estimated_hours || 0}h`}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reminders && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 p-5 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Today&apos;s Reminders
          </h3>

          {(reminders.planned_tasks || []).length === 0 &&
          (reminders.weak_topics_reminder || []).length === 0 ? (
            <p className="text-sm text-gray-500">No tasks for today.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(reminders.planned_tasks || []).map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  {t.topic} ({t.course}) — {t.hours} hrs
                </li>
              ))}

              {(reminders.weak_topics_reminder || []).map((t, i) => (
                <li key={`w-${i}`} className="flex items-center gap-2 text-red-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Weak: {t.topic} ({t.course})
                </li>
              ))}
            </ul>
          )}
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

export default PlannerPage;
