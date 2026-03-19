const config = require("./config");
const os = require("os");

const metricsConfig = config.metrics ?? {};
const metricsEnabled = Boolean(
  metricsConfig.source &&
  metricsConfig.endpointUrl &&
  metricsConfig.accountId &&
  metricsConfig.apiKey,
);
let hasLoggedMetricsDisabled = false;

// Metrics stored in memory
const requests = {};
let activeUsersCount = 0;

function logMetricsDisabledOnce() {
  if (!hasLoggedMetricsDisabled) {
    console.log("Metrics disabled: missing Grafana metrics configuration");
    hasLoggedMetricsDisabled = true;
  }
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

// Middleware to track requests
function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

function setActiveUsers(count) {
  const parsedCount = Number(count);
  activeUsersCount = Number.isFinite(parsedCount)
    ? Math.max(0, Math.floor(parsedCount))
    : 0;
}

// This will periodically send metrics to Grafana
setInterval(() => {
  if (!metricsEnabled) {
    logMetricsDisabledOnce();
    return;
  }

  const metrics = [];
  Object.keys(requests).forEach((endpoint) => {
    metrics.push(
      createMetric("requests", requests[endpoint], "1", "sum", "asInt", {
        endpoint,
      }),
    );
  });

  metrics.push(
    createMetric("cpu", getCpuUsagePercentage(), "%", "gauge", "asDouble", {}),
  );
  metrics.push(
    createMetric(
      "memory",
      getMemoryUsagePercentage(),
      "%",
      "gauge",
      "asDouble",
      {},
    ),
  );
  metrics.push(
    createMetric("activeUsers", activeUsersCount, "1", "gauge", "asInt", {}),
  );

  sendMetricToGrafana(metrics);
}, 10000);

function createMetric(
  metricName,
  metricValue,
  metricUnit,
  metricType,
  valueType,
  attributes,
) {
  attributes = { ...attributes, source: metricsConfig.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === "sum") {
    metric[metricType].aggregationTemporality =
      "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  if (!metricsEnabled) {
    logMetricsDisabledOnce();
    return;
  }

  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${metricsConfig.endpointUrl}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${metricsConfig.accountId}:${metricsConfig.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

module.exports = {
  requestTracker,
  setActiveUsers,
};
