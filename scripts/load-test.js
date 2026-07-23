import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Options: 100 Virtual Users running for exactly 1 minute
export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.05'],      // Less than 5% failed requests
    http_req_duration: ['p(95)<1500'],   // p95 response time under 1500ms
    checks: ['rate>0.95']                // At least 95% checks pass
  }
};

const BASE_URL = __ENV.BACKEND_URL || 'https://charityai-backend.onrender.com/api';

export default function () {
  // We prioritize safe, read-only public endpoints to avoid modifying backend data in production
  
  // Endpoint 1: Base/Health Check
  // Note: BASE_URL points to /api, root status is at BASE_URL minus '/api'
  const rootUrl = BASE_URL.replace(/\/api\/?$/, '');
  const rootRes = http.get(rootUrl);
  check(rootRes, {
    'root status is 200': (r) => r.status === 200,
    'root body is correct': (r) => r.body && r.body.includes('CharityAI API is running')
  });
  sleep(0.5);

  // Endpoint 2: Public NGO Requirements list
  const reqRes = http.get(`${BASE_URL}/ngo/requirements`);
  check(reqRes, {
    'requirements status is 200': (r) => r.status === 200,
    'requirements body is valid': (r) => r.json() !== null && Array.isArray(r.json().data || r.json())
  });
  sleep(0.5);

  // Endpoint 3: Nearby NGOs list query
  const nearbyRes = http.get(`${BASE_URL}/donations/nearby-ngos?longitude=80.27&latitude=13.08`);
  check(nearbyRes, {
    'nearby NGOs status is 200': (r) => r.status === 200,
    'nearby NGOs body is valid': (r) => r.json() !== null && Array.isArray(r.json().data || r.json())
  });
  sleep(1);
}
