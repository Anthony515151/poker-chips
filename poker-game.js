// poker-game.js

let players = [];
let currentPlayerIndex = 0;
let pot = 0;               // 累积奖池
let currentBet = 0;        // 本轮最大下注（当前公共下注水平）
let currentRound = 0;      // 轮次：0-翻牌前、1-翻牌后、2-转牌、3-河牌
const rounds = ["翻牌前", "翻牌后", "转牌", "河牌"];

const setupContainer = document.getElementById('setup');
const gameContainer = document.getElementById('game');
const playerNameInputsContainer = document.getElementById('player-names');
const startGameBtn = document.getElementById('start-game');
const addPlayerBtn = document.getElementById('add-player');
const initialChipsInput = document.getElementById('initial-chips');
const bigBlindInput = document.getElementById('big-blind');

let bigBlind = 20;
let smallBlind = 10;

let lastAggressor = null; // 记录本轮最后 raise 的玩家（索引）
let firstToAct = null;    // 本轮首位应行动玩家
let roundStarted = false; // 标记本轮是否已有玩家行动

// 新增：为每个玩家分配 id，并添加 allIn 与 totalBet 字段
// 初始 players 结构：
// { id, name, chips, folded, dealer, bet, totalBet, allIn }

let gameStarted = false;

// 添加玩家逻辑
addPlayerBtn.addEventListener('click', () => {
  const playerNameInput = document.createElement('input');
  playerNameInput.type = 'text';
  playerNameInput.placeholder = `玩家 ${players.length + 1} 名字`;
  playerNameInput.classList.add('player-name-input');

  const playerChipsInput = document.createElement('input');
  playerChipsInput.type = 'number';
  playerChipsInput.placeholder = '初始筹码';
  playerChipsInput.value = initialChipsInput.value;
  playerChipsInput.classList.add('player-chips-input');

  const playerDiv = document.createElement('div');
  playerDiv.appendChild(playerNameInput);
  playerDiv.appendChild(playerChipsInput);
  playerNameInputsContainer.appendChild(playerDiv);

  players.push({
    id: 'player' + players.length,
    name: '',
    chips: parseInt(initialChipsInput.value),
    folded: false,
    dealer: false,
    bet: 0,
    totalBet: 0,
    allIn: false
  });

  // 至少需要两个玩家才能开始游戏
  startGameBtn.disabled = players.length < 2;
});

// 修改开始游戏逻辑——仅首次初始化时设置 dealer（后续轮换由 rotateDealer 完成）
startGameBtn.addEventListener('click', () => {
  if (!gameStarted) {
    const nameInputs = document.querySelectorAll('.player-name-input');
    const chipsInputs = document.querySelectorAll('.player-chips-input');

    bigBlind = parseInt(bigBlindInput.value) || 20;
    smallBlind = Math.floor(bigBlind / 2);

    players = Array.from(nameInputs).map((input, index) => ({
      id: 'player' + index,
      name: input.value || `玩家 ${index + 1}`,
      chips: parseInt(chipsInputs[index].value) || 1000,
      folded: false,
      dealer: index === 0, // 初始仅第一次设置 dealer 为玩家0
      bet: 0,
      totalBet: 0,
      allIn: false
    }));
    gameStarted = true;
  }
  if (players.length >= 2) {
    setupContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    currentRound = 0;
    startRound();
  } else {
    alert('至少需要两个玩家开始游戏');
  }
});

