/* ================= GLOBAL ================= */
let mqttClient;
let mqttConnected = false;

let lastSeen = { k: 0, h: 0, a: 0, s: 0 };

/* ================= LOGIN ================= */
window.login = function () {
  const user = document.getElementById("username")?.value;
  const pass = document.getElementById("password")?.value;
  const err  = document.getElementById("loginError");

  if (user === "D3TE24" && pass === "D3TE24") {
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    if (err) err.innerText = "";
    if (!mqttConnected) connectMQTT();
  } else {
    if (err) err.innerText = "❌ Username atau Password Salah";
  }
};

/* ================= LOGOUT ================= */
window.logout = function () {
  if (mqttClient && mqttConnected) mqttClient.end(true);
  mqttConnected = false;
  location.reload();
};

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
    mqttClient.subscribe("sensor/esp32/#");
    mqttClient.subscribe("esp32/ntc#");
  });

  mqttClient.on("message", (topic, msg) => {
    const raw = msg.toString();

    /* ===== SOIL DIGITAL ===== */
    if (topic === "sensor/esp32/soil/digital") {
      const basah = raw === "1" || raw === "HIGH" || raw === "true";
      setText("soilStatus", basah ? "BASAH 🌊" : "KERING 🔥");
      setText("soil Digital", raw);
      lastSeen.h = Date.now();
      logRealtime("Hasnul", "Status Tanah", basah ? "BASAH" : "KERING");
      return;
    }

    const v = parseFloat(raw);
    if (isNaN(v)) return;

    /* ===== KRISNA (DHT) ===== */
    if (topic === "sensor/esp32/temperature1") {
      setText("Suhu", v.toFixed(0));
      lastSeen.k = Date.now();
      logRealtime("Krisna", "Suhu", v, "°C");
    }

    if (topic === "sensor/esp32/humidity1") {
      setText("Kelembapan", v.toFixed(0));
      lastSeen.k = Date.now();
      logRealtime("Krisna", "Kelembapan", v, "%");
    }

    /* ===== SITA (AIR) ===== */
    if (topic === "iot/sensor/suhu") {
      setText("waterTemp", v.toFixed(1));
      lastSeen.s = Date.now();
      logRealtime("Sita", "Suhu", v, "°C");
    }

    if (topic === "iot/sensor/kelembapan") {
      setText("waterHum", v.toFixed(0));
      lastSeen.s = Date.now();
      logRealtime("Sita", "Kelembapan Air", v, "%");
    }

    if (topic === "iot/sensor/waterlevel") {
      setText("water", v);
      lastSeen.s = Date.now();
      logRealtime("Sita", "Water Level", v);
    }

    /* ===== HASNUL (SOIL ANALOG) ===== */
    if (topic === "sensor/esp32/temperature") {
      setText("soilSuhu", v.toFixed(1));
      lastSeen.h = Date.now();
      logRealtime("Hasnul", "Suhu", v, "°C");
    }

    if (topic === "sensor/esp32/humidity") {
      setText("soilHum", v.toFixed(0));
      lastSeen.h = Date.now();
      logRealtime("Hasnul", "Kelembapan", v, "%");
    }

    if (topic === "sensor/esp32/soil/analog") {
      setText("soilAnalog", v);
      lastSeen.h = Date.now();
      logRealtime("Hasnul", "Kelembapan Tanah", v, "%");
    }

    /* ===== ARIF (NTC) ===== */
    if (topic === "esp32/ntc") {
      setText("ntc", v.toFixed(1));
      lastSeen.a = Date.now();
      logRealtime("Arif", "Suhu NTC", v, "°C");
    }
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

/* ================= PARTICLE BACKGROUND ================= */
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

  const sparkles = Array.from({ length: 180 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 0.6,
    s: Math.random() * 0.8 + 0.3,
    o: Math.random()
  }));

  (function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparkles.forEach(p => {
      ctx.globalAlpha = p.o;
      ctx.fillStyle = "#00eaff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.s;
      if (p.y > canvas.height) p.y = 0;
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  })();
});

/* ================= INFO MODAL ================= */
window.showInfo = function (type) {
  const modal = document.getElementById("infoModal");
  const title = document.getElementById("infoTitle");
  const text  = document.getElementById("infoText");

  const info = {
    home: ["🏠 Home", "Merupakan Dashboard untuk monitoring ESP32 secara realtime berbasis broker MQTT."],
    about: ["ℹ About", "Sistem IoT ESP32 + MQTT + Web SCADA."],
    service: ["🛠 Service", "Monitoring suhu, kelembapan, soil, NTC, dan water level."],
    design: ["🎨 Design", "Menggunakan Visual Code dan Github."],
    contact: ["📞 Contact", "d3teknologielektronika24@gmail.com"]
  };

  if (!info[type] || !modal) return;

  title.innerText = info[type][0];
  text.innerText  = info[type][1];
  modal.style.display = "flex";
  setTimeout(() => modal.style.display = "none", 4000);
};
