const express = require('express');
const clientController = require('../controllers/clientController');
const authController = require('../controllers/authController');
const storeController = require('../controllers/storeController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/login', authController.loginPage);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/', storeController.home);
router.get('/carrito', storeController.cart);
router.get('/servicio-tecnico', storeController.serviceRequestForm);
router.use(requireAuth);

router.get('/admin/productos', storeController.adminProducts);
router.post('/admin/productos', storeController.saveProduct);
router.post('/admin/productos/:id/actualizar', storeController.saveProduct);
router.post('/admin/productos/:id/eliminar', storeController.deleteProduct);
router.post('/admin/productos/:id/estado', storeController.updateProductStatus);
router.get('/admin/pedidos', storeController.adminOrders);
router.post('/admin/pedidos/:id/estado', storeController.updateOrderStatus);
router.get('/admin/servicio-tecnico', storeController.adminRepairs);
router.post('/admin/servicio-tecnico/:id/estado', storeController.updateRepairStatus);

router.get('/clientes', clientController.dashboard);
router.post('/clientes', clientController.createClient);
router.get('/clientes/solicita', clientController.showServiceRequest);
router.post('/clientes/solicita', clientController.createServiceRequest);
router.get('/clientes/:id', clientController.details);
router.post('/clientes/:id/actualizar', clientController.updateClientPage);
router.post('/clientes/:id/eliminar', clientController.deleteClientPage);

module.exports = router;