// ① 在 startRound() 开始时重置每位玩家的 round 状态，并动态分配位置
function startRound() {
  currentBet = 0;
  roundStarted = false;
  // 新一局（翻牌前）清空 pot；后续轮次保留累积
  if (currentRound === 0) { pot = 0; }
  // 重置每位玩家本轮发的 bet 和 acted 标记（未 all-in 则重置 totalBet 供边池计算）
  players.forEach(player => {
    player.bet = 0;
    player.acted = false;
    if (!player.allIn) { player.totalBet = 0; }
  });
  lastAggressor = null;
  // 动态分配位置：以 dealer 为起点构建顺时针顺序
  const dealerIndex = players.findIndex(p => p.dealer);
  for (let j = 0; j < players.length; j++) {
    // 顺序索引
    const posIndex = j;
    const realIndex = (dealerIndex + j) % players.length;
    if (players.length === 2) {
      players[realIndex].position = (j === 0) ? "Dealer" : "大盲";
    } else {
      if (j === 0) players[realIndex].position = "Dealer";
      else if (j === 1) players[realIndex].position = "小盲";
      else if (j === 2) players[realIndex].position = "大盲";
      else players[realIndex].position = "普通玩家";
    }
  }
  
  // 计算盲注索引
  const smallBlindIndex = (dealerIndex + 1) % players.length;
  const bigBlindIndex = (dealerIndex + 2) % players.length;

  if (currentRound === 0) {  // 翻牌前
    if (players.length === 2) {
      // Heads‑up：dealer为小盲（Dealer），非 dealer 为大盲
      players[dealerIndex].chips -= smallBlind;
      players[dealerIndex].bet = smallBlind;
      players[dealerIndex].totalBet = smallBlind;
      players[(dealerIndex+1)%2].chips -= bigBlind;
      players[(dealerIndex+1)%2].bet = bigBlind;
      players[(dealerIndex+1)%2].totalBet = bigBlind;
      pot += smallBlind + bigBlind;
      currentBet = bigBlind;
      firstToAct = dealerIndex;  // heads‑up preflop，由 Dealer 先行动
      currentPlayerIndex = (dealerIndex - 1 + 2) % 2;
    } else {
      // 多人局：小盲、大盲下注
      players[smallBlindIndex].chips -= smallBlind;
      players[smallBlindIndex].bet = smallBlind;
      players[smallBlindIndex].totalBet = smallBlind;
      players[bigBlindIndex].chips -= bigBlind;
      players[bigBlindIndex].bet = bigBlind;
      players[bigBlindIndex].totalBet = bigBlind;
      pot += smallBlind + bigBlind;
      currentBet = bigBlind;
      // 翻牌前第一行动为 UTG = (bigBlindIndex + 1) % players.length
      firstToAct = (bigBlindIndex + 1) % players.length;
      currentPlayerIndex = (firstToAct - 1 + players.length) % players.length;
    }
  } else {  // 翻牌后、转牌、河牌轮
    if (players.length === 2) {
      const dealerIdx = players.findIndex(p => p.dealer);
      firstToAct = (dealerIdx + 1) % 2; // heads‑up post‑flop，非 dealer先行动
      currentPlayerIndex = (firstToAct - 1 + 2) % 2;
    } else {
      firstToAct = smallBlindIndex; // 多人局 post‑flop由小盲先行动
      currentPlayerIndex = (firstToAct - 1 + players.length) % players.length;
    }
  }
  updateGameInfo();
  updatePlayerBoxes();
  updateGameLog(`进入 ${rounds[currentRound]} 轮，奖池：${pot}`);
  nextPlayer();
}


// ② 修改 playerAction()，针对 check 做调整，同时每个动作标记 acted=true
function playerAction(action, index, amount = 0) {
  const player = players[index];
  if (index !== currentPlayerIndex) {
    alert("不是当前玩家的回合！");
    return;
  }
  // 标记玩家已作出操作
  player.acted = true;
  roundStarted = true;

  switch (action) {
    case "check":
      if (player.bet < currentBet) {
        alert("当前有下注，不能选择 Check！");
        return;
      }
      // check时无需扣款，直接允许
      break;
    case "call": {
      let callAmount = currentBet - player.bet;
      if (player.chips < callAmount) {
        callAmount = player.chips;
        player.allIn = true;
      }
      // 若 callAmount===0，则直接做 check（但标记 acted）
      if (callAmount === 0) { 
        // 如果玩家筹码正好用完，确保 allIn
        if (player.chips === 0) { player.allIn = true; }
        break;
      }
      player.chips -= callAmount;
      player.bet += callAmount;
      player.totalBet += callAmount;
      pot += callAmount;
      if (player.chips === 0) { player.allIn = true; }
      break;
    }
    case "raise": {
      let extra = parseInt(amount);
      const newTotal = player.bet + extra;
      if (isNaN(extra) || newTotal <= currentBet) {
        alert("加注金额必须使总下注高于当前下注！");
        return;
      }
      if (player.chips < extra) {
        extra = player.chips;
        player.allIn = true;
      }
      player.chips -= extra;
      player.bet = newTotal;
      player.totalBet += extra;
      pot += extra;
      currentBet = newTotal;
      lastAggressor = index;
      if (player.chips === 0) { player.allIn = true; }
      break;
    }
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
}

// ③ 修改 nextPlayer()：如果所有 active 玩家均已操作，则结束本轮（避免最后一人 check 未结束轮次）
function nextPlayer() {
  const activePlayers = players.filter(p => !p.folded);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winner.chips += pot;
    updateGameLog(`${winner.name} 赢得了该局，奖池：${pot}`);
    showNextHandButton();
    return;
  }
  
  // 当所有 active 玩家已经 acted 且投注平齐时（若河牌，则进入 showdown）
  if (roundStarted && allActivePlayersCalled()) {
    if (currentRound === 3) {
      endGame(); // 河牌进入 showdown，让用户指定赢家
    } else {
      endRound();
    }
    return;
  }
  
  do {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  } while (players[currentPlayerIndex].folded || players[currentPlayerIndex].allIn);
  
  // 如果存在 raise 且轮回到 raise 玩家则结束本轮
  if (lastAggressor !== null && currentPlayerIndex === lastAggressor) {
    if (currentRound === 3) {
      endGame();
    } else {
      endRound();
    }
    return;
  }
  
  updateGameLog(`轮到 ${players[currentPlayerIndex].name} 操作`);
  updatePlayerBoxes();
}

