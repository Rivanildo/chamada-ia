const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const imageUpload = document.getElementById('imageUpload');
const captureButton = document.getElementById('capture');
const output = document.getElementById('output');
const studentList = document.getElementById('student-list');
const copyArea = document.getElementById('copyArea');

const labels = [
  "ALLANY URIELLY BERNARDO NEGREIROS",
  "ANTONIO ARTUR MARTINS DAMASIO",
  "BÁRBARA DO RAMO DA SILVA",
  "CARLOS ALEXANDRE DA SILVA",
  "DULCE EMANNUELE DA SILVA",
  "ELOÁ CRISTINA SILVA DO NASCIMENTO",
  "EMANUELLY DE OLIVEIRA DA SILVA",
  "ESMERALDA ANGELA DA SILVA",
  "ESTHEFANY DO NASCIMENTO SANTOS",
  "FELIPE BARRETO DE MOURA",
  "GABRIELE SIPRIANO DOS SANTOS",
  "HUMBERTO LIMA BESSA",
  "IAGO FERNANDES SILVA OLIVEIRA",
  "JOSUE JEFFERSON DOS SANTOS NASCIEMENTO",
  "JULIANA SANTOS DO NASCIMENTO",
  "LAIS CLAUDIA DA CONCEIÇÃO",
  "MARIA ADRIELLY KEMILLY DA SILVA",
  "MARIA DA GUIA DA SILVA FELINTO",
  "MATHEUS LIMA DE ARAÚJO",
  "NARCISO PINTO DE FREITAS TERCEIRO",
  "PEDRO HENRIQUE SILVA DE SOUZA",
  "PETALA CRISTINA DA SILVA SANTOS",
  "SABRINA SOUSA DO NASCIMENTO",
  "TASSYELL DA SILVA SOARES",
  "THAYANE RAKELY DOS SANTOS LUIZ",
  "VICTORIAH GABRIELLY SILVA TAVARES"
];

let labeledFaceDescriptors = null;
let faceMatcher = null;
let studentStatus = {};
let currentImage = null;

labels.forEach(name => {
  studentStatus[name] = 'Faltou';
  const span = document.createElement('span');
  span.className = 'student absent';
  span.id = `student-${name}`;
  span.innerText = name;
  span.onclick = () => toggleStatus(name);
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
    result += `${name} - ${studentStatus[name]}\n`;
  });
  copyArea.value = result;
}

function startLiveMode() {
  video.style.display = 'block';
  imageUpload.style.display = 'none';
  captureButton.style.display = 'block';
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => { video.srcObject = stream; });
}

function startImageMode() {
  video.style.display = 'none';
  imageUpload.style.display = 'block';
  captureButton.style.display = 'block';
}

async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("models");
  await faceapi.nets.faceLandmark68Net.loadFromUri("models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("models");
  output.innerText = "Modelos carregados.";
}

async function loadLabeledImages() {
  return Promise.all(
    labels.map(async label => {
      const descriptions = [];
      for (let i = 1; i <= 1; i++) {
        const img = await faceapi.fetchImage(`labeled_images/${label}/${i}.jpg`);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        if (detection) descriptions.push(detection.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

async function recognize(source) {
  const detections = await faceapi.detectAllFaces(source, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
  const resized = faceapi.resizeResults(detections, { width: source.width, height: source.height });
  const results = resized.map(d => faceMatcher.findBestMatch(d.descriptor));
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);

  results.forEach((result, i) => {
    const box = resized[i].detection.box;
    const name = result.label;
    ctx.strokeStyle = name === "unknown" ? "red" : "green";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = "black";
    ctx.fillText(name, box.x, box.y - 5);

    if (name !== "unknown") {
      studentStatus[name] = "Presente";
      const el = document.getElementById(`student-${name}`);
      if (el) el.className = "student present";
    }
  });

  updateCopyArea();
}

captureButton.onclick = () => {
  if (video.style.display !== "none") {
    recognize(video);
  } else if (currentImage) {
    recognize(currentImage);
  }
};

imageUpload.onchange = async () => {
  currentImage = await faceapi.bufferToImage(imageUpload.files[0]);
  currentImage.width = 720;
  currentImage.height = 560;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0);
};

window.onload = async () => {
  await loadModels();
  labeledFaceDescriptors = await loadLabeledImages();
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
};