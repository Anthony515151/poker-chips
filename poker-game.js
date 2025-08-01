// poker-game.js

// ----------------------
// Firebase 初始化
// ----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/9.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDWngC6KUU2jRcyArjD42U7mKMwJecaqt8",
  authDomain: "online-room-test.firebaseapp.com",
  databaseURL: "https://online-room-test-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "online-room-test",
  storageBucket: "online-room-test.firebasestorage.app",
  messagingSenderId: "225690962519",
  appId: "1:225690962519:web:f9652634f1ab627c197112"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ----------------------
// 全局变量及 DOM 获取
// ----------------------
let players = [];
let currentPlayerIndex = 0;
let pot = 0;               // 累积奖池
let currentBet = 0;        // 本轮最大下注
let currentRound = 0;      // 0-翻牌前、1-翻牌后、2-转牌、3-河牌
const rounds = ["翻牌前", "翻牌后", "转牌", "河牌"];

const setupContainer = document.getElementById('setup');
const gameContainer = document.getElementById('game');
const playerNameInputsContainer = document.getElementById('player-names');
const startGameBtn = document.getElementById('start-game');
const addPlayerBtn = document.getElementById('add-player');
const initialChipsInput = document.getElementById('initial-chips');
const bigBlindInput = document.getElementById('big-blind');
const roomIdInput = document.getElementById('room-id');

let bigBlind = 20;
let smallBlind = 10;

let lastAggressor = null;
let firstToAct = null;
let roundStarted = false;
let gameOver = false;
let gameStarted = false;

// ----------------------
// 房间系统数据结构
// ----------------------
let room = {
  roomId: "",          // 房间号
  operator: "",        // 操作者 ID（暂未限制）
  players: [],         // 本端创建的玩家
  gameState: {
    currentRound: 0,
    pot: 0,
    currentBet: 0,
    currentPlayerIndex: 0,
    logs: [],
    inProgress: false  // 标识游戏是否正在进行
  }
};

// ----------------------
// Firebase 同步：更新房间状态（每次操作后都调用）
// ----------------------
function updateFirebaseState() {
  if (!room.roomId) return;
  update(ref(db, "rooms/" + room.roomId), {
    gameState: {
      currentRound,
      pot,
      currentBet,
      currentPlayerIndex,
      logs: room.gameState.logs,
      inProgress: room.gameState.inProgress,
      gameOver: gameOver
    },
    players
  });
}

// ----------------------
// 更新游戏操作记录，同时同步日志到 Firebase
// ----------------------
function updateGameLog(message) {
  const gameLog = document.getElementById("game-log");
  gameLog.innerHTML += `<p>${message}</p>`;
  room.gameState.logs.push(message);
  updateFirebaseState();
}

// ----------------------
// Firebase 监听：同步房间数据变化
// ----------------------
function listenFirebaseUpdates() {
  if (!room.roomId) return;
  const roomRef = ref(db, "rooms/" + room.roomId);
  onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    
    currentRound       = data.gameState.currentRound;
    pot                = data.gameState.pot;
    currentBet         = data.gameState.currentBet;
    currentPlayerIndex = data.gameState.currentPlayerIndex;
    players            = data.players || players;
    if (data.gameState.logs) {
      const gameLog = document.getElementById("game-log");
      gameLog.innerHTML = data.gameState.logs.map(m => `<p>${m}</p>`).join("");
    }
    
    updateGameInfo();
    updatePlayerBoxes();
    
    // 同步 gameOver 状态
    if (typeof data.gameState.gameOver !== 'undefined') {
      gameOver = data.gameState.gameOver;
    }
    
    // 如果数据库标识游戏在进行，则切换到游戏界面并设置 gameStarted
    if (data.gameState.inProgress === true) {
      setupContainer.style.display = 'none';
      gameContainer.style.display = 'block';
      gameStarted = true;
    } else {
      if (!gameStarted) {
        setupContainer.style.display = 'block';
        gameContainer.style.display = 'none';
      }
    }
  });
}

