export const clinicStatuses = {
  data_collection: "Сбор данных",
  in_progress_sla: "В работе (SLA)",
  partially_delivered: "Частично выданы",
  completed: "Выполнено",
} as const;

export const moduleStatuses = {
  collection: "Сбор",
  review: "На проверке",
  needs_revision: "Требуются правки",
  accepted: "Принято",
} as const;

export type UserRole = "client" | "manager" | "admin";
export type ClinicStatus = keyof typeof clinicStatuses;
export type ModuleStatus = keyof typeof moduleStatuses;

export type PortalModuleFile = {
  id?: number;
  fileName: string;
  fileUrl: string;
  fileSizeBytes?: number | null;
  isCurrent: boolean;
  createdAt: string;
};

export type PortalModule = {
  id: number;
  name: string;
  status: ModuleStatus;
  managerComment?: string;
  currentFileUrl?: string;
  currentFile?: PortalModuleFile;
  files?: PortalModuleFile[];
};

export type PortalClinic = {
  id: number;
  name: string;
  status: ClinicStatus;
  driveFolderUrl?: string;
  slaStartedAt?: string;
  modules: PortalModule[];
};
