const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const GAMES = require("./games-config");
const attachDevinettes = require("./games/devinettes");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// --- État en mémoire ---
// state[gameId].tables[tableIndex] = [ {id, pseudo}, ... ]
const state = {};
for (const gameId of Object.keys(GAMES)) {
  state[gameId] = {
    tables: Array.from({ length: GAMES[gameId].tables }, () => []),
  };
}

const devinettesHandlers = attachDevinettes(io, state);

// Retourne un snapshot public (sans exposer les sockets internes)
function publicSnapshot() {
  const snapshot = {};
  for (const [gameId, game] of Object.entries(GAMES)) {
    const tables = state[gameId].tables.map((players, i) => ({
      index: i,
      players: players.map((p) => p.pseudo),
      capacity: game.capacity,
      full: players.length >= game.capacity,
    }));
    const totalCapacity = game.tables * game.capacity;
    const totalPlayers = tables.reduce((sum, t) => sum + t.players.length, 0);
    snapshot[gameId] = {
      label: game.label,
      tables,
      available: totalPlayers < totalCapacity,
    };
  }
  return snapshot;
}

function broadcastState() {
  io.emit("state", publicSnapshot());
}

io.on("connection", (socket) => {
  socket.emit("state", publicSnapshot());

  socket.data.pseudo = null;
  socket.data.gameId = null;
  socket.data.tableIndex = null;

  socket.on("set-pseudo", (pseudo) => {
    socket.data.pseudo = String(pseudo || "").slice(0, 20).trim() || "Joueur";
  });

  socket.on("join-table", ({ gameId, tableIndex }) => {
    const game = GAMES[gameId];
    if (!game) return;
    if (!socket.data.pseudo) {
      socket.emit("error-msg", "Choisis un pseudo avant de rejoindre une table.");
      return;
    }
    leaveCurrentTable(socket);

    const table = state[gameId].tables[tableIndex];
    if (!table) return;
    if (table.length >= game.capacity) {
      socket.emit("error-msg", "Cette table est déjà pleine.");
      return;
    }

    table.push({ id: socket.id, pseudo: socket.data.pseudo });
    socket.data.gameId = gameId;
    socket.data.tableIndex = tableIndex;

    socket.join(`${gameId}:${tableIndex}`);
    broadcastState();

    if (table.length >= game.capacity) {
      io.to(`${gameId}:${tableIndex}`).emit("table-full", {
        gameId,
        tableIndex,
        players: table.map((p) => p.pseudo),
      });
      devinettesHandlers.onTableFull(gameId, tableIndex);
    }
  });

  socket.on("leave-table", () => {
    leaveCurrentTable(socket);
    broadcastState();
  });

  socket.on("devinettes:guess", (data) => {
    devinettesHandlers.onGuess(socket, data);
  });

  socket.on("disconnect", () => {
    leaveCurrentTable(socket);
    broadcastState();
  });
});

function leaveCurrentTable(socket) {
  const { gameId, tableIndex } = socket.data;
  if (gameId == null || tableIndex == null) return;
  const table = state[gameId]?.tables[tableIndex];
  if (table) {
    const i = table.findIndex((p) => p.id === socket.id);
    if (i !== -1) table.splice(i, 1);
  }
  socket.leave(`${gameId}:${tableIndex}`);
  devinettesHandlers.onLeaveTable(gameId, tableIndex, socket.id);
  socket.data.gameId = null;
  socket.data.tableIndex = null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
