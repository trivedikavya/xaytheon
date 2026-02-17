/**
 * Risk Galaxy Frontend Logic
 * Implements 3D star-map and predictive trend charts.
 */

class RiskGalaxy {
    constructor() {
        this.container = document.getElementById('galaxy-viewport');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.stars = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.trendChart = null;

        this.init();
    }

    async init() {
        this.setupScene();
        this.createStarField();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
        this.container.addEventListener('click', (e) => this.onMouseClick(e));

        await this.loadGalaxyData();
    }

    setupScene() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 100;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
    }

    createStarField() {
        const geometry = new THREE.SphereGeometry(0.5, 12, 12);
        for (let i = 0; i < 200; i++) {
            const material = new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.3 });
            const star = new THREE.Mesh(geometry, material);
            star.position.set(
                (Math.random() - 0.5) * 400,
                (Math.random() - 0.5) * 400,
                (Math.random() - 0.5) * 400
            );
            this.scene.add(star);
        }
    }

    async loadGalaxyData() {
        try {
            const response = await fetch('/api/risk/galaxy');
            const result = await response.json();

            if (result.success) {
                this.renderGalaxy(result.data);
            }
        } catch (error) {
            console.error('Failed to load risk galaxy:', error);
        }
    }

    renderGalaxy(data) {
        data.forEach((file) => {
            const size = Math.max(1, (file.score / 20));
            const geometry = new THREE.SphereGeometry(size, 32, 32);

            const color = this.getColorByScore(file.score);
            const material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
                shininess: 100
            });

            const star = new THREE.Mesh(geometry, material);
            star.position.set(
                (Math.random() - 0.5) * 150,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100
            );

            // Add custom point light per "Burning Sun"
            if (file.score > 70) {
                const light = new THREE.PointLight(color, 1, 50);
                light.position.copy(star.position);
                this.scene.add(light);
            }

            star.userData = file;
            this.scene.add(star);
            this.stars.push(star);

            // Animate entry
            star.scale.set(0.1, 0.1, 0.1);
            gsap.to(star.scale, { x: 1, y: 1, z: 1, duration: 1, ease: 'back.out' });
        });

        // Add ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.1);
        this.scene.add(ambient);
    }

    getColorByScore(score) {
        if (score > 75) return 0xff3e3e; // Red
        if (score > 50) return 0xff9d00; // Orange
        if (score > 25) return 0xf7df1e; // Yellow
        return 0x10b981; // Green
    }

    onMouseClick(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.stars);

        if (intersects.length > 0) {
            this.showFilePanel(intersects[0].object.userData);
            this.animateCameraTo(intersects[0].object.position);
        }
    }

    showFilePanel(file) {
        const panel = document.getElementById('file-card');
        panel.classList.remove('hidden');

        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-path').textContent = file.path;

        const badge = document.getElementById('risk-badge');
        badge.textContent = file.status;
        badge.className = `badge ${file.status}`;

        document.getElementById('val-churn').textContent = `${file.metrics.churn}%`;
        document.getElementById('val-expertise').textContent = `${Math.round(file.metrics.expertise)}%`;
        document.getElementById('val-complexity').textContent = file.metrics.complexity;

        this.fetchPrediction(file.id);
        this.renderTrendChart(file.trend);
    }

    async fetchPrediction(id) {
        const res = await fetch(`/api/risk/predict/${id}`);
        const result = await res.json();
        if (result.success) {
            document.getElementById('prediction-text').textContent = result.data.prediction;
        }
    }

    renderTrendChart(trendData) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (this.trendChart) this.trendChart.destroy();

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.map(d => d.month),
                datasets: [{
                    label: 'Risk Velocity',
                    data: trendData.map(d => d.value),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 100, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } }
                }
            }
        });
    }

    animateCameraTo(targetPos) {
        gsap.to(this.camera.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z + 50,
            duration: 1.2,
            ease: 'expo.inOut'
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.stars.forEach(star => {
            star.rotation.y += 0.01;
        });

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * BLAST-RADIUS VISUALIZATION ENGINE
     * Renders "Biological Viral Spread" animation with contamination shaders
     */
    async visualizeBlastRadius(vulnerabilityNode) {
        try {
            const response = await fetch(`/api/risk/blast-radius?vulnerabilityNode=${vulnerabilityNode}`);
            const result = await response.json();

            if (!result.success) {
                console.error('Blast radius calculation failed:', result.message);
                return;
            }

            const blastData = result.data;
            this.renderViralSpread(blastData);
            this.showBlastRadiusPanel(blastData);
        } catch (error) {
            console.error('Failed to visualize blast radius:', error);
        }
    }

    renderViralSpread(blastData) {
        const propagationTree = blastData.propagationTree;

        // Clear previous contamination effects
        this.clearContaminationEffects();

        propagationTree.forEach((node, index) => {
            // Find corresponding star in galaxy
            const star = this.stars.find(s => s.userData && s.userData.name === node.name);

            // If star doesn't exist, create a phantom node for visualization
            const targetStar = star || this.createPhantomNode(node);

            // Apply contamination shader based on impact
            this.applyContaminationShader(targetStar, node);

            // Animate propagation with delay based on depth
            setTimeout(() => {
                this.animateViralPropagation(targetStar, node);
            }, node.depth * 400);
        });

        // Draw propagation connections
        this.drawPropagationLinks(blastData);
    }

    createPhantomNode(nodeData) {
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.5
        });

        const phantom = new THREE.Mesh(geometry, material);
        phantom.position.set(
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        phantom.userData = nodeData;
        this.scene.add(phantom);
        this.stars.push(phantom);

        return phantom;
    }

    applyContaminationShader(star, nodeData) {
        const statusColors = {
            'CRITICAL': 0xff0000,
            'HIGH': 0xff6b00,
            'MODERATE': 0xffd700,
            'LOW': 0x3b82f6
        };

        const color = statusColors[nodeData.status] || 0x64748b;
        const intensity = nodeData.impactScore / 100;

        // Create pulsing contamination effect
        star.material.color.setHex(color);
        star.material.emissive.setHex(color);
        star.material.emissiveIntensity = intensity * 0.8;

        // Add glitch/corruption particles for CRITICAL nodes
        if (nodeData.status === 'CRITICAL') {
            this.addCorruptionParticles(star);
        }

        // Pulsing animation
        gsap.to(star.scale, {
            x: 1 + (intensity * 0.5),
            y: 1 + (intensity * 0.5),
            z: 1 + (intensity * 0.5),
            duration: 0.8,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });
    }

    addCorruptionParticles(star) {
        const particleCount = 15;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = star.position.x + (Math.random() - 0.5) * 10;
            positions[i + 1] = star.position.y + (Math.random() - 0.5) * 10;
            positions[i + 2] = star.position.z + (Math.random() - 0.5) * 10;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMaterial = new THREE.PointsMaterial({
            color: 0xff0000,
            size: 0.5,
            transparent: true,
            opacity: 0.7
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(particles);

        // Animate particle explosion
        gsap.to(particles.scale, {
            x: 3,
            y: 3,
            z: 3,
            duration: 1.5,
            onComplete: () => this.scene.remove(particles)
        });

        gsap.to(particleMaterial, {
            opacity: 0,
            duration: 1.5
        });
    }

    animateViralPropagation(star, nodeData) {
        // Create expanding contamination wave
        const waveGeometry = new THREE.RingGeometry(5, 6, 32);
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: 0xff3e3e,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        const wave = new THREE.Mesh(waveGeometry, waveMaterial);
        wave.position.copy(star.position);
        wave.lookAt(this.camera.position);
        this.scene.add(wave);

        // Expanding wave animation
        gsap.to(wave.scale, {
            x: 4,
            y: 4,
            z: 4,
            duration: 1.5,
            ease: 'power2.out'
        });

        gsap.to(waveMaterial, {
            opacity: 0,
            duration: 1.5,
            onComplete: () => this.scene.remove(wave)
        });
    }

    drawPropagationLinks(blastData) {
        const dependencyTree = blastData.propagationTree;

        dependencyTree.forEach(node => {
            if (node.affectedServices.length === 0) return;

            const sourceStar = this.stars.find(s => s.userData && s.userData.name === node.name);
            if (!sourceStar) return;

            node.affectedServices.forEach(targetId => {
                const targetNode = dependencyTree.find(n => n.id === targetId);
                const targetStar = this.stars.find(s => s.userData && s.userData.name === targetNode?.name);

                if (targetStar) {
                    this.createPropagationLine(sourceStar.position, targetStar.position, node.status);
                }
            });
        });
    }

    createPropagationLine(startPos, endPos, status) {
        const points = [startPos, endPos];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const lineColor = status === 'CRITICAL' ? 0xff0000 : 0xff9d00;
        const material = new THREE.LineBasicMaterial({
            color: lineColor,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });

        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        // Animate opacity pulsing
        gsap.to(material, {
            opacity: 0.2,
            duration: 1,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });
    }

    clearContaminationEffects() {
        // Remove any previous contamination animations
        this.stars.forEach(star => {
            gsap.killTweensOf(star.scale);
            star.scale.set(1, 1, 1);
            if (star.material) {
                star.material.emissiveIntensity = star.userData && star.userData.score > 70 ? 0.5 : 0;
            }
        });
    }

    showBlastRadiusPanel(blastData) {
        const panel = document.getElementById('file-card');
        if (!panel) return;

        panel.classList.remove('hidden');

        const innerHTML = `
            <div style="padding: 1.5rem;">
                <h2 style="color: #ff3e3e; font-size: 1.2rem; margin-bottom: 1rem;">
                    ⚠️ BLAST RADIUS ANALYSIS
                </h2>
                <div style="background: rgba(255, 62, 62, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <p style="font-size: 0.9rem; color: #f87171;">
                        <strong>Source Vulnerability:</strong> ${blastData.sourceVulnerability}
                    </p>
                    <p style="font-size: 0.9rem; color: #f87171; margin-top: 0.5rem;">
                        <strong>Risk Level:</strong> <span style="color: #fff;">${blastData.riskLevel}</span>
                    </p>
                </div>
                <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 1rem;">
                    <strong>Total Affected Nodes:</strong> ${blastData.totalAffectedNodes}
                </p>
                <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.5rem;">
                    ${blastData.recommendation}
                </p>
                <div style="max-height: 200px; overflow-y: auto;">
                    <h4 style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem;">PROPAGATION TREE:</h4>
                    ${blastData.propagationTree.map(node => `
                        <div style="padding: 0.5rem; margin: 0.3rem 0; background: rgba(255,255,255,0.03); border-left: 3px solid ${this.getStatusColor(node.status)}; border-radius: 4px;">
                            <div style="font-size: 0.75rem; color: #e2e8f0;">${node.name}</div>
                            <div style="font-size: 0.65rem; color: #64748b;">
                                Impact: ${node.impactScore.toFixed(1)}% | Depth: ${node.depth} | ${node.status}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        panel.innerHTML = innerHTML;
    }

    getStatusColor(status) {
        const colors = {
            'CRITICAL': '#ff0000',
            'HIGH': '#ff9d00',
            'MODERATE': '#ffd700',
            'LOW': '#3b82f6'
        };
        return colors[status] || '#64748b';
    }
}

let galaxyApp;
document.addEventListener('DOMContentLoaded', () => {
    galaxyApp = new RiskGalaxy();
});

function resetView() {
    gsap.to(galaxyApp.camera.position, { x: 0, y: 0, z: 100, duration: 1.5, ease: 'expo.inOut' });
    document.getElementById('file-card').classList.add('hidden');
    galaxyApp.clearContaminationEffects();
}

function runScrub() {
    alert("AI Scrub initialized. Analyzing NLP patterns in commit 'fix' history...");
}

/**
 * Trigger Blast Radius Visualization
 * Call this function to simulate vulnerability propagation
 */
function triggerBlastRadius(vulnerabilityNode = 'express') {
    if (galaxyApp) {
        galaxyApp.visualizeBlastRadius(vulnerabilityNode);
    }
}

