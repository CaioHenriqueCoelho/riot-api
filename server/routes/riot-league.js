const express = require('express');
const router = express.Router();

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_BASE_AMERICAS = 'https://americas.api.riotgames.com';

/**
 * GET /api/riot/player/:region/:name/:tag
 * Retorna dados da SoloQ de um jogador, incluindo cálculo de vitórias necessárias.
 */
router.get('/player/:region/:name/:tag', async (req, res) => {
  const { region, name, tag } = req.params;
  console.log('Parâmetros recebidos:', { region, name, tag });

  if (!region || !name || !tag) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  try {
    const account = await fetchAccountData(name, tag);
    const leagueData = await fetchLeagueData(region, account.puuid);

    const soloQueueInfo = leagueData.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
    if (!soloQueueInfo) {
      return res.status(404).json({
        error: 'Informações da fila RANKED_SOLO_5x5 não encontradas'
      });
    }

    soloQueueInfo.cutoff = await fetchChallengerCutoff();
    soloQueueInfo.vitoriasNecessarias = calcularVitoriasNecessariasParaChallenger(soloQueueInfo).vitoriasNecessarias;

    return res.json({ info: soloQueueInfo });

  } catch (err) {
    console.error('[Erro /player]:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar dados do jogador' });
  }
});


// =======================
// Funções auxiliares
// =======================

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
    }

    throw error;
  }
}

async function fetchChallengerCutoff() {
  const url = `https://br1.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY,
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Status: ${response.status} - ${response.statusText} | Body: ${errorText}`);
    }

    const data = await response.json();

    if (!data?.entries || !Array.isArray(data.entries)) {
      throw new Error('Lista de jogadores ausente ou inválida na resposta da API');
    }

    const sorted = data.entries.sort((a, b) => b.leaguePoints - a.leaguePoints);
    const cutoffPlayer = sorted[199];

    if (!cutoffPlayer) {
      throw new Error('Não foi possível encontrar o jogador na posição 199');
    }

    return cutoffPlayer.leaguePoints;

  } catch (err) {
    console.error('[Erro em fetchChallengerCutoff]:', err.message);
    throw err;
  }
}

function calcularVitoriasNecessariasParaChallenger(jogador) {
  const elos = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER"];
  const ranks = ["IV", "III", "II", "I"];
  const pontosPorDivisao = 100;

  const tierAtual = jogador.tier?.toUpperCase() || '';
  const rankAtual = jogador.rank?.toUpperCase() || '';
  const lpAtual = jogador.leaguePoints || 0;
  const cutoff = jogador.cutoff || 0;

  const eloIndexAtual = elos.indexOf(tierAtual);
  const rankIndexAtual = ranks.indexOf(rankAtual);
  const eloIndexAlvo = elos.indexOf('MASTER');

  if (eloIndexAtual === -1 || rankIndexAtual === -1 || eloIndexAlvo <= eloIndexAtual) {
    return {
      error: 'Rank atual já é superior ou inválido',
      vitoriasNecessarias: 0
    };
  }

  let pontosFaltando = (ranks.length - rankIndexAtual - 1) * pontosPorDivisao + (pontosPorDivisao - lpAtual);

  for (let i = eloIndexAtual + 1; i < eloIndexAlvo; i++) {
    pontosFaltando += ranks.length * pontosPorDivisao;
  }

  pontosFaltando += cutoff;

  const vitoriasNecessarias = Math.ceil(pontosFaltando / 20);

  return {
    tier: tierAtual,
    rank: rankAtual,
    lp: lpAtual,
    cutoff,
    pontosFaltando,
    vitoriasNecessarias
  };
}

module.exports = router;
