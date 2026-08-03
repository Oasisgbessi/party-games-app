const WORDS = require("./devinettes-words");
const ROUND_DURATION = 60000; // 60s par manche

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

module.exports = function attachDevinettes(io, state) {
  const games = {}; // tableIndex -> { order, meneurPos, word, scores, usedWords, timer }

  const room = (tableIndex) => `devinettes:${tableIndex}`;

  function scoreList(game, table) {
    return table
      .map((p) => ({ pseudo: p.pseudo, points: game.scores[p.id] || 0 }))
      .sort((a, b) => b.points - a.points);
  }

  function pickWord(game) {
    const remaining = WORDS.filter((w) => !game.usedWords.has(w));
    const pool = remaining.length ? remaining : WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    game.usedWords.add(word);
    return word;
  }

  function startRound(tableIndex) {
    const game = games[tableIndex];
    if (!game) return;
    const table = state.devinettes.tables[tableIndex];

    // Retire de la rotation les joueurs qui sont partis entre-temps
    game.order = game.order.filter((id) => table.some((p) => p.id === id));

    if (game.order.length < 2) {
      endGame(tableIndex, "Pas assez de joueurs pour continuer.");
      return;
    }
    if (game.meneurPos >= game.order.length) {
      endGame(tableIndex);
      return;
    }

    const meneurId = game.order[game.meneurPos];
    const meneurPlayer = table.find((p) => p.id === meneurId);
    if (!meneurPlayer) {
      game.meneurPos++;
      return startRound(tableIndex);
    }

    game.word = pickWord(game);
    game.roundEndsAt = Date.now() + ROUND_DURATION;

    const meneurSocket = io.sockets.sockets.get(meneurId);
    if (meneurSocket) {
      meneurSocket.emit("devinettes:you-are-meneur", {
        tableIndex,
        word: game.word,
        endsAt: game.roundEndsAt,
        round: game.meneurPos + 1,
        totalRounds: game.order.length,
      });
    }

    io.to(room(tableIndex)).emit("devinettes:round-start", {
      tableIndex,
      meneurId,
      meneurPseudo: meneurPlayer.pseudo,
      wordLength: game.word.length,
      endsAt: game.roundEndsAt,
      round: game.meneurPos + 1,
      totalRounds: game.order.length,
      scores: scoreList(game, table),
    });

    clearTimeout(game.timer);
    game.timer = setTimeout(() => endRound(tableIndex, null), ROUND_DURATION);
  }

  function endRound(tableIndex, winnerId) {
    const game = games[tableIndex];
    if (!game) return;
    clearTimeout(game.timer);
    const table = state.devinettes.tables[tableIndex];

    if (winnerId) {
      game.scores[winnerId] = (game.scores[winnerId] || 0) + 2;
      const meneurId = game.order[game.meneurPos];
      game.scores[meneurId] = (game.scores[meneurId] || 0) + 1;
    }

    const winner = table.find((p) => p.id === winnerId);
    io.to(room(tableIndex)).emit("devinettes:round-end", {
      tableIndex,
      word: game.word,
      winnerPseudo: winner ? winner.pseudo : null,
      scores: scoreList(game, table),
    });

    game.word = null;
    game.meneurPos++;
    setTimeout(() => startRound(tableIndex), 4000);
  }

  function endGame(tableIndex, reason) {
    const game = games[tableIndex];
    if (!game) return;
    clearTimeout(game.timer);
    const table = state.devinettes.tables[tableIndex];

    io.to(room(tableIndex)).emit("devinettes:game-over", {
      tableIndex,
      reason: reason || null,
      scores: scoreList(game, table),
    });

    delete games[tableIndex];
    state.devinettes.tables[tableIndex] = []; // libère la table pour une nouvelle partie
  }

  return {
    onTableFull(gameId, tableIndex) {
      if (gameId !== "devinettes") return;
      const table = state.devinettes.tables[tableIndex];
      games[tableIndex] = {
        order: table.map((p) => p.id),
        meneurPos: 0,
        word: null,
        roundEndsAt: null,
        scores: {},
        usedWords: new Set(),
        timer: null,
      };
      table.forEach((p) => io.sockets.sockets.get(p.id)?.join(room(tableIndex)));
      startRound(tableIndex);
    },

    onGuess(socket, { tableIndex, guess }) {
      const game = games[tableIndex];
      if (!game || !game.word) return;
      const meneurId = game.order[game.meneurPos];
      if (socket.id === meneurId) return; // le meneur ne devine pas sa propre manche

      if (normalize(guess) === normalize(game.word)) {
        endRound(tableIndex, socket.id);
      } else {
        socket.to(room(tableIndex)).emit("devinettes:wrong-guess", {
          tableIndex,
          pseudo: socket.data.pseudo,
          guess,
        });
      }
    },

    onLeaveTable(gameId, tableIndex, socketId) {
      if (gameId !== "devinettes") return;
      const game = games[tableIndex];
      if (!game) return;

      const wasMeneur = game.order[game.meneurPos] === socketId;
      game.order = game.order.filter((id) => id !== socketId);

      if (game.order.length < 2) {
        endGame(tableIndex, "Un joueur est parti, pas assez de monde pour continuer.");
        return;
      }
      if (wasMeneur) {
        clearTimeout(game.timer);
        startRound(tableIndex);
      }
    },
  };
};
