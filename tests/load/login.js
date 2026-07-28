import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const profile = __ENV.PROFILE || 'smoke';
const baseUrl = (__ENV.BASE_URL || 'http://localhost:5131').replace(/\/$/, '');
const email = __ENV.TEST_EMAIL || 'ahmet.yilmaz@gotur.com';
const password = __ENV.TEST_PASSWORD || 'Test123!';

const loginFailures = new Rate('login_failures');
const successfulLogins = new Counter('successful_logins');
const loginDuration = new Trend('login_duration', true);

const profiles = {
  smoke: {
    executor: 'shared-iterations',
    vus: Number(__ENV.VUS || 2),
    iterations: Number(__ENV.TOTAL_ITERATIONS || 20),
    maxDuration: __ENV.MAX_DURATION || '1m',
  },
  load: {
    executor: 'constant-arrival-rate',
    rate: Number(__ENV.RATE || 100),
    timeUnit: '1s',
    duration: __ENV.DURATION || '5m',
    preAllocatedVUs: Number(__ENV.PRE_ALLOCATED_VUS || 100),
    maxVUs: Number(__ENV.MAX_VUS || 500),
  },
  million: {
    executor: 'shared-iterations',
    vus: Number(__ENV.VUS || 1000),
    iterations: Number(__ENV.TOTAL_ITERATIONS || 1000000),
    maxDuration: __ENV.MAX_DURATION || '2h',
  },
};

if (!profiles[profile]) {
  throw new Error(`Unknown PROFILE=${profile}. Use smoke, load, or million.`);
}

export const options = {
  scenarios: {
    login: profiles[profile],
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    login_failures: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
  noConnectionReuse: false,
  userAgent: `gotur-k6/${profile}`,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
  const response = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth-login', profile },
      timeout: '10s',
    },
  );

  const passed = check(response, {
    'login returns 200': (r) => r.status === 200,
    'login returns a JWT': (r) => {
      if (r.status !== 200) return false;
      try {
        return Boolean(r.json('token'));
      } catch {
        return false;
      }
    },
  });

  loginFailures.add(!passed);
  loginDuration.add(response.timings.duration);
  if (passed) successfulLogins.add(1);

  if (profile === 'smoke') sleep(0.1);
}

export function handleSummary(data) {
  const summaryPath = __ENV.SUMMARY_PATH || 'results/login-summary.json';
  return {
    stdout: textSummary(data),
    [summaryPath]: JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const values = data.metrics.http_req_duration?.values || {};
  const failed = data.metrics.http_req_failed?.values?.rate || 0;
  const succeeded = data.metrics.successful_logins?.values?.count || 0;

  return [
    '',
    `Profile: ${profile}`,
    `Successful logins: ${succeeded}`,
    `Failure rate: ${(failed * 100).toFixed(2)}%`,
    `Latency p95: ${(values['p(95)'] || 0).toFixed(2)} ms`,
    `Latency p99: ${(values['p(99)'] || 0).toFixed(2)} ms`,
    '',
  ].join('\n');
}