function endRound() {
  if (currentRound < 3) {
    currentRound++;
    startRound();
  } else {
    endGame();
  }
}

// 修改后的 endGame()：在无人 all-in 且投注平齐情况下，只处理单份奖池
function endGame() {
  const activePlayers = players.filter(p => !p.folded);
  const bets = activePlayers.map(p => p.totalBet);
  const allEqual = bets.every(b => b === bets[0]);
  const anyAllIn = activePlayers.some(p => p.allIn);
  
  // 如果无人 allIn 且所有 active 玩家投入金额一致，则视为单一奖池情况，
  // 在这种情况下整个 pot 都归于指定赢家（showdown）
  if (!anyAllIn && allEqual) {
    let winnerNames = prompt(`请指定赢家（多个以空格分隔），此赢家将获得整个奖池 ${pot} 筹码：`);
    let winners;
    if (winnerNames === null || winnerNames.trim() === "") {
      winners = activePlayers;
      alert("未输入赢家，采用所有活跃玩家平分奖池");
    } else {
      winnerNames = winnerNames.trim().split(/\s+/);
      winners = activePlayers.filter(p => winnerNames.includes(p.name));
      if (winners.length === 0) {
        winners = activePlayers;
        alert("未识别赢家，采用所有活跃玩家平分奖池");
      }
    }
    let split = Math.floor(pot / winners.length);
    winners.forEach(w => {
      w.chips += split;
      updateGameLog(`${w.name} 赢得了 ${split} 筹码（整池）`);
    });
    showNextHandButton();
    return;
  }
  
  // 否则执行原有 side pot 逻辑（适用于存在 all-in 或投注不均的情况）
  let sortedBets = players.filter(p => p.totalBet > 0).slice().sort((a, b) => a.totalBet - b.totalBet);
  let pots = [];
  let previousLevel = 0;
  while (sortedBets.length > 0) {
    let currentLevel = sortedBets[0].totalBet;
    let betThisLevel = currentLevel - previousLevel;
    let participants = sortedBets.map(p => p.id);
    let amount = betThisLevel * participants.length;
    pots.push({ amount, eligiblePlayers: participants });
    sortedBets.forEach(p => { p.totalBet -= betThisLevel; });
    sortedBets = sortedBets.filter(p => p.totalBet > 0);
    previousLevel = currentLevel;
  }
  
  for (const potObj of pots) {
    let contenders = potObj.eligiblePlayers.filter(id => {
      let p = players.find(x => x.id === id);
      return !p.folded;
    });
    if (contenders.length === 1) {
      let winner = players.find(x => x.id === contenders[0]);
      winner.chips += potObj.amount;
      updateGameLog(`${winner.name} 赢得了侧池 ${potObj.amount} 筹码`);
    } else {
      let winnerNames;
      while (true) {
        winnerNames = prompt(`多个玩家争夺侧池 ${potObj.amount} 筹码，请输入赢家的名字（多个以空格分隔）：`);
        if (winnerNames === null) {
          alert("未输入赢家，采用所有未弃牌玩家平分此侧池。");
          let split = Math.floor(potObj.amount / contenders.length);
          contenders.forEach(id => {
            let p = players.find(x => x.id === id);
            p.chips += split;
            updateGameLog(`${p.name} 分得 ${split} 筹码`);
          });
          break;
        }
        winnerNames = winnerNames.trim();
        if (!winnerNames) continue;
        const names = winnerNames.split(/\s+/);
        let winners = players.filter(p => names.includes(p.name));
        if (winners.length > 0) {
          let split = Math.floor(potObj.amount / winners.length);
          winners.forEach(w => {
            w.chips += split;
            updateGameLog(`${w.name} 赢得了 ${split} 筹码`);
          });
          break;
        } else {
          alert("未找到合法赢家，请重新输入！");
        }
      }
    }
  }
  showNextHandButton();
}

