"use client";

import { useRef, useState } from "react";
import {
  allowedUploadExtensionsLabel,
  maxUploadSizeLabel,
  uploadAcceptAttribute,
  validateUploadFile,
} from "@/lib/file-policy";

type UploadState = "idle" | "ready" | "uploading" | "success" | "error";

type ModuleFileUploadFormProps = {
  moduleId: number;
  moduleName: string;
};

export function ModuleFileUploadForm({ moduleId, moduleName }: ModuleFileUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [fileMeta, setFileMeta] = useState("");

  async function uploadFile() {
    const file = inputRef.current?.files?.[0];

    if (!file) {
      setState("error");
      setMessage("Выберите файл перед загрузкой.");
      return;
    }

    const fileValidation = validateUploadFile(file);
    if (!fileValidation.ok) {
      setState("error");
      setMessage(fileValidation.error);
      return;
    }

    setState("uploading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/portal/modules/${moduleId}/files`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setState("error");
      setMessage(result.error ?? result.message ?? "Не удалось загрузить файл.");
      return;
    }

    setState("success");
    setMessage(`Файл загружен для модуля "${moduleName}".`);
    setFileName("");
    setFileMeta("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="w-full">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          ref={inputRef}
          aria-label={`Файл для модуля ${moduleName}`}
          accept={uploadAcceptAttribute}
          className="sr-only"
          id={`module-file-${moduleId}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileName(file?.name ?? "");
            setFileMeta(file ? formatFileSize(file.size) : "");
            setMessage("");
            if (!file) {
              setState("idle");
              return;
            }

            const fileValidation = validateUploadFile(file);
            if (!fileValidation.ok) {
              setState("error");
              setMessage(fileValidation.error);
              return;
            }

            setState("ready");
          }}
          type="file"
        />
        <label
          className="flex min-h-12 min-w-0 cursor-pointer items-center rounded-md border border-[var(--border)] bg-white px-3 text-sm transition hover:border-slate-300 hover:bg-slate-50"
          htmlFor={`module-file-${moduleId}`}
        >
          <span className="shrink-0 font-semibold text-[var(--foreground)]">Выбрать файл</span>
          <span className="mx-3 h-5 w-px shrink-0 bg-[var(--border)]" />
          <span className="min-w-0 truncate text-[var(--muted)]">{fileName || "Файл не выбран"}</span>
          {fileMeta ? <span className="ml-3 shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">{fileMeta}</span> : null}
        </label>
        <button
          className="h-12 rounded-md bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state === "uploading" || !fileName}
          onClick={uploadFile}
          type="button"
        >
          {state === "uploading" ? "Загрузка..." : "Загрузить"}
        </button>
      </div>
      {message ? (
        <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${state === "error" ? "border-red-100 bg-red-50 text-[var(--danger)]" : "border-emerald-100 bg-emerald-50 text-[var(--success)]"}`}>
          {message}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        Разрешены: {allowedUploadExtensionsLabel}. До {maxUploadSizeLabel}.
      </p>
    </div>
  );
}
