// Architectural Drift Detector - Frontend Logic with 3D Visualization

const API_BASE = "http://localhost:5000/api/arch-drift";

// State
let currentData = null;
let scene, camera, renderer, controls;
let rotating = false;
let selectedSeverity = "all";

// DOM Elements
const ownerInput = document.getElementById("ownerInput");
const repoInput = document.getElementById("repoInput");
const architectureSelect = document.getElementById("architectureSelect");
const analyzeBtn = document.getElementById("analyzeBtn");
const refreshBtn = document.getElementById("refreshBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const metricsSection = document.getElementById("metricsSection");
const heatmapSection = document.getElementById("heatmapSection");
const violationsSection = document.getElementById("violationsSection");
const governanceSection = document.getElementById("governanceSection");
const architectureEditorSection = document.getElementById("architectureEditorSection");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadFromLocalStorage();
  init3DScene();
});

// Event Listeners
function setupEventListeners() {
  analyzeBtn.addEventListener("click", analyzeRepository);
  refreshBtn.addEventListener("click", analyzeRepository);
  document.getElementById("rotateBtn").addEventListener("click", toggleRotation);
  document.getElementById("resetViewBtn").addEventListener("click", resetView);
  document.getElementById("loadExampleBtn").addEventListener("click", loadExampleDefinition);
  document.getElementById("validateBtn").addEventListener("click", validateArchitecture);

  // Violations filter
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedSeverity = btn.dataset.severity;
      filterViolations();
    });
  });

  // Modal close
  document.querySelector(".modal-close").addEventListener("click", closeModal);
  document.getElementById("violationModal").addEventListener("click", (e) => {
    if (e.target.id === "violationModal") closeModal();
  });
}

// Load from localStorage
function loadFromLocalStorage() {
  const savedOwner = localStorage.getItem("arch_drift_owner");
  const savedRepo = localStorage.getItem("arch_drift_repo");
  if (savedOwner) ownerInput.value = savedOwner;
  if (savedRepo) repoInput.value = savedRepo;
}

// Save to localStorage
function saveToLocalStorage() {
  localStorage.setItem("arch_drift_owner", ownerInput.value);
  localStorage.setItem("arch_drift_repo", repoInput.value);
}

// Analyze Repository
async function analyzeRepository() {
  const owner = ownerInput.value.trim();
  const repo = repoInput.value.trim();
  const architecture = architectureSelect.value;

  if (!owner || !repo) {
    alert("Please enter repository owner and name");
    return;
  }

  saveToLocalStorage();
  showLoading(true);

  try {
    // Fetch violations and heatmap data
    const response = await fetch(`${API_BASE}/violations/${owner}/${repo}?architecture=${architecture}`);
    if (!response.ok) throw new Error("Failed to fetch data");

    const result = await response.json();
    currentData = result.data;

    // Update UI
    updateMetrics(currentData.metrics);
    render3DHeatmap(currentData.heatmap);
    displayViolations(currentData.violations);
    await loadRecommendations(owner, repo, architecture);

    // Show sections
    metricsSection.classList.remove("hidden");
    heatmapSection.classList.remove("hidden");
    violationsSection.classList.remove("hidden");
    governanceSection.classList.remove("hidden");
    architectureEditorSection.classList.remove("hidden");
  } catch (error) {
    console.error("Error analyzing repository:", error);
    alert("Failed to analyze repository. Please check the repository name and try again.");
  } finally {
    showLoading(false);
  }
}

// Update Metrics
function updateMetrics(metrics) {
  document.getElementById("criticalCount").textContent = metrics.bySeverity.critical;
  document.getElementById("highCount").textContent = metrics.bySeverity.high;
  document.getElementById("healthScore").textContent = metrics.healthScore;
  document.getElementById("totalViolations").textContent = metrics.violationCount;

  // Update health score color
  const healthCard = document.querySelector(".metric-card.health");
  const score = metrics.healthScore;
  if (score < 50) {
    healthCard.style.borderLeftColor = "var(--critical)";
  } else if (score < 75) {
    healthCard.style.borderLeftColor = "var(--medium)";
  }
}

// Initialize 3D Scene
function init3DScene() {
  const container = document.getElementById("heatmapCanvas");
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2332);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 15, 30);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);

  // Grid
  const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
  scene.add(gridHelper);

  // Start animation loop
  animate();

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