// ----------------------
// 房间系统接口（允许中途加入）
// ----------------------
function createRoom(operatorId) {
  if (!room.roomId) {
    room.roomId = "room_" + Math.floor(Math.random() * 10000);
  }
  updateFirebaseState();
}

function joinRoom(roomId, operatorId) {
  room.roomId = roomId;
  listenFirebaseUpdates();
}

// ----------------------
// 保证房间ID输入框变化时自动加入房间（始终有效）
// ----------------------
roomIdInput.addEventListener('blur', () => {
  const id = roomIdInput.value.trim();
  if (id && !gameStarted) {
    joinRoom(id, "operator");
  }
});
roomIdInput.addEventListener('input', () => {
  const id = roomIdInput.value.trim();
  if (id && !gameStarted) {
    joinRoom(id, "operator");
  }
});

// ----------------------
// 添加玩家逻辑
// ----------------------
addPlayerBtn.addEventListener('click', () => {
  const playerDiv = document.createElement('div');
  playerDiv.classList.add('player-div');
  
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = `输入玩家 ${players.length + 1} 昵称`;
  nameInput.classList.add('player-name-input');
  
  const chipsInput = document.createElement('input');
  chipsInput.type = 'text';
  chipsInput.inputMode = 'numeric';
  chipsInput.placeholder = '初始筹码';
  chipsInput.value = initialChipsInput.value;
  chipsInput.classList.add('player-chips-input');
  
  const delBtn = document.createElement('button');
  delBtn.textContent = "删除";
  delBtn.onclick = () => {
    playerDiv.remove();
    players = players.filter((_, i) => i !== players.indexOf(player));
    // 启用开始游戏按钮当玩家数量>=2时
    startGameBtn.disabled = (players.length < 2);
  };
  
  playerDiv.appendChild(nameInput);
  playerDiv.appendChild(chipsInput);
  playerDiv.appendChild(delBtn);
  playerNameInputsContainer.appendChild(playerDiv);
  
  // 将空的玩家占位先加入players数组
  let player = {
    id: 'player' + players.length,
    name: "",
    chips: parseInt(initialChipsInput.value) || 1000,
    folded: false,
    dealer: false,
    bet: 0,
    totalBet: 0,
    allIn: false
  };
  players.push(player);
  startGameBtn.disabled = (players.length < 2);
});

// ----------------------
// 开始游戏逻辑
// ----------------------
startGameBtn.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  if (roomId) {
    joinRoom(roomId, "operator");
  } else {
    createRoom("operator");
    roomIdInput.value = room.roomId;
  }
  // 游戏未开始时读取玩家信息并写入数据库
  if (!gameStarted) {
    const nameInputs = document.querySelectorAll('.player-name-input');
    const chipsInputs = document.querySelectorAll('.player-chips-input');
    bigBlind = parseInt(bigBlindInput.value) || 20;
    smallBlind = Math.floor(bigBlind / 2);
    players = Array.from(nameInputs).map((input, index) => ({
      id: 'player' + index,
      name: input.value || `玩家${index + 1}`,
      chips: parseInt(chipsInputs[index].value) || 1000,
      folded: false,
      dealer: index === 0,
      bet: 0,
      totalBet: 0,
      allIn: false
    }));
    room.players = players;
    gameStarted = true;
    room.gameState.inProgress = true;  // 标记游戏已开始
    updateFirebaseState();
  }
  if (players.length >= 2) {
    // 强制切换到游戏界面
    setupContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    currentRound = 0;
    gameOver = false;
    startRound();
  } else {
    alert('至少需要两个玩家开始游戏');
  }
});

