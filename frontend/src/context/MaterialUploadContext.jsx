/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "./AuthContext";

const MaterialUploadContext = createContext(null);
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;

export function MaterialUploadProvider({ children }) {
  const { token } = useAuth();
  const [upload, setUpload] = useState(null);
  const [uploadRevision, setUploadRevision] = useState(0);
  const uploadInProgress = useRef(false);

  const startUpload = useCallback((file, title, courseId) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      setUpload({
        status: "error",
        filename: file.name,
        message: "This file is larger than 2 MB. Choose a smaller file.",
      });
      return false;
    }
    if (uploadInProgress.current) return false;
    if (!token) {
      setUpload({
        status: "error",
        filename: file.name,
        message: "Your session has expired. Sign in again before uploading.",
      });
      return false;
    }
    if (!courseId) {
      setUpload({
        status: "error",
        filename: file.name,
        message: "Register and select a course before uploading materials.",
      });
      return false;
    }

    uploadInProgress.current = true;
    setUpload({ status: "uploading", filename: file.name, message: "" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim() || file.name);
    formData.append("course_id", courseId);

    fetch(`${API_BASE_URL}/materials/upload`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.detail || "Upload failed. Please try again.");
        }
        return data;
      })
      .then((data) => {
        uploadInProgress.current = false;
        setUpload({
          status: "success",
          filename: data.title || file.name,
          message:
            data.rag_indexed === false && data.full_text_indexed
              ? "Uploaded and available to study chat through full-text search."
              : data.rag_indexed === false
                ? "Uploaded, but indexing did not finish."
                : "Uploaded and ready to use.",
          warning: data.indexing_warning || "",
        });
        setUploadRevision((revision) => revision + 1);
      })
      .catch((error) => {
        uploadInProgress.current = false;
        setUpload({
          status: "error",
          filename: file.name,
          message: error.message || "Upload failed. Please try again.",
        });
      });

    return true;
  }, [token]);

  const dismissUpload = useCallback(() => setUpload(null), []);

  return (
    <MaterialUploadContext.Provider
      value={{ startUpload, upload, uploadRevision, dismissUpload }}
    >
      {children}
      {upload && (
        <div
          role={upload.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className="fixed bottom-4 left-4 right-4 z-[80] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:bottom-6"
        >
          {upload.status === "uploading" ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
          ) : (
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                upload.status === "error" ? "bg-red-500" : "bg-emerald-500"
              }`}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
              {upload.status === "uploading" ? "Uploading in background" : upload.filename}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-300">
              {upload.status === "uploading"
                ? `${upload.filename} is being prepared. You can keep using the app.`
                : upload.message}
            </p>
            {upload.warning && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {upload.warning}
              </p>
            )}
          </div>
          {upload.status !== "uploading" && (
            <button
              type="button"
              onClick={dismissUpload}
              aria-label="Dismiss upload notification"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}
    </MaterialUploadContext.Provider>
  );
}

export function useMaterialUpload() {
  const context = useContext(MaterialUploadContext);
  if (!context) {
    throw new Error("useMaterialUpload must be used within MaterialUploadProvider");
  }
  return context;
}