// Render 3D Heatmap
function render3DHeatmap(heatmapData) {
  // Clear previous objects (except lights and helpers)
  const objectsToRemove = [];
  scene.children.forEach((child) => {
    if (child.type === "Mesh" || child.type === "Line") {
      objectsToRemove.push(child);
    }
  });
  objectsToRemove.forEach((obj) => scene.remove(obj));

  const { layers, beams } = heatmapData;
  const layerHeight = 3;
  const layerSpacing = 5;

  // Render layers
  layers.forEach((layer, index) => {
    const yPos = index * layerSpacing;
    
    // Create layer platform
    const geometry = new THREE.BoxGeometry(20, 0.5, 15);
    const material = new THREE.MeshPhongMaterial({
      color: getLayerColor(index),
      transparent: true,
      opacity: 0.6,
    });
    const platform = new THREE.Mesh(geometry, material);
    platform.position.y = yPos;
    scene.add(platform);

    // Add layer label
    createTextLabel(layer.name, 0, yPos + 1, 0);

    // Add file nodes on the layer
    const fileCount = Math.min(layer.fileCount, 20); // Limit for performance
    for (let i = 0; i < fileCount; i++) {
      const angle = (i / fileCount) * Math.PI * 2;
      const radius = 8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const nodeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const nodeMaterial = new THREE.MeshPhongMaterial({
        color: 0x3b82f6,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.2,
      });
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.position.set(x, yPos, z);
      scene.add(node);
    }
  });

  // Render violation beams
  beams.forEach((beam) => {
    const sourceY = beam.sourceLevel * layerSpacing;
    const targetY = beam.targetLevel * layerSpacing;

    // Random positions on each layer for visual variety
    const sourcePos = new THREE.Vector3(
      (Math.random() - 0.5) * 16,
      sourceY,
      (Math.random() - 0.5) * 12
    );
    const targetPos = new THREE.Vector3(
      (Math.random() - 0.5) * 16,
      targetY,
      (Math.random() - 0.5) * 12
    );

    // Create energy beam
    const beamGeometry = new THREE.BufferGeometry().setFromPoints([sourcePos, targetPos]);
    const beamColor = new THREE.Color(beam.color);
    const beamMaterial = new THREE.LineBasicMaterial({
      color: beamColor,
      linewidth: 2,
      opacity: beam.intensity,
      transparent: true,
    });
    const beamLine = new THREE.Line(beamGeometry, beamMaterial);
    scene.add(beamLine);

    // Add glow effect for critical violations
    if (beam.severity === "critical") {
      const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: 0.4,
      });
      const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
      glowSphere.position.copy(sourcePos);
      scene.add(glowSphere);
    }
  });
}

// Get layer color
function getLayerColor(index) {
  const colors = [0x3b82f6, 0x8b5cf6, 0x06b6d4, 0x10b981, 0xf59e0b, 0xef4444];
  return colors[index % colors.length];
}

// Create text label (simplified - in production use THREE.TextGeometry)
function createTextLabel(text, x, y, z) {
  // Placeholder for text labels
  // In production, use TextGeometry or sprite-based labels
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  if (rotating) {
    scene.rotation.y += 0.005;
  }

  controls.update();
  renderer.render(scene, camera);
}

// Toggle rotation
function toggleRotation() {
  rotating = !rotating;
  const btn = document.getElementById("rotateBtn");
  btn.style.background = rotating ? "var(--accent-blue)" : "var(--bg-tertiary)";
}

// Reset view
function resetView() {
  camera.position.set(0, 15, 30);
  controls.target.set(0, 0, 0);
  controls.update();
  rotating = false;
  document.getElementById("rotateBtn").style.background = "var(--bg-tertiary)";
}

// Display Violations
function displayViolations(violations) {
  const list = document.getElementById("violationsList");
  list.innerHTML = "";

  violations.forEach((violation) => {
    const item = document.createElement("div");
    item.className = `violation-item ${violation.severity}`;
    item.innerHTML = `
      <div class="violation-header">
        <div class="violation-title">${violation.sourceLayer} → ${violation.targetLayer}</div>
        <span class="violation-badge ${violation.severity}">${violation.severity}</span>
      </div>
      <div class="violation-path">
        ${violation.source} → ${violation.target}
      </div>
      <div class="violation-description">${violation.description}</div>
    `;
    item.addEventListener("click", () => showViolationDetail(violation));
    list.appendChild(item);
  });

  filterViolations();
}