// ----------------------
// 开局与轮次逻辑
// ----------------------
function startRound() {
  currentBet = 0;
  roundStarted = false;
  if (currentRound === 0) { 
    pot = 0; 
  }
  players.forEach(player => {
    player.bet = 0;
    player.acted = false;
    if (!player.allIn) { 
      player.totalBet = 0; 
    }
  });
  lastAggressor = null;
  const dealerIndex = players.findIndex(p => p.dealer);
  // 分配位置
  for (let j = 0; j < players.length; j++) {
    const idx = (dealerIndex + j) % players.length;
    if (players.length === 2) {
      players[idx].position = (j === 0) ? "Dealer" : "大盲";
    } else {
      if (j === 0) players[idx].position = "Dealer";
      else if (j === 1) players[idx].position = "小盲";
      else if (j === 2) players[idx].position = "大盲";
      else players[idx].position = "普通玩家";
    }
  }
  const smallBlindIndex = (dealerIndex + 1) % players.length;
  const bigBlindIndex = (dealerIndex + 2) % players.length;
  
  if (currentRound === 0) {  // Preflop
    if (players.length === 2) {
      // heads‑up preflop：dealer先行动
      players[dealerIndex].chips -= smallBlind;
      players[dealerIndex].bet = smallBlind;
      players[(dealerIndex + 1) % 2].chips -= bigBlind;
      players[(dealerIndex + 1) % 2].bet = bigBlind;
      pot += (smallBlind + bigBlind);
      currentBet = bigBlind;
      currentPlayerIndex = dealerIndex;
    } else {
      // 多人（＞2）：从大盲后一位开始
      players[smallBlindIndex].chips -= smallBlind;
      players[smallBlindIndex].bet = smallBlind;
      players[bigBlindIndex].chips -= bigBlind;
      players[bigBlindIndex].bet = bigBlind;
      pot += (smallBlind + bigBlind);
      currentBet = bigBlind;
      currentPlayerIndex = (bigBlindIndex + 1) % players.length;
    }
  } else { // Postflop
    if (players.length === 2) {
      // Heads‑up postflop：由大盲先行动
      currentPlayerIndex = (dealerIndex + 1) % 2;
    } else {
      // 多人postflop：从庄家右侧（即小盲）开始
      currentPlayerIndex = (dealerIndex + 1) % players.length;
    }
  }
  
  updateGameInfo();
  updatePlayerBoxes();
  updateGameLog(`进入 ${rounds[currentRound]} 轮，奖池：${pot}`);
  updateFirebaseState();
  nextPlayer();
}

// ----------------------
// playerAction：处理各操作（check/call/raise/fold）
// ----------------------
function playerAction(action, index, amount = 0) {
  if (gameOver) {
    alert("游戏已结束，自动进入下一局");
    resetHand();
    return;
  }
  if (index !== currentPlayerIndex) {
    alert("当前不是你的回合！");
    return;
  }
  const player = players[index];
  player.acted = true;
  roundStarted = true;
  switch (action) {
    case "check":
      if (player.bet < currentBet) {
        alert("已有下注，不能选择 Check！");
        return;
      }
      break;
    case "call":
      let callAmount = currentBet - player.bet;
      if (player.chips < callAmount) {
        callAmount = player.chips; player.allIn = true;
      }
      if (callAmount > 0) {
        player.chips -= callAmount;
        player.bet += callAmount;
        player.totalBet += callAmount;
        pot += callAmount;
      }
      break;
    case "raise":
      let extra = parseInt(amount);
      const newTotal = player.bet + extra;
      if (isNaN(extra) || newTotal <= currentBet) {
        alert("加注金额错误！");
        return;
      }
      if (player.chips < extra) { extra = player.chips; player.allIn = true; }
      player.chips -= extra;
      player.bet = newTotal;
      player.totalBet += extra;
      pot += extra;
      currentBet = newTotal;
      lastAggressor = index;
      break;
    case "fold":
      player.folded = true;
      break;
    default:
      alert("无效操作！");
      return;
  }
  updateGameLog(`${player.name} 选择了 ${action}，奖池：${pot}`);
  nextPlayer();
  updateGameInfo();
  updatePlayerBoxes();
  updateFirebaseState();
}

// ----------------------
// nextPlayer 与轮次结束逻辑
// ----------------------
function nextPlayer() {
  const active = players.filter(p => !p.folded);
  if (active.length <= 1) {
    active[0] && (active[0].chips += pot);
    updateGameLog(` ${active[0] ? active[0].name : "无人"} 赢得奖池 ${pot}`);
    showNextHandButton();
    updateFirebaseState();
    return;
  }
  if (roundStarted && active.every(p => p.allIn || (p.acted && p.bet === currentBet))) {
    if (currentRound === 3) endGame(); else endRound();
    return;
  }
  do {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  } while (players[currentPlayerIndex].folded || players[currentPlayerIndex].allIn);
  updateGameLog(`轮到 ${players[currentPlayerIndex].name} 行动`);
  updatePlayerBoxes();
  updateFirebaseState();
}

