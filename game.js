
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// =====================================
// FUTOF 0.1 - MOTOR DEL JUEGO
// =====================================

const game = document.getElementById("game");
const loading = document.getElementById("loading");
const message = document.getElementById("message");
const scoreText = document.getElementById("score");
const clockText = document.getElementById("clock");

let scene, camera, renderer;
let player, ball;
let bluePlayers = [];
let redPlayers = [];

let scoreBlue = 0;
let scoreRed = 0;
let elapsed = 0;
let lastTime = 0;
let running = true;
let sprinting = false;

const FIELD_WIDTH = 30;
const FIELD_LENGTH = 48;
const FIELD_LIMIT_X = 13.5;
const FIELD_LIMIT_Z = 22;

const keys = {};
const joystick = { x: 0, y: 0, active: false };
const ballVelocity = new THREE.Vector3();
const moveDirection = new THREE.Vector3();

const clock = new THREE.Clock();

// =====================================
// INICIALIZACIÓN
// =====================================

try {
  init();
  animate();
} catch (error) {
  console.error(error);
  loading.innerHTML = `
    <div class="loading-logo">FUTOF</div>
    <div class="loading-text">
      No se pudo iniciar el juego. Revisá la conexión e intentá de nuevo.
    </div>
  `;
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7895a5);
  scene.fog = new THREE.Fog(0x7895a5, 45, 95);

  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    150
  );

  camera.position.set(0, 12, 19);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "0";

  game.prepend(renderer.domElement);

  addLights();
  createStadium();
  createField();
  createGoals();
  createPlayers();
  createBall();
  setupControls();

  window.addEventListener("resize", resize);

  loading.style.display = "none";
  showMessage("¡Comienza el partido!");
}

// =====================================
// ILUMINACIÓN
// =====================================

function addLights() {
  const ambient = new THREE.HemisphereLight(
    0xffffff,
    0x304a36,
    2
  );

  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-12, 25, 12);
  scene.add(sun);
}

// =====================================
// ESTADIO
// =====================================

function createStadium() {
  const standMaterial = new THREE.MeshStandardMaterial({
    color: 0x25394b,
    roughness: 0.9
  });

  const seatMaterial = new THREE.MeshStandardMaterial({
    color: 0x426079
  });

  // Suelo exterior
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x263b32 })
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  scene.add(ground);

  // Gradas laterales
  for (let side of [-1, 1]) {
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(5, 4, 56),
      standMaterial
    );

    stand.position.set(side * 18, 1.5, 0);
    scene.add(stand);

    for (let row = 0; row < 4; row++) {
      const seats = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.25, 53),
        seatMaterial
      );

      seats.position.set(
        side * (15.8 + row * 0.8),
        3 + row * 0.3,
        0
      );

      scene.add(seats);
    }
  }

  // Gradas detrás de las porterías
  for (let side of [-1, 1]) {
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(35, 4, 4),
      standMaterial
    );

    stand.position.set(0, 1.5, side * 27);
    scene.add(stand);

    for (let row = 0; row < 3; row++) {
      const seats = new THREE.Mesh(
        new THREE.BoxGeometry(32, 0.25, 0.7),
        seatMaterial
      );

      seats.position.set(
        0,
        3 + row * 0.3,
        side * (24.7 + row * 0.8)
      );

      scene.add(seats);
    }
  }
}

// =====================================
// CAMPO DE FÚTBOL
// =====================================

function createField() {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH),
    new THREE.MeshStandardMaterial({
      color: 0x21834b,
      roughness: 1
    })
  );

  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0;
  scene.add(grass);

  // Franjas del césped
  for (let i = 0; i < 8; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH / 8),
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x000000 : 0xffffff,
        transparent: true,
        opacity: 0.045
      })
    );

    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(
      0,
      0.012,
      -FIELD_LENGTH / 2 + FIELD_LENGTH / 16 + i * FIELD_LENGTH / 8
    );

    scene.add(stripe);
  }

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff
  });

  function line(points) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p[0], 0.035, p[1]))
    );

    scene.add(new THREE.Line(geometry, lineMaterial));
  }

  // Bordes
  line([
    [-15, -24], [15, -24],
    [15, 24], [-15, 24], [-15, -24]
  ]);

  // Mitad del campo
  line([[-15, 0], [15, 0]]);

  // Círculo central
  const circlePoints = [];

  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;

    circlePoints.push([
      Math.cos(angle) * 4,
      Math.sin(angle) * 4
    ]);
  }

  line(circlePoints);

  // Áreas y pequeñas áreas
  for (let side of [-1, 1]) {
    const z = side * 24;
    const inner = side * 18;

    line([
      [-8, z],
      [-8, inner],
      [8, inner],
      [8, z]
    ]);

    const small = side * 21;

    line([
      [-3.5, z],
      [-3.5, small],
      [3.5, small],
      [3.5, z]
    ]);
  }
}

