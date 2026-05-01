import type { AdminClinic } from "@/lib/db/admin";
import { getActualFolderUrl, hasGoogleDriveConfig } from "@/lib/google-drive/client";
import { sendSlackMessage } from "@/lib/slack/client";

function escapeSlackText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatLink(label: string, url?: string) {
  const safeLabel = escapeSlackText(label);
  return url ? `<${url}|${safeLabel}>` : safeLabel;
}

function getCurrentFileLines(clinic: AdminClinic) {
  const lines = clinic.modules
    .map((module) => {
      const currentFile = module.files.find((file) => file.isCurrent);
      if (!currentFile) return null;
      return `• ${escapeSlackText(module.name)}: ${formatLink(currentFile.fileName, currentFile.fileUrl)}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join("\n") : "Файлы пока не загружены.";
}

async function getActualFolderLine(clinic: AdminClinic) {
  if (hasGoogleDriveConfig()) {
    const actualFolderUrl = await getActualFolderUrl(clinic.name);
    return formatLink("папка АКТУАЛЬНО", actualFolderUrl);
  }

  return clinic.driveFolderUrl ? formatLink("папка Drive", clinic.driveFolderUrl) : "папка Drive не настроена";
}

export async function sendAccessRequestToSlack(input: {
  clinic: AdminClinic;
  managerName: string;
}) {
  const generalInfo = input.clinic.modules.find((module) => module.name.toLowerCase().includes("общ"));
  const generalFile = generalInfo?.files.find((file) => file.isCurrent);
  const actualFolderLine = await getActualFolderLine(input.clinic);

  await sendSlackMessage(
    [
      `:key: *СРОЧНАЯ ЗАЯВКА НА ДОСТУПЫ: ${escapeSlackText(input.clinic.name)}*`,
      `AmoCRM deal: ${escapeSlackText(String(input.clinic.amoDealId ?? "не указан"))}`,
      `Общая информация: ${generalFile ? formatLink(generalFile.fileName, generalFile.fileUrl) : "файл не найден"}`,
      `Актуальные файлы: ${actualFolderLine}`,
      `Менеджер: ${escapeSlackText(input.managerName)}`,
    ].join("\n"),
  );
}

export async function sendSetupRequestToSlack(input: {
  clinic: AdminClinic;
  managerName: string;
  additionalInfo: string;
}) {
  const actualFolderLine = await getActualFolderLine(input.clinic);

  await sendSlackMessage(
    [
      `:rocket: *ЗАЯВКА НА НАСТРОЙКУ: ${escapeSlackText(input.clinic.name)}*`,
      `AmoCRM deal: ${escapeSlackText(String(input.clinic.amoDealId ?? "не указан"))}`,
      `Актуальные файлы: ${actualFolderLine}`,
      `Файлы по блокам:\n${getCurrentFileLines(input.clinic)}`,
      `Доп. информация: ${escapeSlackText(input.additionalInfo || "не указана")}`,
      `Менеджер: ${escapeSlackText(input.managerName)}`,
    ].join("\n"),
  );
}
