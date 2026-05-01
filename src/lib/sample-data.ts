import type { PortalClinic } from "@/lib/domain";

export const sampleClinic: PortalClinic = {
  id: 1,
  name: "Demo Clinic",
  status: "data_collection",
  modules: [
    {
      id: 1,
      name: "Общая информация",
      status: "accepted",
      currentFileUrl: "#",
      currentFile: {
        fileName: "Общая_информация_v1_20260430_1200.xlsx",
        fileUrl: "#",
        fileSizeBytes: 240000,
        isCurrent: true,
        createdAt: new Date().toISOString(),
      },
      files: [
        {
          fileName: "Общая_информация_v1_20260430_1200.xlsx",
          fileUrl: "#",
          fileSizeBytes: 240000,
          isCurrent: true,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      id: 2,
      name: "Прайс",
      status: "review",
      currentFileUrl: "#",
      currentFile: {
        fileName: "Прайс_v2_20260501_0900.xlsx",
        fileUrl: "#",
        fileSizeBytes: 510000,
        isCurrent: true,
        createdAt: new Date().toISOString(),
      },
      files: [
        {
          fileName: "Прайс_v2_20260501_0900.xlsx",
          fileUrl: "#",
          fileSizeBytes: 510000,
          isCurrent: true,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    { id: 3, name: "Врачи", status: "needs_revision", managerComment: "Нужен файл с актуальными должностями." },
    { id: 4, name: "Услуги", status: "collection" },
  ],
};
