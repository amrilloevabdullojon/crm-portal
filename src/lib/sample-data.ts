import type { PortalClinic } from "@/lib/domain";

export const sampleClinic: PortalClinic = {
  id: 1,
  name: "Demo Clinic",
  status: "data_collection",
  modules: [
    { id: 1, name: "Общая информация", status: "accepted", currentFileUrl: "#" },
    { id: 2, name: "Прайс", status: "review", currentFileUrl: "#" },
    { id: 3, name: "Врачи", status: "needs_revision", managerComment: "Нужен файл с актуальными должностями." },
    { id: 4, name: "Услуги", status: "collection" },
  ],
};
