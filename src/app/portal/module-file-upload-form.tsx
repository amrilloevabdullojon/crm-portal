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
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <input
          ref={inputRef}
          aria-label={`Файл для модуля ${moduleName}`}
          className="max-w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-muted)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
          onChange={() => {
            setState("ready");
            setMessage("");
          }}
          type="file"
        />
        <button
          className="h-10 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state === "uploading"}
          onClick={uploadFile}
          type="button"
        >
          {state === "uploading" ? "Загрузка..." : "Загрузить"}
        </button>
      </div>
      {message ? (
        <p className={`text-sm ${state === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
