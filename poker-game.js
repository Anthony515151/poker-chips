// poker-game.js

let players = [];
let currentPlayerIndex = 0;
let pot = 0;               // 累积奖池
let currentBet = 0;        // 当前轮最高下注
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

let lastToActIndex = null; // 记录本轮最后需要行动的玩家

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
    name: '',
    chips: parseInt(initialChipsInput.value),
    folded: false,
    dealer: false, 
    bet: 0
  });

  // 至少需要两个玩家才能开始游戏
  startGameBtn.disabled = players.length < 2;
});

// 开始游戏逻辑
startGameBtn.addEventListener('click', () => {
  const nameInputs = document.querySelectorAll('.player-name-input');
  const chipsInputs = document.querySelectorAll('.player-chips-input');

  bigBlind = parseInt(bigBlindInput.value) || 20;
  smallBlind = Math.floor(bigBlind / 2);

  // 固定初始 dealer 为玩家1（index===0）
  players = Array.from(nameInputs).map((input, index) => ({
    name: input.value || `玩家 ${index + 1}`,
    chips: parseInt(chipsInputs[index].value) || 1000,
    folded: false,
    dealer: index === 0,
    bet: 0
  }));

  if (players.length >= 2) {
    setupContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    currentRound = 0;
    startRound();
  } else {
    alert('至少需要两个玩家开始游戏');
  }
});

function startRound() {
  currentBet = 0;
  // 若是新一局（翻牌前）则清空 pot，否则保留累积 pot
  if (currentRound === 0) {
    pot = 0;
  }
  // 清零所有玩家本轮下注
  players.forEach(player => player.bet = 0);

  // 计算 dealer、小盲、大盲 的索引
  const dealerIndex = players.findIndex(player => player.dealer);
  const smallBlindIndex = (dealerIndex + 1) % players.length;
  const bigBlindIndex = (dealerIndex + 2) % players.length;

  if (currentRound === 0) {  // 翻牌前
    if (players.length === 2) {
      // Heads-Up：dealer为小盲，对家为大盲，翻牌前由 dealer 先行动
      players[dealerIndex].chips -= smallBlind;
      players[dealerIndex].bet = smallBlind;
      players[smallBlindIndex].chips -= bigBlind;
      players[smallBlindIndex].bet = bigBlind;
      pot += smallBlind + bigBlind;
      currentBet = bigBlind;
      // 为使 nextPlayer() 递增后变为 dealer，预设 currentPlayerIndex 为 (dealerIndex - 1) mod 2
      currentPlayerIndex = (dealerIndex - 1 + players.length) % players.length;
    } else {
      // 多人局：小盲、大盲下注
      players[smallBlindIndex].chips -= smallBlind;
      players[smallBlindIndex].bet = smallBlind;
      players[bigBlindIndex].chips -= bigBlind;
      players[bigBlindIndex].bet = bigBlind;
      pot += smallBlind + bigBlind;
      currentBet = bigBlind;
      // 多人局翻牌前第一行动为 UTG = (bigBlindIndex + 1) mod n
      // 预设 currentPlayerIndex 为 bigBlindIndex，这样 nextPlayer() 后变为 UTG
      currentPlayerIndex = bigBlindIndex;
    }
  } else {  // 翻牌后、转牌、河牌轮
    if (players.length === 2) {
      // Heads-Up post-flop：由非 dealer先行动
      currentPlayerIndex = (players.findIndex(p => p.dealer) + 1) % players.length;
    } else {
      // 多人局 post-flop：从小盲开始
      currentPlayerIndex = (dealerIndex + 1) % players.length;
    }
  }
  // 记录本轮的首个行动玩家，作为最后需要回到的人
  lastToActIndex = currentPlayerIndex;

  updateGameInfo();
  updatePlayerBoxes();
  updateGameLog(`进入 ${rounds[currentRound]} 轮，奖池：${pot}`);
  nextPlayer();
}