function endRound() {
  if (currentRound < 3) { currentRound++; startRound(); }
  else { endGame(); }
}

function endGame() {
  const active = players.filter(p => !p.folded);
  const bets = active.map(p => p.totalBet);
  const allEqual = bets.every(b => b === bets[0]);
  const anyAllIn = active.some(p => p.allIn);
  let report = "";
  
  if (!anyAllIn && allEqual) {
    let winnerNames = prompt(`请指定赢家（多个以空格分隔），此赢家将获得整个奖池 ${pot} 筹码：`);
    let winners;
    if (!winnerNames || winnerNames.trim() === "") {
      winners = active;
      alert("未输入赢家，采用所有活跃玩家平分奖池");
    } else {
      winnerNames = winnerNames.trim().split(/\s+/);
      winners = active.filter(p => winnerNames.includes(p.name));
      while (winners.length === 0) {
        winnerNames = prompt(`未匹配到合法赢家，请重新输入赢家名称（多个以空格分隔），点击取消则自动平分：`);
        if (winnerNames === null) {
          winners = active;
          break;
        }
        winnerNames = winnerNames.trim().split(/\s+/);
        winners = active.filter(p => winnerNames.includes(p.name));
      }
    }
    let split = Math.floor(pot / winners.length);
    winners.forEach(w => {
      w.chips += split;
      report += `${w.name} 获得 ${split} 筹码（整池）\n`;
    });
  } else {
    // 计算边池
    let sortedBets = active.slice().sort((a, b) => a.totalBet - b.totalBet);
    let prevLevel = 0;
    let pots = [];
    while (sortedBets.length > 0) {
      let currentLevel = sortedBets[0].totalBet;
      let potAmount = (currentLevel - prevLevel) * sortedBets.length;
      pots.push({ amount: potAmount, participants: sortedBets.map(p => p.id) });
      prevLevel = currentLevel;
      sortedBets = sortedBets.filter(p => p.totalBet > currentLevel);
    }
    for (let potObj of pots) {
      let contenders = potObj.participants.filter(id => {
        let p = players.find(x => x.id === id);
        return !p.folded;
      });
      if (contenders.length === 1) {
        let winner = players.find(x => x.id === contenders[0]);
        winner.chips += potObj.amount;
        report += `${winner.name} 赢得侧池 ${potObj.amount} 筹码\n`;
      } else {
        let valid = false;
        while (!valid) {
          let winnerNames = prompt(`多个玩家争夺侧池 ${potObj.amount} 筹码，请输入赢家的名字（多个以空格分隔），点击取消则自动平分：`);
          if (winnerNames === null) {
            alert("已取消输入，采用所有未弃牌玩家平分此侧池");
            let split = Math.floor(potObj.amount / contenders.length);
            contenders.forEach(id => {
              let p = players.find(x => x.id === id);
              p.chips += split;
              report += `${p.name} 分得 ${split} 筹码\n`;
            });
            valid = true;
          } else {
            winnerNames = winnerNames.trim();
            if (!winnerNames) continue;
            const names = winnerNames.split(/\s+/);
            let winners2 = players.filter(p => names.includes(p.name) && !p.folded);
            if (winners2.length > 0) {
              let split = Math.floor(potObj.amount / winners2.length);
              winners2.forEach(w => {
                w.chips += split;
                report += `${w.name} 赢得 ${split} 筹码\n`;
              });
              valid = true;
            } else {
              alert("未找到合法赢家，请重新输入！");
            }
          }
        }
      }
    }
  }
  updateGameLog(`游戏结束，筹码分配：\n${report}`);
  alert(`游戏结束！\n筹码分配结果：\n${report}\n进入下一局`);
  gameOver = true;
  updateFirebaseState();
  showNextHandButton();
  // 注意：不自动调用 resetHand()，由“开始下一局”按钮统一重置
}

