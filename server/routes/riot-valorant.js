const express = require('express');
const router = express.Router();
const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_BASE_AMERICAS = 'https://americas.api.riotgames.com';

/**
 * GET /api/valorant/player/:region/:name/:tag
 * Retorna dados de conta e MMR do jogador de Valorant.
 */
router.get('/player/:region/:name/:tag', async (req, res) => {
  const { region, name, tag } = req.params;
  console.log("Parâmetros recebidos:", { region, name, tag });

  if (!region || !name || !tag) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  try {
    const account = await fetchAccountData(name, tag);
    const mmrData = await fetchValorantMMR(region, name, tag);

    if (!mmrData) {
      return res.status(404).json({ error: 'Dados de MMR não encontrados' });
    }

    return res.json({ account, mmr: mmrData });
  } catch (err) {
    console.error('[Erro /valorant/player]:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar dados do jogador' });
  }
});

// === Funções auxiliares ===

async function fetchAccountData(name, tag) {
  const url = `${RIOT_BASE_AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?api_key=${RIOT_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Falha ao buscar conta do jogador');
  }

  return response.json();
}

async function fetchValorantMMR(region, name, tag) {
const VALORANT_API_TOKEN = process.env.HENRIKDEV_API_TOKEN; // coloque isso no seu .env se for usar 
  const url = `https://api.henrikdev.xyz/valorant/v1/mmr/br/${name}/${tag}?api_key=${VALORANT_API_TOKEN}`;
  console.log(url);
  console.log(VALORANT_API_TOKEN);
  const headers = {
    'Content-Type': 'application/json',
  };


  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchValorantMMR] Erro ${response.status}: ${response.statusText}`);
    console.error(`[fetchValorantMMR] Resposta da API: ${errorText}`);
    throw new Error(`Falha ao buscar dados de MMR do Valorant - ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

module.exports = router;
