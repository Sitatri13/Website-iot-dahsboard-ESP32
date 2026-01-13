/* ================= GLOBAL ================= */
let mqttClient;
let mqttConnected = false;

let lastSeen = { k: 0, h: 0, a: 0, s: 0 };

// === DATA TERAKHIR ===
let lastKrisnaTemp = 0;
let lastKrisnaHum  = 0;

let lastSitaTemp   = 0;
let lastSitaHum    = 0;
let lastWater      = 0;

let lastSoilTemp   = 0;
let lastSoilHum    = 0;
let lastSoil       = 0;

let lastNtcTemp    = 0;

/* ================= LOGIN ================= */
window.login = function () {
  const user = document.getElementById("username")?.value;
  const pass = document.getElementById("password")?.value;
  const err  = document.getElementById("loginError");

  if (user === "D3TE24" && pass === "D3TE24") {
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    connectMQTT();
  } else {
    if (err) err.innerText = "❌ Username atau Password Salah";
  }
};

window.logout = () => location.reload();

/* ================= TIME ================= */
const nowTime = () => new Date().toLocaleTimeString("id-ID");

/* ================= LOG REALTIME ================= */
function logRealtime(nama, sensor, nilai, satuan = "") {
  const box = document.getElementById("logBox");
  if (!box) return;

  box.innerHTML += `
    <div class="log-line">
      ${nowTime()} | ${nama} | ${sensor}: ${nilai} ${satuan}
    </div>`;
  box.scrollTop = box.scrollHeight;
}

/* ================= CHART ================= */
let multiSensorChart;

function initChart() {
  const canvas = document.getElementById("multiSensorChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  multiSensorChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        ds("🌡 Krisna (DHT)", "#00eaff"),
        ds("💧 Krisna (Hum)", "#00ff9c"),
        ds("🌱 Soil (Hasnul)", "#7cff00"),
        ds("🌡 NTC (Arif)", "#ffb300"),
        ds("💧 Water Level (Sita)", "#ff4c4c")
      ]
    },
    options: {
      responsive: true,
      animation: false,
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: { ticks: { color: "#7fdfff" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#7fdfff" }, grid: { color: "rgba(255,255,255,0.07)" } }
      },
      plugins: {
        legend: { labels: { color: "#00eaff" } }
      }
    }
  });
}

const ds = (label, color) => ({
  label,
  data: [],
  borderColor: color,
  backgroundColor: color + "33",
  tension: 0.45,
  fill: true,
  pointRadius: 0
});

function updateChart() {
  if (!multiSensorChart) return;

  if (multiSensorChart.data.labels.length > 30) {
    multiSensorChart.data.labels.shift();
    multiSensorChart.data.datasets.forEach(d => d.data.shift());
  }

  multiSensorChart.data.labels.push(nowTime());
  multiSensorChart.data.datasets[0].data.push(lastKrisnaTemp);
  multiSensorChart.data.datasets[1].data.push(lastKrisnaHum);
  multiSensorChart.data.datasets[2].data.push(lastSoil);
  multiSensorChart.data.datasets[3].data.push(lastNtcTemp);
  multiSensorChart.data.datasets[4].data.push(lastWater);

  multiSensorChart.update();
}

