console.log("Iniciando o servidor...");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const riotRoutes = require('./routes/riot-league');
const valorantRoutes = require('./routes/riot-valorant');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


app.use('/api/riot-league', riotRoutes);
app.use('/api/riot-valorant', valorantRoutes);

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
