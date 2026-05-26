import { HTTP_PORT } from "@repo/backend-common/config";
import { createApp } from "./app";

const app = createApp();

app.listen(HTTP_PORT, () => {
  console.log(`[http-backend] listening on port ${HTTP_PORT}`);
});
