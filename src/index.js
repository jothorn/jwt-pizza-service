const app = require("./service.js");
const logger = require("./logger.js");

const port = process.argv[2] || 3000;

process.on("uncaughtException", (error) => {
  logger.exceptionLogger(error, { source: "process.uncaughtException" });
});

process.on("unhandledRejection", (reason) => {
  const error =
    reason instanceof Error
      ? reason
      : new Error(`Unhandled rejection: ${reason}`);
  logger.exceptionLogger(error, { source: "process.unhandledRejection" });
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
