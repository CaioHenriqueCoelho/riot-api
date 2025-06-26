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
    const todayInfo = await fetchTodayInfo(name,tag);
    if (!mmrData) {
      return res.status(404).json({ error: 'Dados de MMR não encontrados' });
    }

    return res.json({ account, mmr: mmrData, today: todayInfo });
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

async function fetchTodayInfo(name, tag) {
  const VALORANT_API_TOKEN = process.env.HENRIKDEV_API_TOKEN;
  const url = `https://api.henrikdev.xyz/valorant/v1/lifetime/mmr-history/br/${name}/${tag}?api_key=${VALORANT_API_TOKEN}`;

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (!result.data || !Array.isArray(result.data)) {
      console.error("Dados inválidos ou ausentes.");
      return [];
    }

    const matches = result.data;
    const todayDate = getLocalDateString();

    const todaysMatches = matches.filter(match => {
      const matchDate = match.date.split('T')[0];
      console.log("data da api",match.date.split('T')[0]);
      return matchDate === todayDate;
    });

    const mmrChanges = todaysMatches.map(m => m.last_mmr_change);
    const mmrTotal = mmrChanges.reduce((sum, val) => sum + val, 0);

    const wins = mmrChanges.filter(val => val > 0).length;
    const loses = mmrChanges.filter(val => val < 0).length;
    const totalGames = wins + loses;

    const resultado = {
      partidas: todaysMatches.length,
      mmr_total: mmrTotal,
      status: getMMRStatus(mmrTotal),
      wins,
      loses,
      winrate: totalGames > 0 ? `${((wins / totalGames) * 100).toFixed(2)}%` : '0%'
    };
    console.log("resultado",resultado);


    return resultado;

  } catch (error) {
    console.error("Erro ao buscar os dados:", error);
    return [];
  }
}

// Função utilitária para pegar a data local no formato YYYY-MM-DD
function getLocalDateString(date = new Date()) {
  // Força o horário do Brasil (GMT-3)
  const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000; // 3 horas em milissegundos
  const brazilTime = new Date(date.getTime() - BRAZIL_OFFSET_MS);
  return brazilTime.toISOString().split('T')[0];
}

// Função para determinar o status do mmr
function getMMRStatus(mmrTotal) {
  if (mmrTotal > 0) return 'positivo';
  if (mmrTotal < 0) return 'negativo';
  return 'neutro';
}


module.exports = router;
