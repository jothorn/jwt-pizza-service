const config = require("./config");

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, "http", logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  databaseLogger = (sql, params) => {
    this.log("info", "database", {
      sql,
      params: this.redactDatabaseParams(sql, params),
    });
  };

  factoryLogger = (reqBody, resBody, statusCode) => {
    const level = this.statusToLogLevel(statusCode);
    this.log(level, "factory", {
      statusCode,
      reqBody,
      resBody,
    });
  };

  exceptionLogger = (error, context = {}) => {
    this.log("error", "exception", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      ...context,
    });
  };

  redactDatabaseParams(sql, params) {
    if (!Array.isArray(params)) {
      return params;
    }

    const sensitiveSqlMatcher =
      /\b(token|password|secret|api[-_]?key|authorization|jwt)\b/i;
    if (!sensitiveSqlMatcher.test(String(sql))) {
      return params;
    }

    return params.map(() => "*****");
  }

  log(level, type, logData) {
    const labels = {
      component: config.logging.source,
      level: level,
      type: type,
    };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    const secretKeyMatcher =
      /(password|token|jwt|api[-_]?key|authorization|secret)/i;

    const redact = (value, key = "") => {
      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value === "string") {
        if (secretKeyMatcher.test(key) || value.startsWith("Bearer ")) {
          return "*****";
        }
        return value;
      }

      if (typeof value !== "object") {
        return value;
      }

      if (Array.isArray(value)) {
        return value.map((item) => redact(item));
      }

      const sanitized = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (secretKeyMatcher.test(nestedKey)) {
          sanitized[nestedKey] = "*****";
        } else {
          sanitized[nestedKey] = redact(nestedValue, nestedKey);
        }
      }
      return sanitized;
    };

    return JSON.stringify(redact(logData));
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.endpointUrl}`, {
      method: "post",
      body: body,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log("Failed to send log to Grafana");
    });
  }
}
module.exports = new Logger();
