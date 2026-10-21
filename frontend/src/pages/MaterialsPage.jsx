/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useMaterialUpload } from "../context/MaterialUploadContext";
import { API_BASE_URL } from "../config";
import useApprovalGuard from "../hooks/useApprovalGuard";
import PageHeader from "../components/PageHeader";
import LockedFeatureModal from "../components/LockedFeatureModal";
import { FileText, Search, Sparkles, Upload } from "lucide-react";

const MaterialsPage = () => {
  const { token } = useAuth();
  const { startUpload, upload, uploadRevision } = useMaterialUpload();
  const { guard, showLockedModal, lockedFeatureName, closeModal } =
    useApprovalGuard();

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");
  const [search, setSearch] = useState("");
  const [summarizingId, setSummarizingId] = useState(null);
  const [summaryProvider, setSummaryProvider] = useState("groq");
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");

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

  const fetchMaterials = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/materials/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Failed to load materials (${response.status})`);
      }

      const data = await response.json();
      setMaterials(data.materials ?? []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [token, uploadRevision]);

  const handleUpload = guard((event) => {
    event.preventDefault();

    if (!file) {
      setError("Please select a file");
      return;
    }

    if (!startUpload(file, title, subject)) {
      setError("An upload is already in progress, or your session has expired.");
      return;
    }

    setError("");
    setSuccess("");
    setWarning("");
    setFile(null);
    setFileInputKey((key) => key + 1);
    setTitle("");
    setSubject("");
  }, "Study Materials Upload");

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
      setSuccess(data.summary || "Summary generated successfully");
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
      material.subject?.toLowerCase().includes(searchTerm)
  );

  return (
    <div>
      <PageHeader
        title="Study Materials"
        subtitle="Upload, manage and summarise your lecture notes"
        showRefresh={true}
        onRefresh={fetchMaterials}
      />

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
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
            placeholder="e.g. SWE401"
          />
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
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            PDF, DOCX or PPTX · Maximum file size: 2 MB
          </p>
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={upload?.status === "uploading"}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            {upload?.status === "uploading" ? "Uploading in background..." : "Upload Material"}
          </button>
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
                    {material.subject || "General"}
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