function playerAction(action, index, amount = 0) {
  const player = players[index];
  if (index !== currentPlayerIndex) {
    alert("不是当前玩家的回合！");
    return;
  }
  switch (action) {
    case "check":
      // 当前玩家已投入金额等于 currentBet 才可 check
      if (player.bet < currentBet) {
        alert("当前有下注，不能选择 Check！");
        return;
      }
      break;
    case "call":
      const callAmount = currentBet - player.bet;
      // 对于预翻牌阶段若大盲处于特殊情况，可允许 callAmount 为0
      if (callAmount === 0) {
        // 如果不是大盲特殊情况则提示无需跟注
        if (!(currentRound === 0 && players.length !== 2 && index === ((players.findIndex(p => p.dealer) + 2) % players.length))) {
          alert("无需跟注！");
          return;
        }
      }
      if (player.chips < callAmount) {
        alert("筹码不足，无法 Call！");
        return;
      }
      player.chips -= callAmount;
      player.bet += callAmount;
      pot += callAmount;
      break;
    case "raise":
      const extra = parseInt(amount);
      const newTotal = player.bet + extra;
      if (isNaN(extra) || newTotal <= currentBet) {
        alert("加注金额必须使总下注高于当前下注！");
        return;
      }
      if (player.chips < extra) {
        alert("筹码不足，无法 Raise！");
        return;
      }
      player.chips -= extra;
      player.bet = newTotal;
      pot += extra;
      currentBet = newTotal;
      // 记录此次 raise 的玩家，后续回到他时本轮结束
      lastToActIndex = index;
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
}

function nextPlayer() {
  const activePlayers = players.filter(player => !player.folded);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winner.chips += pot;
    updateGameLog(`${winner.name} 赢得了该局，奖池：${pot}`);
    showNextHandButton();
    return;
  }
  // 递增 currentPlayerIndex（跳过已 Fold 玩家）
  do {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  } while (players[currentPlayerIndex].folded);

  // 如果回到了 lastToActIndex，则本轮结束
  if (currentPlayerIndex === lastToActIndex) {
    endRound();
  } else {
    updateGameLog(`轮到 ${players[currentPlayerIndex].name} 操作`);
    updatePlayerBoxes();
  }
}

function endRound() {
  // 仅在当前轮结束后未达到最后一轮时，进入下一轮
  if (currentRound < 3) {
    currentRound++;
    startRound();
  } else {
    endGame();
  }
}

function endGame() {
  const winnerNames = prompt("请输入赢家的名字（多个赢家用空格分隔）：");
  const winnerList = winnerNames.split(' ').map(name => name.trim());
  const winners = players.filter(player => winnerList.includes(player.name));
  if (winners.length > 0) {
    const splitPot = Math.floor(pot / winners.length);
    winners.forEach(winner => {
      winner.chips += splitPot;
      updateGameLog(`${winner.name} 赢得了 ${splitPot} 筹码！`);
    });
    resetGame();
  } else {
    alert("未找到赢家！");
  }
}

function resetGame() {
  currentRound = 0;
  players.forEach(player => {
    player.bet = 0;
    player.folded = false;
  });
  startRound();
}

function resetHand() {
  currentRound = 0;
  players.forEach(player => {
    player.bet = 0;
    player.folded = false;
  });
  rotateDealer();
  startRound();
}

function rotateDealer() {
  const currentDealerIndex = players.findIndex(player => player.dealer);
  players[currentDealerIndex].dealer = false;
  const nextDealerIndex = (currentDealerIndex + 1) % players.length;
  players[nextDealerIndex].dealer = true;
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

function updatePlayerBoxes() {
  const playerBoxesContainer = document.getElementById("player-boxes");
  playerBoxesContainer.innerHTML = "";
  players.forEach((player, index) => {
    const playerBox = document.createElement("div");
    playerBox.classList.add("player-box");
    if (player.folded) playerBox.classList.add("folded");
    if (index === currentPlayerIndex) playerBox.classList.add("active");
    playerBox.innerHTML = `
      <p><strong>${player.name}</strong></p>
      <p>位置: ${index === 0 ? "Dealer" : index === 1 ? "小盲" : index === 2 ? "大盲" : "普通玩家"}</p>
      <p>状态: ${player.folded ? "Folded" : player.bet > 0 ? `Bet ${player.bet}` : "未轮到"}</p>
      <p>剩余筹码: ${player.chips}</p>
      <div class="actions">
        <button onclick="playerAction('check', ${index})" ${currentPlayerIndex !== index || currentBet > 0 ? "disabled" : ""}>Check</button>
        <button onclick="playerAction('call', ${index})" ${currentPlayerIndex !== index || currentBet === 0 ? "disabled" : ""}>Call</button>
        <button onclick="showRaiseInput(${index})" ${currentPlayerIndex !== index ? "disabled" : ""}>Raise</button>
        <button onclick="playerAction('fold', ${index})" ${currentPlayerIndex !== index ? "disabled" : ""}>Fold</button>
        <div id="raise-input-${index}" class="raise-input" style="display: none;">
          <input type="number" id="raise-amount-${index}" placeholder="加注金额" />
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
  // 执行 raise 操作：此处 raiseAmount 表示额外下注部分
  playerAction("raise", index, raiseAmount);
  const raiseInputDiv = document.getElementById(`raise-input-${index}`);
  raiseInputDiv.style.display = "none";
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