// =====================================
// PORTERÍAS
// =====================================

function createGoals() {
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3
  });

  const netMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.2
  });

  for (let side of [-1, 1]) {
    const z = side * 24;

    for (let x of [-3, 3]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 2.3, 8),
        postMaterial
      );

      post.position.set(x, 1.15, z);
      scene.add(post);
    }

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(6.1, 0.12, 0.12),
      postMaterial
    );

    bar.position.set(0, 2.3, z);
    scene.add(bar);

    const net = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.2, 1.5),
      netMaterial
    );

    net.position.set(0, 1.1, z + side * 0.7);
    scene.add(net);
  }
}

// =====================================
// JUGADORES
// =====================================

function createFootballer(color, number, x, z) {
  const group = new THREE.Group();

  const shirtMaterial = new THREE.MeshStandardMaterial({
    color
  });

  const shortsMaterial = new THREE.MeshStandardMaterial({
    color: 0x17212b
  });

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9a47c
  });

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 0.9, 10),
    shirtMaterial
  );

  torso.position.y = 1.05;
  group.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 12, 12),
    skinMaterial
  );

  head.position.y = 1.72;
  group.add(head);

  const shorts = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.3, 0.42),
    shortsMaterial
  );

  shorts.position.y = 0.52;
  group.add(shorts);

  const legs = [];

  for (let side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.11, 0.65, 8),
      shortsMaterial
    );

    leg.position.set(side * 0.18, 0.2, 0);
    group.add(leg);
    legs.push(leg);
  }

  group.position.set(x, 0, z);
  group.userData.number = number;
  group.userData.legs = legs;
  group.userData.home = new THREE.Vector3(x, 0, z);

  scene.add(group);

  return group;
}

function createPlayers() {
  // Equipo azul
  player = createFootballer(0x1689ed, 10, 0, 9);

  bluePlayers.push(player);

  bluePlayers.push(
    createFootballer(0x1689ed, 7, -8, 4),
    createFootballer(0x1689ed, 9, 8, 4),
    createFootballer(0x1689ed, 5, -5, 16),
    createFootballer(0x1689ed, 4, 5, 16)
  );

  // Equipo rojo
  redPlayers.push(
    createFootballer(0xe94b4b, 1, 0, -10),
    createFootballer(0xe94b4b, 2, -8, -5),
    createFootballer(0xe94b4b, 3, 8, -5),
    createFootballer(0xe94b4b, 6, -5, -17),
    createFootballer(0xe94b4b, 8, 5, -17)
  );
}

// =====================================
// BALÓN
// =====================================

function createBall() {
  ball = new THREE.Group();

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65
    })
  );

  ball.add(sphere);

  const patchMaterial = new THREE.MeshStandardMaterial({
    color: 0x171717
  });

  const positions = [
    [0, 0.17, 0],
    [0.16, 0, 0.08],
    [-0.16, 0, -0.08],
    [0, -0.17, 0],
    [0.08, 0.08, -0.16]
  ];

  positions.forEach(pos => {
    const patch = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 8, 8),
      patchMaterial
    );

    patch.position.set(...pos);
    ball.add(patch);
  });

  ball.position.set(0, 0.25, 8);
  scene.add(ball);
}

// =====================================
// CONTROLES
// =====================================

