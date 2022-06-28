import express from "express";
import http from "http";

import { createWSS } from "./ws-card";

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 8080;

const app = express();
app.use("/", express.static("spa"));

const server = http.createServer(app);
createWSS(server, "./assets");

server.listen(PORT, HOST, () => {
  console.log(`start at: http://${HOST}:${PORT}/`);
});
