const express = require('express');
const path = require('path');
const storeApiRoutes = require('./src/routes/storeApiRoutes');
const apiRoutes = require('./src/routes/apiRoutes');
const clientRoutes = require('./src/routes/clientRoutes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/store', storeApiRoutes);
app.use('/api', apiRoutes);
app.use('/', clientRoutes);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
