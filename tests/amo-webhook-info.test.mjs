import assert from "node:assert/strict";
import test from "node:test";
import { extractAmoWebhookInfoFromPayload } from "../src/lib/amocrm/webhook-info.mjs";

test("extractAmoWebhookInfoFromPayload marks lead creation as add", () => {
  assert.deepEqual(
    extractAmoWebhookInfoFromPayload({
      "leads[add][0][id]": "40507422",
      "leads[add][0][name]": "New Clinic",
      "leads[add][0][status_id]": "84088646",
    }),
    {
      action: "add",
      dealId: "40507422",
      dealName: "New Clinic",
      statusId: "84088646",
    },
  );
});

test("extractAmoWebhookInfoFromPayload marks pipeline movement as status", () => {
  assert.deepEqual(
    extractAmoWebhookInfoFromPayload({
      "leads[status][0][id]": 40507422,
      "leads[status][0][name]": "New Clinic",
      "leads[status][0][status_id]": 84088646,
    }),
    {
      action: "status",
      dealId: "40507422",
      dealName: "New Clinic",
      statusId: "84088646",
    },
  );
});