// Filter violations by severity
function filterViolations() {
  const items = document.querySelectorAll(".violation-item");
  items.forEach((item) => {
    if (selectedSeverity === "all" || item.classList.contains(selectedSeverity)) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
}

// Show violation detail
async function showViolationDetail(violation) {
  const modal = document.getElementById("violationModal");
  const modalBody = document.getElementById("modalBody");

  // Get AI explanation
  try {
    const response = await fetch(`${API_BASE}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        violation,
        architecture: architectureSelect.value
      }),
    });
    const result = await response.json();
    const explanation = result.data;

    modalBody.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 0.5rem;">${explanation.title}</h4>
        <span class="violation-badge ${violation.severity}">${violation.severity}</span>
      </div>
      
      <div style="margin-bottom: 1rem;">
        <h5 style="color: var(--accent-blue); margin-bottom: 0.5rem;">Problem</h5>
        <p style="line-height: 1.6;">${explanation.problem}</p>
      </div>
      
      <div style="margin-bottom: 1rem;">
        <h5 style="color: var(--accent-blue); margin-bottom: 0.5rem;">Why It Matters</h5>
        <p style="line-height: 1.6;">${explanation.why}</p>
      </div>
      
      <div style="margin-bottom: 1rem;">
        <h5 style="color: var(--accent-blue); margin-bottom: 0.5rem;">Consequences</h5>
        <ul style="margin-left: 1.5rem; line-height: 1.8;">
          ${explanation.consequences.map((c) => `<li>${c}</li>`).join("")}
        </ul>
      </div>
      
      <div style="margin-bottom: 1rem;">
        <h5 style="color: var(--accent-blue); margin-bottom: 0.5rem;">Solution</h5>
        <p style="line-height: 1.6;">${explanation.solution}</p>
      </div>
      
      <div>
        <h5 style="color: var(--accent-blue); margin-bottom: 0.5rem;">Refactoring Steps</h5>
        <ol style="margin-left: 1.5rem; line-height: 1.8;">
          ${explanation.refactoringSteps.map((step) => `<li>${step}</li>`).join("")}
        </ol>
      </div>
      
      <div style="margin-top: 1.5rem;">
        <button onclick="generateFixCode(${JSON.stringify(violation).replace(/"/g, "&quot;")})" class="btn-primary">
          Generate Fix Code
        </button>
      </div>
    `;

    modal.classList.remove("hidden");
  } catch (error) {
    console.error("Error getting explanation:", error);
    alert("Failed to get AI explanation");
  }
}

// Generate fix code
async function generateFixCode(violation) {
  try {
    const response = await fetch(`${API_BASE}/generate-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ violation, language: "javascript" }),
    });
    const result = await response.json();
    const code = result.data;

    const modalBody = document.getElementById("modalBody");
    modalBody.innerHTML += `
      <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
        <h5 style="color: var(--accent-purple); margin-bottom: 0.5rem;">Generated Code: ${code.filename}</h5>
        <pre style="background: var(--bg-tertiary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto;"><code>${escapeHtml(code.code)}</code></pre>
        <p style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
          Save as: ${code.path}
        </p>
      </div>
    `;
  } catch (error) {
    console.error("Error generating code:", error);
    alert("Failed to generate fix code");
  }
}

// Close modal
function closeModal() {
  document.getElementById("violationModal").classList.add("hidden");
}

// Load recommendations
async function loadRecommendations(owner, repo, architecture) {
  try {
    const response = await fetch(`${API_BASE}/recommendations/${owner}/${repo}?architecture=${architecture}`);
    const result = await response.json();
    const recommendations = result.data;

    const content = document.getElementById("governanceContent");
    content.innerHTML = recommendations
      .map((rec) => `
        <div class="recommendation-card">
          <div class="recommendation-header">
            <span class="priority-badge">Priority ${rec.priority}</span>
          </div>
          <h4 style="margin-bottom: 0.5rem;">${rec.category}</h4>
          <div class="recommendation-content">
            <p>${rec.description}</p>
            ${rec.estimatedEffort ? `<p style="margin-top: 0.5rem; color: var(--text-secondary);">Estimated effort: ${rec.estimatedEffort}</p>` : ""}
          </div>
        </div>
      `)
      .join("");
  } catch (error) {
    console.error("Error loading recommendations:", error);
  }
}

// Load example architecture definition
async function loadExampleDefinition() {
  try {
    const response = await fetch(`${API_BASE}/examples`);
    const result = await response.json();
    const examples = result.data;

    // Load Clean Architecture example
    const editor = document.getElementById("architectureEditor");
    editor.value = JSON.stringify(examples.clean, null, 2);
  } catch (error) {
    console.error("Error loading example:", error);
  }
}

// Validate architecture
async function validateArchitecture() {
  const owner = ownerInput.value.trim();
  const repo = repoInput.value.trim();
  const definition = document.getElementById("architectureEditor").value;

  if (!owner || !repo || !definition) {
    alert("Please fill in all fields");
    return;
  }

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo, definition }),
    });
    const result = await response.json();
    const report = result.data;

    const resultsDiv = document.getElementById("validationResults");
    resultsDiv.classList.remove("hidden");
    resultsDiv.className = `validation-results ${report.isValid ? "success" : "error"}`;
    resultsDiv.innerHTML = `
      <h4>Validation Results</h4>
      <p><strong>Compliance Score:</strong> ${report.complianceScore}%</p>
      <p><strong>Total Violations:</strong> ${report.summary.total}</p>
      <p><strong>Critical:</strong> ${report.summary.bySeverity.critical}, 
         <strong>High:</strong> ${report.summary.bySeverity.high}, 
         <strong>Medium:</strong> ${report.summary.bySeverity.medium}, 
         <strong>Low:</strong> ${report.summary.bySeverity.low}</p>
      ${report.isValid ? "<p style='color: var(--success);'>✓ Architecture is compliant!</p>" : "<p style='color: var(--critical);'>✗ Architecture has violations</p>"}
    `;
  } catch (error) {
    console.error("Error validating architecture:", error);
    alert("Failed to validate architecture");
  } finally {
    showLoading(false);
  }
}

// Show/hide loading overlay
function showLoading(show) {
  if (show) {
    loadingOverlay.classList.remove("hidden");
  } else {
    loadingOverlay.classList.add("hidden");
  }
}

// Utility: Escape HTML
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
