const express = require('express');
const router = express.Router();
const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_BASE_AMERICAS = 'https://americas.api.riotgames.com';
const CHALLENGER_API_URL = 'https://b2c-api-cdn.deeplol.gg/summoner/summoner_rank';

/**
 * GET /api/riot/player/:region/:name/:tag
 * Retorna PUUID e dados da SoloQ de um jogador.
 */
router.get('/player/:region/:name/:tag', async (req, res) => {
  const { region, name, tag } = req.params;
  console.log("Parâmetros recebidos:", { region, name, tag });

  if (!region || !name || !tag) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  try {
    const account = await fetchAccountData(name, tag);

    const leagueData = await fetchLeagueData(region, account.puuid);

    // Filtrar apenas a fila solo/duo
    const soloQueueInfo = leagueData.find(
      entry => entry.queueType === 'RANKED_SOLO_5x5'
    );

    // Se não houver info para fila solo
    if (!soloQueueInfo) {
      return res.status(404).json({
        error: 'Informações da fila RANKED_SOLO_5x5 não encontradas'
      });
    }

    // Buscar e adicionar cutoff
    soloQueueInfo.cutoff = await fetchChallengerCutoff(region.toUpperCase());
    console.log(soloQueueInfo.cutoff);

    return res.json({ info: soloQueueInfo });
  } catch (err) {
    console.error('[Erro /player]:', err.message);
    return res.status(500).json({
      error: 'Erro ao buscar dados do jogador'
    });
  }
});

/**
 * GET /api/riot/challenger-cutoff/:region
 * Retorna o cutoff do Challenger na região especificada.
 */
router.get('/challenger-cutoff/:region', async (req, res) => {
  const region = req.params.region;

  if (!region) {
    return res.status(400).json({ error: 'Região não fornecida' });
  }

  try {
    const cutoff = await fetchChallengerCutoff(region.toUpperCase());
    return res.json({ cutoff });
  } catch (err) {
    console.error('[Erro /challenger-cutoff]:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar cutoff' });
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

async function fetchLeagueData(region, puuid, tentativas = 5) {
  const url = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;

  try {
    const response = await fetch(url, {
      headers: { 'X-Riot-Token': RIOT_API_KEY },
    });

    if (!response.ok) {
      throw new Error('Falha ao buscar dados de liga do jogador');
    }

    return await response.json();
  } catch (error) {
    if (tentativas > 1) {
      console.warn(`Erro ao buscar dados, tentando novamente em 3 segundos... Tentativas restantes: ${tentativas - 1}`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return fetchLeagueData(region, puuid, tentativas - 1);
    } else {
      throw error; // após esgotar tentativas, lança o erro
    }
  }
}

async function fetchChallengerCutoff(region) {
  const url = `${CHALLENGER_API_URL}?platform_id=${region}&lane=All&page=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Falha ao buscar cutoff do Challenger');
  }

  const data = await response.json();
  return data.challenger_cut_off;
}

module.exports = router;
