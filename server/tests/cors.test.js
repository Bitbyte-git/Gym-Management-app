const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config/env');

test('CORS allows local Vite origins outside production', () => {
  const localOrigins = ['http://localhost:5173', 'http://localhost:5174'];

  if (config.nodeEnv === 'production') {
    for (const origin of localOrigins) {
      assert.equal(config.cors.origin.includes(origin), false);
    }
    return;
  }

  for (const origin of localOrigins) {
    assert.ok(config.cors.origin.includes(origin), `${origin} should be allowed`);
  }
});

test('login preflight returns CORS headers for local Vite origins', async (t) => {
  const { app } = require('../index');
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  for (const origin of ['http://localhost:5173', 'http://localhost:5174']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('access-control-allow-headers'), /content-type/i);
  }
});

test('registration preflight allows the registration token header', async (t) => {
  const { app } = require('../index');
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/registration/health-details`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-registration-token',
    },
  });

  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-headers'), /x-registration-token/i);
});

test('CORS preflight and actual requests allow all origins', async (t) => {
  const { app } = require('../index');
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const testOrigins = [
    'https://gym-management-app-wine-ten.vercel.app',
    'https://preview-deploy.vercel.app',
    'http://localhost:3000',
    'http://localhost:5175',
    'http://127.0.0.1:8080',
    'https://custom-client-domain.org',
  ];

  for (const origin of testOrigins) {
    // OPTIONS Preflight
    const preflight = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
    assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);

    // Cross-origin request
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`, {
      headers: { Origin: origin },
    });
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
});