/* ================= MQTT ================= */
function connectMQTT() {
  mqttClient = mqtt.connect("wss://broker.hivemq.com:8884/mqtt", {
    clientId: "WEB_SCADA_" + Math.random().toString(16).slice(2),
    clean: true,
    reconnectPeriod: 3000
  });

  mqttClient.on("connect", () => {
    mqttConnected = true;
    logRealtime("SYSTEM", "MQTT", "CONNECTED");
    mqttClient.subscribe("iot/sensor/#");
    initChart();
  });

  mqttClient.on("reconnect", () => {
    logRealtime("SYSTEM", "MQTT", "RECONNECTING");
  });

  mqttClient.on("close", () => {
    mqttConnected = false;
    logRealtime("SYSTEM", "MQTT", "DISCONNECTED");
  });

  mqttClient.on("error", err => {
    console.error("MQTT ERROR:", err);
  });

  mqttClient.on("message", (topic, msg) => {
    const v = parseFloat(msg.toString());
    if (isNaN(v)) return;

    /* ===== KRISNA ===== */
    if (topic === "iot/sensor/krisna/suhu") {
      setText("suhu", v.toFixed(0));
      lastKrisnaTemp = v;
      lastSeen.k = Date.now();
      logRealtime("Krisna", "Suhu", v, "°C");
    }

    if (topic === "iot/sensor/krisna/kelembapan") {
      setText("kelembapan", v.toFixed(0));
      lastKrisnaHum = v;
      lastSeen.k = Date.now();
      logRealtime("Krisna", "Kelembapan", v, "%");
    }

    /* ===== SITA ===== */
    if (topic === "iot/sensor/suhu") {
      setText("waterTemp", v.toFixed(1));
      lastSitaTemp = v;
      lastSeen.s = Date.now();
      logRealtime("Sita", "Suhu ", v, "°C");
    }

    if (topic === "iot/sensor/kelembapan") {
      setText("waterHum", v.toFixed(0));
      lastSitaHum = v;
      lastSeen.s = Date.now();
      logRealtime("Sita", "Kelembapan Air", v, "%");
    }

    if (topic === "iot/sensor/waterlevel") {
      setText("water", v);
      lastWater = v;
      lastSeen.s = Date.now();
      logRealtime("Sita", "Water Level", v);
    }

    /* ===== HASNUL ===== */
    if (topic === "sensor/esp32/temperature") {
      setText("soilSuhu", v.toFixed(1));
      lastSoilTemp = v;
      lastSeen.h = Date.now();
      logRealtime("Hasnul", "Suhu Tanah", v, "°C");
    }

    if (topic === "sensor/esp32/humidity") {
      setText("soilHum", v.toFixed(0));
      lastSoilHum = v;
      lastSeen.h = Date.now();
      logRealtime("Hasnul", "Kelembapan Tanah", v, "%");
    }

    if (topic === "sensor/esp32/soil/analog") {
      setText("soilAnalog", v);
      lastSoil = v;
      lastSeen.h = Date.now();
      logRealtime("Hasnul", "Soil Analog", v);
    }

    if (topic === "sensor/esp32/soil/digital") {
      setText("soilStatus", v ? "BASAH" : "KERING");
      lastSeen.h = Date.now();
    }

    /* ===== ARIF ===== */
    if (topic === "iot/sensor/ntc") {
      setText("ntc", v.toFixed(1));
      lastNtcTemp = v;
      lastSeen.a = Date.now();
      logRealtime("Arif", "Suhu NTC", v, "°C");
    }

    updateChart();
  });
}

/* ================= STATUS ONLINE ================= */
setInterval(() => {
  updateStatus("statusKrisna", lastSeen.k);
  updateStatus("statusHasnul", lastSeen.h);
  updateStatus("statusArif", lastSeen.a);
  updateStatus("statusSita", lastSeen.s);
}, 2000);

function updateStatus(id, last) {
  const el = document.getElementById(id);
  if (!el) return;

  const online = Date.now() - last < 5000;
  el.className = online ? "status online" : "status offline";
  el.innerText = online ? "ONLINE" : "OFFLINE";
}

/* ================= UTIL ================= */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

/* ================= PARTICLE SPARKLES ================= */
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("particles");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const stars = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 0.5,
    s: Math.random() * 0.8 + 0.2
  }));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00eaff";

    stars.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.s;
      if (p.y > canvas.height) p.y = 0;
    });

    requestAnimationFrame(animate);
  }
  animate();
});

/* ================= INFO MENU ================= */
window.showInfo = function (type) {
  const modal = document.getElementById("infoModal");
  const title = document.getElementById("infoTitle");
  const text  = document.getElementById("infoText");

  const info = {
    home: ["🏠 Home", "Dashboard monitoring ESP32 realtime berbasis MQTT."],
    about: ["ℹ About", "Sistem IoT ESP32 + MQTT + Web SCADA."],
    service: ["🛠 Service", "Monitoring suhu, kelembapan, soil, NTC, dan water level."],
    design: ["🎨 Design", "Industrial futuristic SCADA interface."],
    contact: ["📞 Contact", "d3teknologielektronika24@gmail.com"]
  };

  if (!info[type] || !modal) return;

  title.innerText = info[type][0];
  text.innerText  = info[type][1];
  modal.style.display = "flex";

  setTimeout(() => modal.style.display = "none", 4000);
};