// ----------------------
// 手动同步按钮
// ----------------------
const manualSyncBtn = document.getElementById("manual-sync");
if(manualSyncBtn){
  manualSyncBtn.addEventListener("click", ()=>{
    const id = roomIdInput.value.trim();
    if(id){ joinRoom(id, "operator"); alert("已同步最新数据"); }
    else { alert("请输入房间ID"); }
  });
}

function resetHand() {
  currentRound = 0;
  players.forEach(player => {
    player.bet = 0;
    player.folded = false;
    player.acted = false;
  });
  rotateDealer();
  document.getElementById("game-log").innerHTML = "";
  gameOver = false;
  room.gameState.inProgress = true;
  updateFirebaseState();
  startRound();
}

function rotateDealer() {
  const idx = players.findIndex(p => p.dealer);
  players[idx].dealer = false;
  const nextIdx = (idx + 1) % players.length;
  players[nextIdx].dealer = true;
  updateFirebaseState();
}

function updateGameInfo() {
  const roundEl = document.getElementById("current-round");
  const potEl = document.getElementById("pot-amount");
  roundEl.textContent = `当前轮次: ${rounds[currentRound]}`;
  potEl.textContent = `奖池: ${pot}`;
}

// ----------------------
// updatePlayerBoxes：根据 player.position 显示信息，并结合 gameOver 状态禁用操作
// ----------------------
function updatePlayerBoxes() {
  const boxes = document.getElementById("player-boxes");
  boxes.innerHTML = "";
  players.forEach((p, i) => {
    const box = document.createElement("div");
    box.classList.add("player-box");
    if (p.folded) box.classList.add("folded");
    if (i === currentPlayerIndex) box.classList.add("active");
    const allInMark = p.allIn ? " (All In)" : "";
    const status = p.acted ? `Bet ${p.bet}` : "未轮到";
    box.innerHTML = `
      <p><strong>${p.name}</strong>${allInMark}</p>
      <p>位置: ${p.position || "-"}</p>
      <p>状态: ${p.folded ? "Folded" : status}</p>
      <p>剩余筹码: ${p.chips}</p>
      <div class="actions">
        <button onclick="playerAction('check', ${i})" ${gameOver || currentPlayerIndex!==i || currentBet>0 ? "disabled" : ""}>Check</button>
        <button onclick="playerAction('call', ${i})" ${gameOver || currentPlayerIndex!==i || currentBet===0 ? "disabled" : ""}>Call</button>
        <button onclick="showRaiseInput(${i})" ${gameOver || currentPlayerIndex!==i ? "disabled" : ""}>Raise</button>
        <button onclick="playerAction('fold', ${i})" ${gameOver || currentPlayerIndex!==i ? "disabled" : ""}>Fold</button>
        <div id="raise-input-${i}" class="raise-input" style="display:none;">
          <input type="number" id="raise-amount-${i}" placeholder="加注金额" step="10" />
          <button onclick="confirmRaise(${i})">确认</button>
        </div>
      </div>
    `;
    boxes.appendChild(box);
  });
}

function showRaiseInput(i) {
  document.getElementById(`raise-input-${i}`).style.display = "block";
}

function confirmRaise(i) {
  const input = document.getElementById(`raise-amount-${i}`);
  const amount = parseInt(input.value);
  if(isNaN(amount)|| amount<=0){
    alert("请输入有效的加注金额！");
    return;
  }
  playerAction("raise", i, amount);
  document.getElementById(`raise-input-${i}`).style.display = "none";
}

function showNextHandButton() {
  const gameLog = document.getElementById("game-log");
  const btn = document.createElement("button");
  btn.textContent = "开始下一局";
  btn.onclick = () => {
    gameLog.innerHTML = "";
    resetHand();
  };
  gameLog.appendChild(btn);
  updateFirebaseState();
}

// 将函数导出到全局作用域
window.playerAction = playerAction;
window.showRaiseInput = showRaiseInput;
window.confirmRaise = confirmRaise;
// End of file
