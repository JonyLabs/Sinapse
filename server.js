const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// ── Card definitions ──

const CARD_NAMES = [
  'amarelo','animal','antigo','ar','arma','assustador','azul','barato','branco',
  'caro','casa','cidade','comida','corpo','devagar','engraçado','escola','espaço',
  'esporte','fantasia','feriado','filme','fofo','fogo','forte','frio','grande',
  'homem','jogo','laranja','lugar','líquido','marrom','moda','mulher','musica',
  'natureza','novo','objeto','pequeno','pessoa','praia','preto','quadrado','quente',
  'rapido','redondo','religião','romance','roxo','saúde','sólido','tecnologia',
  'televisao','terra','trabalho','triangular','verde','vermelho','água'
];

const CONFIG = {
  HAND_SIZE: 5,
  MAX_HAND: 7,
  MAX_POOL: 4,
};

// ── Room Manager ──

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createRoom(hostSocketId, hostName) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId: hostSocketId,
    players: [{
      id: hostSocketId,
      name: hostName,
      hand: [],
      score: 0,
      connected: true,
    }],
    state: 'lobby', // lobby | playing | ended
    deck: [],
    conceptPool: [],
    currentPlayerIndex: 0,
    phase: 'play', // play | vote
    pendingPlay: null,
    votes: {},
    history: [],
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, playerName) {
  const room = rooms.get(code);
  if (!room) return { error: 'Sala não encontrada' };
  if (room.state !== 'lobby') return { error: 'Jogo já iniciado' };
  if (room.players.length >= 4) return { error: 'Sala cheia (máx. 4)' };
  if (room.players.some(p => p.id === socketId)) return { error: 'Já está na sala' };

  room.players.push({
    id: socketId,
    name: playerName,
    hand: [],
    score: 0,
    connected: true,
  });
  return { room };
}

function dealCards(room, hand, n) {
  for (let i = 0; i < n; i++) {
    if (hand.length >= CONFIG.MAX_HAND) break;
    if (room.deck.length > 0) hand.push(room.deck.pop());
  }
}

function startGame(room) {
  room.state = 'playing';
  room.deck = shuffleArray([...CARD_NAMES]);
  room.conceptPool = [];
  room.currentPlayerIndex = 0;
  room.phase = 'play';
  room.pendingPlay = null;
  room.votes = {};
  room.history = [];
  room.players.forEach(p => {
    p.hand = [];
    p.score = 0;
    dealCards(room, p.hand, CONFIG.HAND_SIZE);
  });
}

function getPlayerState(room, socketId) {
  const playerIndex = room.players.findIndex(p => p.id === socketId);
  const player = room.players[playerIndex];

  const opponents = room.players.map((p, i) => ({
    name: p.name,
    cardCount: p.hand.length,
    score: p.score,
    index: i,
    isCurrentTurn: i === room.currentPlayerIndex,
    connected: p.connected,
  }));

  const myVote = room.votes[socketId];
  const isMyTurn = playerIndex === room.currentPlayerIndex;
  const isVoter = room.phase === 'vote' &&
    room.pendingPlay &&
    room.pendingPlay.playerId !== socketId &&
    room.votes[socketId] === undefined;

  return {
    roomCode: room.code,
    roomState: room.state,
    myIndex: playerIndex,
    myHand: player ? player.hand : [],
    myScore: player ? player.score : 0,
    myName: player ? player.name : '',
    opponents,
    conceptPool: room.conceptPool,
    deckCount: room.deck.length,
    currentPlayerIndex: room.currentPlayerIndex,
    currentPlayerName: room.players[room.currentPlayerIndex]?.name || '',
    phase: room.phase,
    isMyTurn,
    isHost: socketId === room.hostId,
    pendingPlay: room.pendingPlay ? {
      card: room.pendingPlay.card,
      phrase: room.pendingPlay.phrase,
      playerName: room.pendingPlay.playerName,
      playerIndex: room.pendingPlay.playerIndex,
    } : null,
    isVoter,
    myVote: myVote || null,
    votes: buildVoteSummary(room),
    history: room.history.slice(0, 10),
    players: room.players.map(p => ({ name: p.name, id: p.id, connected: p.connected })),
  };
}

function buildVoteSummary(room) {
  if (!room.pendingPlay) return [];
  return room.players
    .filter(p => p.id !== room.pendingPlay.playerId)
    .map(p => ({
      name: p.name,
      voted: room.votes[p.id] !== undefined,
      vote: room.votes[p.id] || null,
    }));
}

function allVotesCast(room) {
  if (!room.pendingPlay) return false;
  const voters = room.players.filter(p => p.id !== room.pendingPlay.playerId && p.connected);
  return voters.every(p => room.votes[p.id] !== undefined);
}

function resolveVotes(room) {
  const yes = Object.values(room.votes).filter(v => v === 'yes').length;
  const total = Object.keys(room.votes).length;
  return total > 0 && yes >= total - yes;
}

function advanceTurn(room) {
  const total = room.players.length;
  for (let i = 0; i < total; i++) {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % total;
    if (room.players[room.currentPlayerIndex].connected) break;
  }
}

function checkWin(room) {
  return room.players.find(p => p.hand.length === 0);
}

function broadcastState(room) {
  room.players.forEach(p => {
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit('state-update', getPlayerState(room, p.id));
  });
}

function broadcastLobby(room) {
  const lobbyData = {
    roomCode: room.code,
    players: room.players.map(p => ({ name: p.name, id: p.id, connected: p.connected })),
    hostId: room.hostId,
    roomState: room.state,
  };
  room.players.forEach(p => {
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit('lobby-update', lobbyData);
  });
}

