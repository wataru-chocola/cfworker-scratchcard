import express from "express";

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 8080;

const app = express();

app.use("/", express.static("spa"));

app.listen(PORT, HOST, () => {
  console.log(`start at: http://${HOST}:${PORT}/`);
});