function setupControls() {
  const zone = document.getElementById("joystick-zone");
  const stick = document.getElementById("joystick-stick");

  zone.addEventListener("pointerdown", event => {
    event.preventDefault();
    joystick.active = true;
    zone.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });

  zone.addEventListener("pointermove", event => {
    if (!joystick.active) return;
    updateJoystick(event);
  });

  function releaseJoystick() {
    joystick.active = false;
    joystick.x = 0;
    joystick.y = 0;
    stick.style.transform = "translate(0px, 0px)";
  }

  zone.addEventListener("pointerup", releaseJoystick);
  zone.addEventListener("pointercancel", releaseJoystick);
  zone.addEventListener("lostpointercapture", releaseJoystick);

  function updateJoystick(event) {
    const rect = zone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const max = 35;
    const distance = Math.hypot(dx, dy);

    if (distance > max) {
      dx = (dx / distance) * max;
      dy = (dy / distance) * max;
    }

    joystick.x = dx / max;
    joystick.y = dy / max;

    stick.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // Botones
  document.getElementById("shoot").addEventListener("pointerdown", event => {
    event.preventDefault();
    kickBall(19);
  });

  document.getElementById("pass").addEventListener("pointerdown", event => {
    event.preventDefault();
    kickBall(11);
  });

  const sprintButton = document.getElementById("sprint");

  sprintButton.addEventListener("pointerdown", event => {
    event.preventDefault();
    sprinting = true;
  });

  sprintButton.addEventListener("pointerup", () => {
    sprinting = false;
  });

  sprintButton.addEventListener("pointercancel", () => {
    sprinting = false;
  });

  sprintButton.addEventListener("lostpointercapture", () => {
    sprinting = false;
  });

  // Teclado para PC
  window.addEventListener("keydown", event => {
    keys[event.key.toLowerCase()] = true;

    if (event.key === "Shift") sprinting = true;

    if (event.key === " " && !event.repeat) {
      event.preventDefault();
      kickBall(19);
    }

    if (event.key.toLowerCase() === "e" && !event.repeat) {
      kickBall(11);
    }
  });

  window.addEventListener("keyup", event => {
    keys[event.key.toLowerCase()] = false;

    if (event.key === "Shift") sprinting = false;
  });

  window.addEventListener("blur", () => {
    sprinting = false;
    joystick.active = false;
    joystick.x = 0;
    joystick.y = 0;
  });
}

// =====================================
// PASE Y TIRO
// =====================================

function kickBall(power) {
  const distance = player.position.distanceTo(ball.position);

  if (distance > 2.5) {
    showMessage("Acercate al balón");
    return;
  }

  const direction = new THREE.Vector3(
    moveDirection.x,
    0,
    moveDirection.z
  );

  if (direction.length() < 0.1) {
    direction.set(0, 0, -1);
  }

  direction.normalize();

  ball.position.copy(player.position);
  ball.position.y = 0.25;
  ball.position.addScaledVector(direction, 1);

  ballVelocity.copy(direction.multiplyScalar(power));
  ballVelocity.y = 0;

  showMessage(power > 15 ? "¡Disparo!" : "¡Pase!");
}

// =====================================
// MOVIMIENTO DEL JUGADOR
// =====================================

function updatePlayer(delta) {
  let x = joystick.x;
  let z = joystick.y;

  if (keys["a"] || keys["arrowleft"]) x = -1;
  if (keys["d"] || keys["arrowright"]) x = 1;
  if (keys["w"] || keys["arrowup"]) z = -1;
  if (keys["s"] || keys["arrowdown"]) z = 1;

  const direction = new THREE.Vector3(x, 0, z);

  if (direction.length() > 1) {
    direction.normalize();
  }

  moveDirection.copy(direction);

  const speed = sprinting ? 10 : 6;

  player.position.x += direction.x * speed * delta;
  player.position.z += direction.z * speed * delta;

  player.position.x = THREE.MathUtils.clamp(
    player.position.x,
    -FIELD_LIMIT_X,
    FIELD_LIMIT_X
  );

  player.position.z = THREE.MathUtils.clamp(
    player.position.z,
    -FIELD_LIMIT_Z,
    FIELD_LIMIT_Z
  );

  if (direction.length() > 0.05) {
    player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  player.userData.legs.forEach((leg, index) => {
    leg.rotation.x = direction.length() > 0.05
      ? Math.sin(elapsed * 12 + index * Math.PI) * 0.5
      : 0;
  });
}

// =====================================
// IA DEL EQUIPO ROJO
// =====================================

function updateOpponents(delta) {
  redPlayers.forEach((opponent, index) => {
    const target = index === 0
      ? ball.position
      : opponent.userData.home;

    const direction = new THREE.Vector3(
      target.x - opponent.position.x,
      0,
      target.z - opponent.position.z
    );

    const distance = direction.length();

    if (distance > 0.2) {
      direction.normalize();

      const speed = index === 0 ? 3.2 : 1.2;

      opponent.position.addScaledVector(
        direction,
        speed * delta
      );

      opponent.position.x = THREE.MathUtils.clamp(
        opponent.position.x,
        -FIELD_LIMIT_X,
        FIELD_LIMIT_X
      );

      opponent.position.z = THREE.MathUtils.clamp(
        opponent.position.z,
        -FIELD_LIMIT_Z,
        FIELD_LIMIT_Z
      );

      opponent.rotation.y = Math.atan2(direction.x, direction.z);
    }

    // El primer rival intenta recuperar el balón
    if (
      index === 0 &&
      opponent.position.distanceTo(ball.position) < 1.2 &&
      ballVelocity.length() < 2
    ) {
      ballVelocity.set(
        (Math.random() - 0.5) * 3,
        0,
        9
      );

      showMessage("¡El rival recuperó el balón!");
    }
  });
}

// =====================================
// FÍSICA DEL BALÓN
// =====================================

function updateBall(delta) {
  ball.position.x += ballVelocity.x * delta;
  ball.position.z += ballVelocity.z * delta;

  // Fricción
  const friction = Math.pow(0.96, delta * 60);

  ballVelocity.multiplyScalar(friction);

  if (ballVelocity.length() < 0.15) {
    ballVelocity.set(0, 0, 0);
  }

  // Límites laterales
  if (Math.abs(ball.position.x) > 14) {
    ball.position.x = THREE.MathUtils.clamp(
      ball.position.x,
      -14,
      14
    );

    ballVelocity.x *= -0.65;
  }

  // Animación de giro
  ball.rotation.x += ballVelocity.z * delta;
  ball.rotation.z -= ballVelocity.x * delta;

  // Gol azul
  if (
    ball.position.z < -23.5 &&
    Math.abs(ball.position.x) < 3
  ) {
    scoreBlue++;
    updateScore();
    resetBall("¡GOOOOL DEL EQUIPO AZUL!");
  }

  // Gol rojo
  if (
    ball.position.z > 23.5 &&
    Math.abs(ball.position.x) < 3
  ) {
    scoreRed++;
    updateScore();
    resetBall("¡GOOOL DEL EQUIPO ROJO!");
  }
}

// =====================================
// CÁMARA
// =====================================

function updateCamera(delta) {
  const targetPosition = new THREE.Vector3(
    player.position.x,
    11,
    player.position.z + 10
  );

  camera.position.lerp(
    targetPosition,
    Math.min(1, delta * 3)
  );

  const lookTarget = new THREE.Vector3(
    player.position.x,
    0,
    player.position.z - 5
  );

  camera.lookAt(lookTarget);
}

// =====================================
// MARCADOR Y MENSAJES
// =====================================

function updateScore() {
  scoreText.textContent = `${scoreBlue} - ${scoreRed}`;
}

let messageTimeout;

function showMessage(text) {
  message.textContent = text;
  message.style.display = "block";

  clearTimeout(messageTimeout);

  messageTimeout = setTimeout(() => {
    message.textContent = "PARTIDO EN JUEGO";
  }, 1800);
}

function resetBall(text) {
  showMessage(text);

  ball.position.set(0, 0.25, 0);
  ballVelocity.set(0, 0, 0);

  player.position.set(0, 0, 9);
  player.rotation.y = Math.PI;

  redPlayers.forEach(opponent => {
    opponent.position.copy(opponent.userData.home);
  });
}

// =====================================
// RELOJ
// =====================================

function updateClock(delta) {
  elapsed += delta;

  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);

  clockText.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// =====================================
// CAMBIAR TAMAÑO DE PANTALLA
// =====================================

function resize() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
}

// =====================================
// BUCLE PRINCIPAL
// =====================================

function animate() {
  if (!running) return;

  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  updatePlayer(delta);
  updateOpponents(delta);
  updateBall(delta);
  updateCamera(delta);
  updateClock(delta);

  renderer.render(scene, camera);
}