// ── Socket.IO Events ──

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('create-room', ({ playerName }) => {
    const name = (playerName || '').trim().slice(0, 20) || 'Host';
    const room = createRoom(socket.id, name);
    currentRoom = room.code;
    socket.join(room.code);
    socket.emit('room-created', { code: room.code });
    broadcastLobby(room);
  });

  socket.on('join-room', ({ code, playerName }) => {
    const roomCode = (code || '').toUpperCase().trim();
    const name = (playerName || '').trim().slice(0, 20) || 'Player';
    const result = joinRoom(roomCode, socket.id, name);
    if (result.error) {
      socket.emit('join-error', { message: result.error });
      return;
    }
    currentRoom = roomCode;
    socket.join(roomCode);
    socket.emit('room-joined', { code: roomCode });
    broadcastLobby(result.room);
  });

  socket.on('start-game', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 1) return;
    if (room.state !== 'lobby') return;

    startGame(room);
    broadcastState(room);
  });

  socket.on('play-card', ({ cardId, phrase }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'playing' || room.phase !== 'play') return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== room.currentPlayerIndex) return;

    const player = room.players[playerIndex];
    if (!player.hand.includes(cardId)) return;

    player.hand = player.hand.filter(c => c !== cardId);
    room.conceptPool.push(cardId);

    room.pendingPlay = {
      card: cardId,
      phrase: (phrase || '').trim(),
      playerId: socket.id,
      playerName: player.name,
      playerIndex,
    };

    if (room.players.length === 1) {
      completeVoting(room, true);
      return;
    }

    room.phase = 'vote';
    room.votes = {};
    broadcastState(room);
  });

  socket.on('cast-vote', ({ vote }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'playing' || room.phase !== 'vote') return;
    if (!room.pendingPlay) return;
    if (room.pendingPlay.playerId === socket.id) return;
    if (room.votes[socket.id] !== undefined) return;

    room.votes[socket.id] = vote === 'yes' ? 'yes' : 'no';
    broadcastState(room);

    if (allVotesCast(room)) {
      const success = resolveVotes(room);
      setTimeout(() => completeVoting(room, success), 500);
    }
  });

  socket.on('skip-turn', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'playing' || room.phase !== 'play') return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== room.currentPlayerIndex) return;

    advanceTurn(room);
    broadcastState(room);
    broadcastResult(room, null, `${room.players[room.currentPlayerIndex].name}`);
  });

  socket.on('restart-game', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    startGame(room);
    broadcastState(room);
  });

  socket.on('back-to-lobby', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    room.state = 'lobby';
    room.players.forEach(p => { p.hand = []; p.score = 0; });
    room.deck = [];
    room.conceptPool = [];
    room.history = [];
    room.pendingPlay = null;
    room.votes = {};
    room.phase = 'play';
    broadcastLobby(room);
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) player.connected = false;

    const allDisconnected = room.players.every(p => !p.connected);
    if (allDisconnected) {
      rooms.delete(currentRoom);
      return;
    }

    if (room.hostId === socket.id) {
      const newHost = room.players.find(p => p.connected);
      if (newHost) room.hostId = newHost.id;
    }

    if (room.state === 'lobby') {
      room.players = room.players.filter(p => p.id !== socket.id);
      broadcastLobby(room);
    } else if (room.state === 'playing') {
      if (room.phase === 'vote' && room.pendingPlay) {
        if (room.pendingPlay.playerId === socket.id) {
          room.phase = 'play';
          room.pendingPlay = null;
          room.votes = {};
          advanceTurn(room);
        } else if (allVotesCast(room)) {
          const success = resolveVotes(room);
          completeVoting(room, success);
          return;
        }
      }
      if (room.currentPlayerIndex >= room.players.length) {
        room.currentPlayerIndex = 0;
      }
      const cp = room.players[room.currentPlayerIndex];
      if (cp && !cp.connected) {
        advanceTurn(room);
      }
      broadcastState(room);
    }
  });

  function completeVoting(room, success) {
    room.phase = 'play';
    const autoReset = success && room.conceptPool.length >= CONFIG.MAX_POOL;

    if (!success) room.conceptPool = [];
    else if (autoReset) room.conceptPool = [];

    const playIndex = room.pendingPlay?.playerIndex ?? room.currentPlayerIndex;

    if (success) {
      room.players[playIndex].score += 1;
    }

    room.history.unshift({
      player: room.pendingPlay?.playerName || room.players[playIndex]?.name || '?',
      card: room.pendingPlay?.card,
      phrase: room.pendingPlay?.phrase || '',
      result: success,
    });

    if (!success) {
      dealCards(room, room.players[playIndex].hand, 2);
    }

    const winner = checkWin(room);

    room.pendingPlay = null;
    room.votes = {};

    if (winner) {
      room.state = 'ended';
      room.players.forEach(p => {
        const sock = io.sockets.sockets.get(p.id);
        if (sock) {
          sock.emit('game-result', { success, autoReset });
          setTimeout(() => {
            sock.emit('victory', {
              winnerName: winner.name,
              scores: room.players.map(pl => ({ name: pl.name, score: pl.score })),
            });
          }, 2000);
        }
      });
      broadcastState(room);
      return;
    }

    advanceTurn(room);

    room.players.forEach(p => {
      const sock = io.sockets.sockets.get(p.id);
      if (sock) sock.emit('game-result', { success, autoReset });
    });

    setTimeout(() => broadcastState(room), 2200);
  }

  function broadcastResult(room, type, message) {
    room.players.forEach(p => {
      const sock = io.sockets.sockets.get(p.id);
      if (sock) sock.emit('toast', { message });
    });
  }
});

server.listen(PORT, () => {
  console.log(`SINAPSE server running on http://localhost:${PORT}`);
});
