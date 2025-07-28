let playerName = "";
let stack = 0;
let bigBlind = 20;

document.getElementById("start-game").addEventListener("click", () => {
  playerName = document.getElementById("player-name").value;
  stack = parseInt(document.getElementById("initial-stack").value);
  bigBlind = parseInt(document.getElementById("big-blind").value);

  document.getElementById("setup").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.getElementById("player-header").textContent = `玩家：${playerName}`;
  updateChipInfo();
});

function updateChipInfo() {
  document.getElementById("chip-info").textContent = `当前筹码：${stack}`;
}

document.querySelectorAll(".bet-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const multiplier = parseInt(btn.dataset.multiplier);
    const amount = multiplier * bigBlind;
    placeBet(amount);
  });
});

document.getElementById("manual-bet-btn").addEventListener("click", () => {
  const amount = parseInt(document.getElementById("manual-bet").value);
  if (!isNaN(amount)) {
    placeBet(amount);
  }
});

document.getElementById("check-btn").addEventListener("click", () => {
  alert(`${playerName} 选择了 Check`);
});

document.getElementById("fold-btn").addEventListener("click", () => {
  alert(`${playerName} 选择了 Fold`);
});

document.getElementById("all-in").addEventListener("click", () => {
  placeBet(stack);
});

function placeBet(amount) {
  if (amount > stack) {
    alert("筹码不足！");
    return;
  }
  stack -= amount;
  updateChipInfo();
  alert(`${playerName} 下注 ${amount}`);
}
