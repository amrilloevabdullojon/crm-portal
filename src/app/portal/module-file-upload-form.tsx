"use client";

import { useRef, useState } from "react";

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

  async function uploadFile() {
    const file = inputRef.current?.files?.[0];

    if (!file) {
      setState("error");
      setMessage("Выберите файл перед загрузкой.");
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
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="w-full max-w-xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          aria-label={`Файл для модуля ${moduleName}`}
          className="sr-only"
          id={`module-file-${moduleId}`}
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name ?? "");
            setState("ready");
            setMessage("");
          }}
          type="file"
        />
        <label
          className="flex h-10 min-w-0 flex-1 cursor-pointer items-center rounded-md border border-[var(--border)] bg-white px-3 text-sm transition hover:border-slate-300 hover:bg-slate-50"
          htmlFor={`module-file-${moduleId}`}
        >
          <span className="shrink-0 font-semibold text-[var(--foreground)]">Выбрать файл</span>
          <span className="ml-3 truncate text-[var(--muted)]">{fileName || "Файл не выбран"}</span>
        </label>
        <button
          className="h-10 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state === "uploading" || !fileName}
          onClick={uploadFile}
          type="button"
        >
          {state === "uploading" ? "Загрузка..." : "Загрузить"}
        </button>
      </div>
      {message ? (
        <p className={`mt-2 text-sm ${state === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
