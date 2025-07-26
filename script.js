let peer, conn;
let connections = {};
let isHost = false;
let roomId = '';
let playerName = '';

const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');

createRoomBtn.onclick = () => {
  playerName = document.getElementById('playerName').value;
  isHost = true;
  peer = new Peer();
  peer.on('open', id => {
    roomId = id;
    document.getElementById('currentRoom').textContent = roomId;
    document.getElementById('yourName').textContent = playerName;
    document.getElementById('gameArea').style.display = 'block';
  });
  peer.on('connection', c => {
    connections[c.peer] = c;
    c.on('data', handleData);
  });
};

joinRoomBtn.onclick = () => {
  playerName = document.getElementById('playerName').value;
  roomId = document.getElementById('roomId').value;
  peer = new Peer();
  peer.on('open', id => {
    conn = peer.connect(roomId);
    conn.on('open', () => {
      conn.send({ type: 'join', name: playerName });
    });
    conn.on('data', handleData);
    document.getElementById('currentRoom').textContent = roomId;
    document.getElementById('yourName').textContent = playerName;
    document.getElementById('gameArea').style.display = 'block';
  });
};

function handleData(data) {
  if (data.type === 'players') {
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    data.players.forEach(p => {
      const div = document.createElement('div');
      div.className = 'player';
      div.textContent = `${p.name}: ${p.chips} chips`;
      playersDiv.appendChild(div);
    });
  }
}
