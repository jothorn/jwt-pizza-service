const config = require("./config");

class Logger {
  loggingEnabled =
    process.env.NODE_ENV !== "test" &&
    Boolean(
      config.logging?.source &&
        config.logging?.endpointUrl &&
        config.logging?.accountId &&
        config.logging?.apiKey,
    );

  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: this.toLogString(req.body),
        resBody: this.toLogString(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, "http", logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  databaseLogger = (sql) => {
    this.log("info", "database", { sql });
  };

  factoryLogger = (reqBody, resBody, statusCode) => {
    const level = this.statusToLogLevel(statusCode);
    this.log(level, "factory", {
      statusCode,
      reqBody: this.toLogString(reqBody),
      resBody: this.toLogString(resBody),
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

  toLogString(value) {
    if (value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
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
    const redactStringValue = (value) => {
      if (value.startsWith("Bearer ")) {
        return "*****";
      }

      const trimmed = value.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          return JSON.stringify(redact(parsed));
        } catch {
          // Fall through to regex-based sanitization for non-JSON strings.
        }
      }

      return value
        .replace(
          /("(?:password|token|jwt|api[-_]?key|authorization|secret)"\s*:\s*")[^"]*(")/gi,
          "$1*****$2",
        )
        .replace(/(Bearer\s+)[^\s"]+/gi, "$1*****");
    };

    const redact = (value, key = "") => {
      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value === "string") {
        if (secretKeyMatcher.test(key)) {
          return "*****";
        }
        return redactStringValue(value);
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
    if (!this.loggingEnabled) {
      return;
    }

    const body = JSON.stringify(event);
    fetch(`${config.logging.endpointUrl}`, {
      method: "post",
      body: body,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          console.log("Failed to send log to Grafana");
        }
      })
      .catch((error) => {
        console.log("Error sending log to Grafana:", error?.message || error);
      });
  }
}
module.exports = new Logger();
