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
const requestCounts = {
  total: 0,
  byMethod: {},
};
let activeUsersCount = 0;
const authAttempts = { success: 0, failed: 0 };
let orderCreationSuccess = 0;
let orderCreationFailedChaos = 0;
let orderCreationFailedFactory = 0;
let pizzasSold = 0;
let pizzaCreationFailures = 0;
let pizzaRevenue = 0;
let totalServiceLatency = 0;
let totalServiceRequests = 0;
let totalPizzaCreationLatency = 0;
let totalPizzaCreationRequests = 0;

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

// Middleware to track requests and endpoint latency
function requestTracker(req, res, next) {
  const method = req.method?.toUpperCase() || "UNKNOWN";
  requestCounts.total++;
  requestCounts.byMethod[method] = (requestCounts.byMethod[method] || 0) + 1;

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    totalServiceLatency += duration;
    totalServiceRequests++;
  });

  next();
}

function setActiveUsers(count) {
  const parsedCount = Number(count);
  activeUsersCount = Number.isFinite(parsedCount)
    ? Math.max(0, Math.floor(parsedCount))
    : 0;
}

function trackAuthAttempt(success) {
  if (success) {
    authAttempts.success++;
  } else {
    authAttempts.failed++;
  }
}

function trackOrderCreation(outcome) {
  if (outcome === "success") {
    orderCreationSuccess++;
  } else if (outcome === "chaos") {
    orderCreationFailedChaos++;
  } else if (outcome === "factory") {
    orderCreationFailedFactory++;
  }
}

function trackPizzaPurchase(success, itemCount, revenue) {
  if (success) {
    pizzasSold += itemCount;
    pizzaRevenue += revenue;
  } else {
    pizzaCreationFailures++;
  }
}

function trackPizzaCreationLatency(durationMs) {
  totalPizzaCreationLatency += durationMs;
  totalPizzaCreationRequests++;
}

// This will periodically send metrics to Grafana
setInterval(() => {
  if (!metricsEnabled) {
    logMetricsDisabledOnce();
    return;
  }

  const metrics = [];
  metrics.push(
    createMetric("requests", requestCounts.total, "1", "sum", "asInt", {}),
  );
  Object.keys(requestCounts.byMethod).forEach((method) => {
    metrics.push(
      createMetric(
        "requests",
        requestCounts.byMethod[method],
        "1",
        "sum",
        "asInt",
        { method },
      ),
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
  metrics.push(
    createMetric("authAttempts", authAttempts.success, "1", "sum", "asInt", {
      result: "success",
    }),
  );
  metrics.push(
    createMetric("authAttempts", authAttempts.failed, "1", "sum", "asInt", {
      result: "failed",
    }),
  );
  metrics.push(
    createMetric("orderCreation", orderCreationSuccess, "1", "sum", "asInt", {
      result: "success",
    }),
  );
  metrics.push(
    createMetric(
      "orderCreation",
      orderCreationFailedChaos,
      "1",
      "sum",
      "asInt",
      { result: "failed", reason: "chaos" },
    ),
  );
  metrics.push(
    createMetric(
      "orderCreation",
      orderCreationFailedFactory,
      "1",
      "sum",
      "asInt",
      { result: "failed", reason: "factory" },
    ),
  );
  metrics.push(createMetric("pizzasSold", pizzasSold, "1", "sum", "asInt", {}));
  metrics.push(
    createMetric(
      "pizzaCreationFailures",
      pizzaCreationFailures,
      "1",
      "sum",
      "asInt",
      {},
    ),
  );
  metrics.push(
    createMetric("pizzaRevenue", pizzaRevenue, "1", "sum", "asDouble", {}),
  );
  metrics.push(
    createMetric(
      "serviceLatency",
      totalServiceLatency,
      "ms",
      "sum",
      "asDouble",
      {},
    ),
  );
  metrics.push(
    createMetric(
      "serviceRequests",
      totalServiceRequests,
      "1",
      "sum",
      "asInt",
      {},
    ),
  );
  metrics.push(
    createMetric(
      "pizzaCreationLatency",
      totalPizzaCreationLatency,
      "ms",
      "sum",
      "asDouble",
      {},
    ),
  );
  metrics.push(
    createMetric(
      "pizzaCreationRequests",
      totalPizzaCreationRequests,
      "1",
      "sum",
      "asInt",
      {},
    ),
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
  trackAuthAttempt,
  trackOrderCreation,
  trackPizzaPurchase,
  trackPizzaCreationLatency,
};
