const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const imageUpload = document.getElementById('imageUpload');
const output = document.getElementById('output');
const studentList = document.getElementById('student-list');
const copyArea = document.getElementById('copyArea');

const labels = [
  "HUMBERTO LIMA BESSA"
  
];

let labeledFaceDescriptors = null;
let faceMatcher = null;
let studentStatus = {};
let currentImage = null;
let modelsReady = false;

labels.forEach(name => {
  const normalized = name.trim().toUpperCase();
  studentStatus[normalized] = 'Faltou';
  const span = document.createElement('span');
  span.className = 'student absent';
  span.id = `student-${normalized}`;
  span.innerText = name;
  span.onclick = () => toggleStatus(normalized);
  studentList.appendChild(span);
});

function toggleStatus(name) {
  const el = document.getElementById(`student-${name}`);
  if (studentStatus[name] === 'Presente') {
    studentStatus[name] = 'Justificado';
    el.className = 'student note';
  } else if (studentStatus[name] === 'Justificado') {
    studentStatus[name] = 'Faltou';
    el.className = 'student absent';
  } else {
    studentStatus[name] = 'Presente';
    el.className = 'student present';
  }
  updateCopyArea();
}

function updateCopyArea() {
  const today = new Date().toLocaleDateString();
  let result = `Data: ${today}\n`;
  labels.forEach(name => {
    const normalized = name.trim().toUpperCase();
    result += `${name} - ${studentStatus[normalized]}\n`;
  });
  copyArea.value = result;
}

function startLiveMode() {
  video.style.display = 'block';
  imageUpload.style.display = 'none';
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => { video.srcObject = stream; });

  video.addEventListener('playing', () => {
    const interval = setInterval(() => {
      if (video.style.display !== 'none' && modelsReady) {
        recognize(video);
      } else {
        clearInterval(interval);
      }
    }, 1000); // detecta a cada 1 segundo
  });
}

function startImageMode() {
  video.style.display = 'none';
  imageUpload.style.display = 'block';
}

async function loadModels() {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri("models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("models");
    output.innerText = "Modelos carregados.";
    console.log("✅ Modelos carregados.");
  } catch (err) {
    output.innerText = "Erro ao carregar modelos.";
    console.error("❌ Erro ao carregar modelos:", err);
  }
}

async function loadLabeledImages() {
  return Promise.all(
    labels.map(async label => {
      const descriptions = [];
      try {
        const img = await faceapi.fetchImage(`labeled_images/${label}/1.jpg`);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        if (!detection) {
          console.warn("⚠️ Nenhum rosto detectado na imagem de:", label);
        } else {
          console.log("✅ Rosto detectado em:", label);
          descriptions.push(detection.descriptor);
        }
      } catch (e) {
        console.error("❌ Erro ao carregar imagem de:", label, e);
      }
      return new faceapi.LabeledFaceDescriptors(label.trim().toUpperCase(), descriptions);
    })
  );
}

async function recognize(source) {
  if (!faceMatcher) return;

  try {
    const detections = await faceapi.detectAllFaces(
      source,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 })
    ).withFaceLandmarks().withFaceDescriptors();

    const resized = faceapi.resizeResults(detections, { width: source.width, height: source.height });

    const results = resized.map(d => faceMatcher.findBestMatch(d.descriptor));
    const ctx = canvas.getContext('2d');
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    results.forEach((result, i) => {
      const box = resized[i].detection.box;
      const name = result.label;
      const isUnknown = name === "unknown";
      const displayName = isUnknown ? "Desconhecido" : name;

      ctx.strokeStyle = isUnknown ? "red" : "green";
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = "black";
      ctx.font = "16px Arial";
      ctx.fillText(displayName, box.x, box.y - 5);

      if (!isUnknown && studentStatus[name] !== "Presente") {
        studentStatus[name] = "Presente";
        const el = document.getElementById(`student-${name}`);
        if (el) el.className = "student present";
      }
    });

    updateCopyArea();
  } catch (e) {
    console.error("❌ Erro durante o reconhecimento:", e);
  }
}

imageUpload.onchange = async () => {
  currentImage = await faceapi.bufferToImage(imageUpload.files[0]);
  const ctx = canvas.getContext("2d");
  canvas.width = currentImage.width;
  canvas.height = currentImage.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0);
  recognize(currentImage);
};

window.onload = async () => {
  await loadModels();
  const resultados = await loadLabeledImages();
  const descritoresValidos = resultados.filter(lfd => lfd.descriptors.length > 0);
  if (descritoresValidos.length === 0) {
    output.innerText = "Nenhum rosto carregado com sucesso.";
    console.warn("⚠️ Nenhum descritor válido foi carregado.");
    return;
  }

  faceMatcher = new faceapi.FaceMatcher(descritoresValidos, 0.6);
  modelsReady = true;
  output.innerText = `Modelos carregados. Rostos prontos: ${descritoresValidos.length}`;
  console.log(`🧠 faceMatcher pronto com ${descritoresValidos.length} estudantes.`);
};