function resetGame() {
  currentRound = 0;
  players.forEach(player => {
    player.bet = 0;
    player.folded = false;
    player.allIn = false;
    player.acted = false;
  });
  document.getElementById("game-log").innerHTML = "";
  showNextHandButton();
}

function resetHand() {
  currentRound = 0;
  players.forEach(player => {
    player.bet = 0;
    player.folded = false;
    // 重置除 allIn 外的状态；是否重置 allIn 可根据需求决定
    player.acted = false;
  });
  rotateDealer();
  document.getElementById("game-log").innerHTML = "";
  startRound();
}

function rotateDealer() {
  const currentDealerIndex = players.findIndex(player => player.dealer);
  players[currentDealerIndex].dealer = false;
  const nextDealerIndex = (currentDealerIndex + 1) % players.length;
  players[nextDealerIndex].dealer = true;
}

// 检查所有未fold玩家是否已投入相等筹码
function allActivePlayersCalled() {
  const active = players.filter(p => !p.folded);
  // 如果玩家已 allIn，则不要求其 bet 等于 currentBet
  return active.every(p => p.allIn || (p.acted && p.bet === currentBet));
}

function updateGameLog(message) {
  const gameLog = document.getElementById("game-log");
  gameLog.innerHTML += `<p>${message}</p>`;
}

function updateGameInfo() {
  const currentRoundElement = document.getElementById("current-round");
  const potElement = document.getElementById("pot-amount");
  currentRoundElement.textContent = `当前轮次: ${rounds[currentRound]}`;
  potElement.textContent = `奖池: ${pot}`;
}

// ⑥ 修改 updatePlayerBoxes()，使用 player.position 动态显示位置信息
function updatePlayerBoxes() {
  const playerBoxesContainer = document.getElementById("player-boxes");
  playerBoxesContainer.innerHTML = "";
  players.forEach((player, index) => {
    const playerBox = document.createElement("div");
    playerBox.classList.add("player-box");
    if (player.folded) playerBox.classList.add("folded");
    if (index === currentPlayerIndex) playerBox.classList.add("active");
    let allInMark = player.allIn ? " (All In)" : "";
    // 若玩家 acted 且 bet===0，则显示 "Bet 0"
    let statusText = player.acted ? `Bet ${player.bet}` : "未轮到";
    playerBox.innerHTML = `
      <p><strong>${player.name}</strong> ${allInMark}</p>
      <p>位置: ${player.position}</p>
      <p>状态: ${player.folded ? "Folded" : statusText}</p>
      <p>剩余筹码: ${player.chips}</p>
      <div class="actions">
        <button onclick="playerAction('check', ${index})" ${currentPlayerIndex !== index || currentBet > 0 ? "disabled" : ""}>Check</button>
        <button onclick="playerAction('call', ${index})" ${currentPlayerIndex !== index || currentBet === 0 ? "disabled" : ""}>Call</button>
        <button onclick="showRaiseInput(${index})" ${currentPlayerIndex !== index ? "disabled" : ""}>Raise</button>
        <button onclick="playerAction('fold', ${index})" ${currentPlayerIndex !== index ? "disabled" : ""}>Fold</button>
        <div id="raise-input-${index}" class="raise-input" style="display: none;">
          <input type="number" id="raise-amount-${index}" placeholder="加注金额" step="10" />
          <button onclick="confirmRaise(${index})">确认</button>
        </div>
      </div>
    `;
    playerBoxesContainer.appendChild(playerBox);
  });
}

function showRaiseInput(index) {
  const raiseInputDiv = document.getElementById(`raise-input-${index}`);
  raiseInputDiv.style.display = "block";
}

function confirmRaise(index) {
  const raiseAmountInput = document.getElementById(`raise-amount-${index}`);
  const raiseAmount = parseInt(raiseAmountInput.value);
  if (isNaN(raiseAmount) || raiseAmount <= 0) {
    alert("请输入有效的加注金额！");
    return;
  }
  playerAction("raise", index, raiseAmount);
  document.getElementById(`raise-input-${index}`).style.display = "none";
}

function showNextHandButton() {
  const gameLog = document.getElementById("game-log");
  const button = document.createElement("button");
  button.textContent = "开始下一局";
  button.onclick = () => {
    gameLog.innerHTML = ""; // 清空日志信息
    resetHand();
  };
  gameLog.appendChild(button);
}

window.playerAction = playerAction;
window.showRaiseInput = showRaiseInput;
window.confirmRaise = confirmRaise;
