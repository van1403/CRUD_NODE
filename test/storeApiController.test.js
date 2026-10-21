const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createOrder,
  createRepairRequest,
  rateLimitSubmission
} = require('../src/controllers/storeApiController');

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('rejects checkout without a customer name before accessing Supabase', async () => {
  const req = {
    body: {
      nombre: '',
      telefono: '55555555',
      productos: [{ id_producto: 1, cantidad: 1 }]
    }
  };
  const res = mockResponse();

  await createOrder(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /nombre/i);
});

test('rejects duplicate or out-of-range quantities in a checkout', async () => {
  const duplicateRes = mockResponse();
  await createOrder({
    body: {
      nombre: 'Cliente de prueba',
      telefono: '55555555',
      productos: [
        { id_producto: 1, cantidad: 1 },
        { id_producto: 1, cantidad: 1 }
      ]
    }
  }, duplicateRes);
  assert.equal(duplicateRes.statusCode, 400);

  const quantityRes = mockResponse();
  await createOrder({
    body: {
      nombre: 'Cliente de prueba',
      telefono: '55555555',
      productos: [{ id_producto: 1, cantidad: 100 }]
    }
  }, quantityRes);
  assert.equal(quantityRes.statusCode, 400);
});

test('requires a useful description for a technical request', async () => {
  const res = mockResponse();
  await createRepairRequest({
    body: {
      nombre: 'Cliente de prueba',
      telefono: '55555555',
      equipo: 'Laptop',
      descripcion: 'No'
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /describe/i);
});

test('rate-limits public order and repair submissions', () => {
  const req = {
    ip: `test-rate-limit-${Date.now()}`,
    socket: { remoteAddress: '127.0.0.1' }
  };
  const res = mockResponse();
  let allowed = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    rateLimitSubmission(req, res, () => {
      allowed += 1;
    });
  }
  rateLimitSubmission(req, res, () => {
    allowed += 1;
  });

  assert.equal(allowed, 5);
  assert.equal(res.statusCode, 429);
});
