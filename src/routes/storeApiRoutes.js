const express = require('express');
const storeApiController = require('../controllers/storeApiController');

const router = express.Router();

router.post(
  '/pedidos',
  storeApiController.rateLimitSubmission,
  storeApiController.createOrder
);
router.post(
  '/servicio-tecnico',
  storeApiController.rateLimitSubmission,
  storeApiController.createRepairRequest
);

module.exports = router;
