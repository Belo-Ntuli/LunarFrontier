import * as THREE from 'three';
import {
  DAY_LENGTH_MS,
  SECTORS,
  getHazardsForSector,
  type ColonySave,
  type SectorRelief,
} from './game';

const MOON_RADIUS = 3;
const COLORS = {
  available: '#55d6c5',
  selected: '#72b7ff',
  hovered: '#d3e8ff',
};
const SURFACE_COLORS = {
  available: new THREE.Color(COLORS.available),
  selected: new THREE.Color(COLORS.selected),
  hovered: new THREE.Color(COLORS.hovered),
};
const SURFACE_WIDTH = 1024;
const SURFACE_HEIGHT = 512;
const SURFACE_RELIEF_SCALE = 1.45;
const SECTOR_COLOR = new THREE.Color('#c2baaa');
const STAR_COLOR = new THREE.Color('#f5f9ff');

interface LunarSurface {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  baseCanvas: HTMLCanvasElement;
  sectorIds: Uint8Array;
  boundaryWeights: Uint8Array;
}

interface RavineTerrain {
  geometry: THREE.SphereGeometry;
  basePositions: Float32Array;
  baseRadii: Float32Array;
  vertexSectors: Uint8Array;
  vertexLifts: Float32Array;
}

interface TwinklingStars {
  colors: THREE.BufferAttribute;
  phases: Float32Array;
  speeds: Float32Array;
  baseBrightness: Float32Array;
  amplitudes: Float32Array;
}

interface SectorLabel {
  sprite: THREE.Sprite;
  leader: THREE.Line;
  marker: THREE.Mesh;
  direction: THREE.Vector3;
}

export class MoonScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly globe = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly sunlight = new THREE.DirectionalLight('#fff0d6', 3.2);
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly resizeObserver: ResizeObserver;
  private readonly onSelect: (sectorId: number) => void;
  private readonly onHover: (sectorId: number | null) => void;
  private readonly surface: LunarSurface;
  private readonly terrain: RavineTerrain;
  private readonly stars: TwinklingStars;
  private readonly sectorLabelTextures: THREE.CanvasTexture[] = [];
  private readonly sectorLabels: SectorLabel[] = [];
  private readonly moon: THREE.Mesh;
  private colony: ColonySave | null;
  private hoveredId: number | null = null;
  private selectedId: number | null = null;
  private focusRotation: {
    start: THREE.Quaternion;
    target: THREE.Quaternion;
    startedAt: number;
  } | null = null;
  private pointerDown: THREE.Vector2 | null = null;
  private dragged = false;
  private animationFrame = 0;
  private disposed = false;
  private simulationElapsedMs = 0;
  private simulationAdvancing = false;
  private simulationAnchorTime = 0;

  constructor(
    mount: HTMLElement,
    colony: ColonySave | null,
    selectedId: number | null,
    onSelect: (sectorId: number) => void,
    onHover: (sectorId: number | null) => void,
  ) {
    this.colony = colony;
    this.selectedId = selectedId;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.setSimulationTime(
      colony?.elapsedMs ?? 0,
      Boolean(colony && !colony.paused && !colony.failed),
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'moon-canvas';
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D Moon. Drag to rotate and select a sector. Warning symbols mark sectors with active hazards; use the sector list for details.',
    );
    this.renderer.domElement.setAttribute('role', 'img');
    mount.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0.4, 10.1);
    this.scene.add(this.globe);
    this.globe.rotation.x = -0.08;
    this.surface = createLunarTexture();
    this.terrain = createRavineGeometry(this.surface.boundaryWeights, this.surface.sectorIds);
    this.moon = new THREE.Mesh(
      this.terrain.geometry,
      new THREE.MeshStandardMaterial({
        map: this.surface.texture,
        color: '#ffffff',
        roughness: 1,
        metalness: 0,
      }),
    );
    this.globe.add(this.moon);
    this.addLighting();
    this.stars = this.addStars();
    this.addSectorLabels();
    this.updateSurfaceTexture();

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.resize();
    this.animate(performance.now());
  }

  update(colony: ColonySave | null, selectedId: number | null): void {
    this.colony = colony;
    this.selectedId = selectedId;
    this.setSimulationTime(
      colony?.elapsedMs ?? 0,
      Boolean(colony && !colony.paused && !colony.failed),
    );
    this.updateSurfaceTexture();
  }

  setSimulationTime(elapsedMs: number, advancing: boolean): void {
    this.simulationElapsedMs = elapsedMs;
    this.simulationAdvancing = advancing && document.visibilityState === 'visible';
    this.simulationAnchorTime = performance.now();
  }

  focusSector(sectorId: number): void {
    const sector = SECTORS.find((item) => item.id === sectorId);
    if (!sector) throw new Error(`Unknown sector on lunar globe: ${sectorId}.`);

    const sectorDirection = spherePoint(sector.latitude, sector.longitude).normalize();
    const cameraDirection = this.camera.position.clone().normalize();
    const target = new THREE.Quaternion().setFromUnitVectors(sectorDirection, cameraDirection);
    if (this.reducedMotion.matches) {
      this.globe.quaternion.copy(target);
      this.focusRotation = null;
      return;
    }

    this.focusRotation = {
      start: this.globe.quaternion.clone(),
      target,
      startedAt: performance.now(),
    };
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
      }
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Sprite
      ) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.Material) material.dispose();
        });
      }
    });
    this.sectorLabelTextures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    canvas.remove();
  }

  private addLighting(): void {
    this.scene.add(new THREE.AmbientLight('#8394ac', 0.45));
    this.sunlight.position.set(0, 2.5, 8);
    this.globe.add(this.sunlight);
    const rim = new THREE.DirectionalLight('#5c9dcb', 0.15);
    rim.position.set(5, -2, -5);
    this.scene.add(rim);
  }

  private addStars(): TwinklingStars {
    const count = 500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const baseBrightness = new Float32Array(count);
    const amplitudes = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const radius = 12 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const ring = Math.sqrt(1 - z * z);
      positions[index * 3] = radius * ring * Math.cos(theta);
      positions[index * 3 + 1] = radius * z;
      positions[index * 3 + 2] = radius * ring * Math.sin(theta);
      phases[index] = Math.random() * Math.PI * 2;
      speeds[index] = 0.7 + Math.random() * 1.3;
      baseBrightness[index] = 0.62 + Math.random() * 0.3;
      amplitudes[index] = 0.1 + Math.random() * 0.24;
      const brightness = THREE.MathUtils.clamp(
        baseBrightness[index] + Math.sin(phases[index]) * amplitudes[index],
        0.15,
        1,
      );
      colors[index * 3] = STAR_COLOR.r * brightness;
      colors[index * 3 + 1] = STAR_COLOR.g * brightness;
      colors[index * 3 + 2] = STAR_COLOR.b * brightness;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const colorAttribute = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('color', colorAttribute);
    this.scene.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: '#ffffff',
          size: 0.09,
          transparent: true,
          opacity: 1,
          vertexColors: true,
        }),
      ),
    );
    return { colors: colorAttribute, phases, speeds, baseBrightness, amplitudes };
  }

  private addSectorLabels(): void {
    this.globe.updateMatrixWorld(true);
    for (const sector of SECTORS) {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 96;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to create lunar sector labels.');
      const hasWarning = getHazardsForSector(this.colony, sector.id).length > 0;
      const warningSpace = hasWarning ? 30 : 0;

      context.fillStyle = 'rgba(8, 15, 27, 0.82)';
      context.strokeStyle = 'rgba(153, 191, 222, 0.76)';
      context.lineWidth = 3;
      context.beginPath();
      context.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 18);
      context.fill();
      context.stroke();
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#83c8ff';
      context.font = '700 17px ui-monospace, monospace';
      context.fillText(String(sector.id + 1).padStart(2, '0'), canvas.width / 2, 27);

      let nameSize = 30;
      context.fillStyle = '#f2f6fa';
      context.font = `700 ${nameSize}px system-ui, sans-serif`;
      while (
        context.measureText(sector.name).width > canvas.width - 28 - warningSpace &&
        nameSize > 16
      ) {
        nameSize -= 1;
        context.font = `700 ${nameSize}px system-ui, sans-serif`;
      }
      const nameWidth = context.measureText(sector.name).width;
      const nameCenter = canvas.width / 2 - warningSpace / 2;
      context.fillText(sector.name, nameCenter, 68);
      if (hasWarning) {
        drawWarningIndicator(context, nameCenter + nameWidth / 2 + 19, 68);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.sectorLabelTextures.push(texture);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: true,
          depthWrite: false,
        }),
      );
      const direction = spherePoint(sector.latitude, sector.longitude).normalize();
      const worldDirection = direction.clone().applyQuaternion(this.globe.quaternion).normalize();
      this.raycaster.set(
        worldDirection.clone().multiplyScalar(MOON_RADIUS + 1),
        worldDirection.clone().negate(),
      );
      const intersection = this.raycaster.intersectObject(this.moon, false)[0];
      if (!intersection) throw new Error(`Unable to locate the surface of ${sector.name}.`);
      const surfacePoint = this.globe.worldToLocal(intersection.point.clone());
      const tangent = new THREE.Vector3(0, 1, 0)
        .addScaledVector(direction, -direction.y)
        .normalize();
      const bubblePosition = surfacePoint.clone()
        .addScaledVector(direction, 0.36)
        .addScaledVector(tangent, 0.23);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        surfacePoint.clone().addScaledVector(direction, 0.02),
        bubblePosition.clone().addScaledVector(direction, -0.13),
      ]);
      const leader = new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({
          color: '#83c8ff',
          transparent: true,
          opacity: 0.9,
        }),
      );
      leader.renderOrder = 1;
      this.globe.add(leader);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 10, 8),
        new THREE.MeshBasicMaterial({ color: '#83c8ff' }),
      );
      marker.position.copy(surfacePoint).addScaledVector(direction, 0.02);
      marker.renderOrder = 2;
      this.globe.add(marker);

      label.position.copy(bubblePosition);
      label.scale.set(0.9, 0.25, 1);
      label.renderOrder = 3;
      this.globe.add(label);
      this.sectorLabels.push({ sprite: label, leader, marker, direction });
    }
  }

  private updateSurfaceTexture(): void {
    const context = this.surface.canvas.getContext('2d');
    if (!context) throw new Error('Unable to update the lunar surface texture.');

    context.drawImage(this.surface.baseCanvas, 0, 0);
    const image = context.getImageData(0, 0, SURFACE_WIDTH, SURFACE_HEIGHT);
    const unlockedSectors = new Set(this.colony?.unlockedSectors ?? []);

    for (let pixel = 0; pixel < this.surface.sectorIds.length; pixel += 1) {
      const sectorId = this.surface.sectorIds[pixel];
      const isHovered = sectorId === this.hoveredId;
      const isSelected = sectorId === this.selectedId;
      const isUnlocked = unlockedSectors.has(sectorId);
      const weight = this.surface.boundaryWeights[pixel] / 255;
      const opacity = isHovered
        ? 0.34 * (0.4 + 0.6 * weight)
        : isSelected
          ? 0.24 * (0.4 + 0.6 * weight)
          : isUnlocked
            ? 0.16 * (0.4 + 0.6 * weight)
            : 0.22 * (0.4 + 0.6 * weight);
      const highlight = isHovered
        ? SURFACE_COLORS.hovered
        : isSelected
          ? SURFACE_COLORS.selected
          : isUnlocked
            ? SURFACE_COLORS.available
            : SECTOR_COLOR;
      const offset = pixel * 4;
      const boundaryProximity = 1 - weight;
      const ravineDepth = boundaryProximity * boundaryProximity * 0.88;
      const ravineWall = Math.max(0, 1 - Math.abs(weight - 0.52) / 0.22) * 0.06;
      const surfaceRed = image.data[offset] * (1 - opacity) + highlight.r * 255 * opacity;
      const surfaceGreen = image.data[offset + 1] * (1 - opacity) + highlight.g * 255 * opacity;
      const surfaceBlue = image.data[offset + 2] * (1 - opacity) + highlight.b * 255 * opacity;
      const ravineRed = surfaceRed * (1 - ravineDepth) + 12 * ravineDepth;
      const ravineGreen = surfaceGreen * (1 - ravineDepth) + 15 * ravineDepth;
      const ravineBlue = surfaceBlue * (1 - ravineDepth) + 20 * ravineDepth;
      image.data[offset] = Math.round(ravineRed + (150 - ravineRed) * ravineWall);
      image.data[offset + 1] = Math.round(ravineGreen + (154 - ravineGreen) * ravineWall);
      image.data[offset + 2] = Math.round(ravineBlue + (158 - ravineBlue) * ravineWall);
    }

    context.putImageData(image, 0, 0);
    this.surface.texture.needsUpdate = true;
  }

  private resize(): void {
    if (this.disposed) return;
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const width = Math.max(parent.clientWidth, 1);
    const height = Math.max(parent.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate = (time: number): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    this.updateDaylight(time);
    this.updateTwinklingStars(time);
    if (this.focusRotation) {
      const { start, target, startedAt } = this.focusRotation;
      const progress = Math.min((time - startedAt) / 700, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      this.globe.quaternion.slerpQuaternions(start, target, easedProgress);
      if (progress === 1) this.focusRotation = null;
    }
    this.updateSectorLabelVisibility();
    this.renderer.render(this.scene, this.camera);
  };

  private updateDaylight(time: number): void {
    const elapsedSinceSync = this.simulationAdvancing && document.visibilityState === 'visible'
      ? Math.max(0, time - this.simulationAnchorTime)
      : 0;
    const phase = ((this.simulationElapsedMs + elapsedSinceSync) % DAY_LENGTH_MS) / DAY_LENGTH_MS;
    const angle = phase * Math.PI * 2;
    this.sunlight.position.set(Math.sin(angle) * 8, 2.5, Math.cos(angle) * 8);
  }

  private updateSectorLabelVisibility(): void {
    const cameraDirection = this.camera.position.clone().normalize();
    const worldDirection = new THREE.Vector3();
    for (const { sprite, leader, marker, direction } of this.sectorLabels) {
      worldDirection.copy(direction).applyQuaternion(this.globe.quaternion);
      const visible = worldDirection.dot(cameraDirection) > 0.35;
      sprite.visible = visible;
      leader.visible = visible;
      marker.visible = visible;
    }
  }

  private updateTwinklingStars(time: number): void {
    if (this.reducedMotion.matches) return;
    for (let star = 0; star < this.stars.phases.length; star += 1) {
      const brightness = THREE.MathUtils.clamp(
        this.stars.baseBrightness[star]
          + Math.sin(time * 0.001 * this.stars.speeds[star] + this.stars.phases[star])
            * this.stars.amplitudes[star],
        0.15,
        1,
      );
      this.stars.colors.setXYZ(
        star,
        STAR_COLOR.r * brightness,
        STAR_COLOR.g * brightness,
        STAR_COLOR.b * brightness,
      );
    }
    this.stars.colors.needsUpdate = true;
  }

  private getIntersectedSector(event: PointerEvent): number | null {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersection = this.raycaster.intersectObject(this.moon, false)[0];
    if (!intersection?.uv) return null;
    const x = THREE.MathUtils.clamp(Math.floor(intersection.uv.x * SURFACE_WIDTH), 0, SURFACE_WIDTH - 1);
    const y = THREE.MathUtils.clamp(Math.floor((1 - intersection.uv.y) * SURFACE_HEIGHT), 0, SURFACE_HEIGHT - 1);
    return this.surface.sectorIds[y * SURFACE_WIDTH + x] ?? null;
  }

  private setHovered(id: number | null): void {
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.updateSurfaceTexture();
    this.updateHoveredElevation();
    this.onHover(id);
  }

  private updateHoveredElevation(): void {
    const positions = this.terrain.geometry.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const offset = vertex * 3;
      const x = this.terrain.basePositions[offset];
      const y = this.terrain.basePositions[offset + 1];
      const z = this.terrain.basePositions[offset + 2];
      const radius = this.terrain.baseRadii[vertex];
      const lift = this.terrain.vertexSectors[vertex] === this.hoveredId
        ? this.terrain.vertexLifts[vertex]
        : 0;
      const scale = (radius + lift) / radius;
      positions.setXYZ(vertex, x * scale, y * scale, z * scale);
    }
    positions.needsUpdate = true;
    this.terrain.geometry.computeVertexNormals();
    this.terrain.geometry.computeBoundingSphere();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.focusRotation = null;
    this.pointerDown = new THREE.Vector2(event.clientX, event.clientY);
    this.dragged = false;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.pointerDown) {
      const deltaX = event.clientX - this.pointerDown.x;
      const deltaY = event.clientY - this.pointerDown.y;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 3) this.dragged = true;
      if (this.dragged) {
        this.globe.rotation.y += deltaX * 0.006;
        this.globe.rotation.x = THREE.MathUtils.clamp(
          this.globe.rotation.x + deltaY * 0.004,
          -0.9,
          0.9,
        );
        this.pointerDown.set(event.clientX, event.clientY);
        return;
      }
    }
    this.setHovered(this.getIntersectedSector(event));
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragged) {
      const sectorId = this.getIntersectedSector(event);
      if (sectorId !== null) this.onSelect(sectorId);
    }
    this.pointerDown = null;
    this.dragged = false;
  };

  private handlePointerLeave = (): void => {
    if (!this.pointerDown) this.setHovered(null);
  };
}

function drawWarningIndicator(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  context.save();
  context.fillStyle = '#ffc65e';
  context.strokeStyle = '#785018';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x, y - 12);
  context.lineTo(x + 11, y + 9);
  context.lineTo(x - 11, y + 9);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = '#30220d';
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x, y - 5);
  context.lineTo(x, y + 1);
  context.stroke();
  context.fillStyle = '#30220d';
  context.beginPath();
  context.arc(x, y + 5, 1.25, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function spherePoint(latitude: number, longitude: number): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  );
}

function createLunarTexture(): LunarSurface {
  const canvas = document.createElement('canvas');
  canvas.width = SURFACE_WIDTH;
  canvas.height = SURFACE_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Unable to create the lunar surface texture.');

  const image = context.createImageData(canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const noise = Math.random() * 22;
    const shade = 118 + noise;
    image.data[index] = shade;
    image.data[index + 1] = shade;
    image.data[index + 2] = shade - 3;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  for (let index = 0; index < 180; index += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = 2 + Math.random() ** 2 * 22;
    const gradient = context.createRadialGradient(x, y, radius * 0.2, x, y, radius);
    gradient.addColorStop(0, 'rgba(63, 63, 62, 0.4)');
    gradient.addColorStop(0.72, 'rgba(91, 91, 89, 0.18)');
    gradient.addColorStop(1, 'rgba(191, 191, 185, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(223, 223, 215, 0.17)';
    context.lineWidth = Math.max(1, radius * 0.08);
    context.stroke();
  }
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = SURFACE_WIDTH;
  baseCanvas.height = SURFACE_HEIGHT;
  const baseContext = baseCanvas.getContext('2d');
  if (!baseContext) throw new Error('Unable to prepare the lunar surface texture.');
  baseContext.drawImage(canvas, 0, 0);

  const { sectorIds, boundaryWeights } = createSectorMap();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, canvas, baseCanvas, sectorIds, boundaryWeights };
}

function createSectorMap(): Pick<LunarSurface, 'sectorIds' | 'boundaryWeights'> {
  const centers = SECTORS.map((sector) =>
    spherePoint(sector.latitude, sector.longitude).normalize(),
  );
  const sectorIds = new Uint8Array(SURFACE_WIDTH * SURFACE_HEIGHT);
  const boundaryWeights = new Uint8Array(SURFACE_WIDTH * SURFACE_HEIGHT);
  const point = new THREE.Vector3();

  for (let y = 0; y < SURFACE_HEIGHT; y += 1) {
    const latitude = Math.PI / 2 - (y / SURFACE_HEIGHT) * Math.PI;
    for (let x = 0; x < SURFACE_WIDTH; x += 1) {
      const longitude = (x / SURFACE_WIDTH) * Math.PI * 2 - Math.PI / 2;
      point.set(
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.cos(longitude),
      );
      warpTerrainPoint(point);
      let bestScore = -Infinity;
      let secondScore = -Infinity;
      let bestId = 0;

      centers.forEach((center, index) => {
        const score = center.dot(point);
        if (score > bestScore) {
          secondScore = bestScore;
          bestScore = score;
          bestId = index;
        } else if (score > secondScore) {
          secondScore = score;
        }
      });

      const pixel = y * SURFACE_WIDTH + x;
      sectorIds[pixel] = bestId;
      const edgeDistance = THREE.MathUtils.clamp((bestScore - secondScore) / 0.021, 0, 1);
      boundaryWeights[pixel] = Math.round(edgeDistance * edgeDistance * (3 - 2 * edgeDistance) * 255);
    }
  }
  return { sectorIds, boundaryWeights };
}

function createRavineGeometry(boundaryWeights: Uint8Array, sectorIds: Uint8Array): RavineTerrain {
  const geometry = new THREE.SphereGeometry(MOON_RADIUS, 768, 384);
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  const basePositions = new Float32Array(positions.count * 3);
  const baseRadii = new Float32Array(positions.count);
  const vertexSectors = new Uint8Array(positions.count);
  const vertexLifts = new Float32Array(positions.count);
  const direction = new THREE.Vector3();
  const reliefFrames = SECTORS.map((sector) => {
    const center = spherePoint(sector.latitude, sector.longitude).normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(center).normalize();
    return { center, east, north: center.clone().cross(east).normalize() };
  });

  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    const textureX = Math.min(uvs.getX(vertex) * SURFACE_WIDTH, SURFACE_WIDTH - 1);
    const textureY = Math.min((1 - uvs.getY(vertex)) * SURFACE_HEIGHT, SURFACE_HEIGHT - 1);
    const x0 = Math.floor(textureX);
    const y0 = Math.floor(textureY);
    const x1 = Math.min(x0 + 1, SURFACE_WIDTH - 1);
    const y1 = Math.min(y0 + 1, SURFACE_HEIGHT - 1);
    const xWeight = textureX - x0;
    const yWeight = textureY - y0;
    const topWeight =
      boundaryWeights[y0 * SURFACE_WIDTH + x0] * (1 - xWeight) +
      boundaryWeights[y0 * SURFACE_WIDTH + x1] * xWeight;
    const bottomWeight =
      boundaryWeights[y1 * SURFACE_WIDTH + x0] * (1 - xWeight) +
      boundaryWeights[y1 * SURFACE_WIDTH + x1] * xWeight;
    const boundaryWeight = (topWeight * (1 - yWeight) + bottomWeight * yWeight) / 255;
    const boundaryProximity = 1 - boundaryWeight;
    const trenchProfile = boundaryProximity * boundaryProximity * (3 - 2 * boundaryProximity);
    const depth = trenchProfile * 0.065;
    const sectorId = sectorIds[y0 * SURFACE_WIDTH + x0];
    const frame = reliefFrames[sectorId];
    direction.set(
      positions.getX(vertex),
      positions.getY(vertex),
      positions.getZ(vertex),
    ).normalize();
    const centerDot = direction.dot(frame.center);
    const localX = Math.atan2(direction.dot(frame.east), centerDot);
    const localY = Math.atan2(direction.dot(frame.north), centerDot);
    const edgeFade = smoothStep(0, 0.72, boundaryWeight);
    const relief = surfaceRelief(SECTORS[sectorId].surfaceRelief, localX, localY)
      * edgeFade
      * SURFACE_RELIEF_SCALE;
    const radius = MOON_RADIUS - depth + relief;
    const scale = radius / MOON_RADIUS;
    const positionOffset = vertex * 3;
    const x = positions.getX(vertex) * scale;
    const y = positions.getY(vertex) * scale;
    const z = positions.getZ(vertex) * scale;
    positions.setXYZ(
      vertex,
      x,
      y,
      z,
    );
    basePositions[positionOffset] = x;
    basePositions[positionOffset + 1] = y;
    basePositions[positionOffset + 2] = z;
    baseRadii[vertex] = radius;
    vertexSectors[vertex] = sectorId;
    vertexLifts[vertex] = boundaryWeight * boundaryWeight * (3 - 2 * boundaryWeight) * 0.035;
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, basePositions, baseRadii, vertexSectors, vertexLifts };
}

function surfaceRelief(profile: SectorRelief, x: number, y: number): number {
  switch (profile) {
    case 'polar-ice-craters':
      return craterRelief(x, y, -0.1, 0.03, 0.15, 0.018)
        + craterRelief(x, y, 0.16, -0.13, 0.07, 0.011);
    case 'polar-ridges':
      return ridgeRelief(x, y, -0.07, 0.016, 0.022)
        + ridgeRelief(x, y, 0.08, 0.013, 0.02, 0.12)
        + craterRelief(x, y, -0.19, 0.16, 0.07, 0.009);
    case 'polar-craters':
      return craterRelief(x, y, 0.06, -0.04, 0.17, 0.02)
        + craterRelief(x, y, -0.2, 0.19, 0.075, 0.012)
        + craterRelief(x, y, 0.22, 0.2, 0.06, 0.01);
    case 'icy-uplands':
      return gaussianBump(x, y, -0.17, 0.09, 0.13, 0.12, 0.014)
        + gaussianBump(x, y, 0.1, -0.12, 0.16, 0.14, 0.012)
        + craterRelief(x, y, 0.21, 0.18, 0.08, 0.01);
    case 'volcanic-plain':
      return gaussianBump(x, y, -0.15, -0.04, 0.23, 0.15, 0.012)
        + gaussianBump(x, y, 0.18, 0.16, 0.13, 0.11, 0.008);
    case 'wrinkle-ridges':
      return ridgeRelief(x, y, -0.12, 0.018, 0.022)
        + ridgeRelief(x, y, 0.02, 0.022, 0.025, 0.1)
        + ridgeRelief(x, y, 0.16, 0.016, 0.022, -0.08);
    case 'volcanic-domes':
      return gaussianBump(x, y, -0.12, 0.03, 0.105, 0.09, 0.026)
        + gaussianBump(x, y, 0.11, 0.13, 0.09, 0.075, 0.021)
        + gaussianBump(x, y, 0.18, -0.15, 0.07, 0.065, 0.015);
    case 'sinuous-rille':
      return rilleRelief(x, y);
    case 'volcanic-province':
      return gaussianBump(x, y, -0.17, -0.12, 0.2, 0.13, 0.015)
        + gaussianBump(x, y, 0.16, 0.12, 0.17, 0.12, 0.014)
        + ridgeRelief(x, y, 0.02, 0.009, 0.026, 0.16);
    case 'shadowed-uplands':
      return craterRelief(x, y, -0.07, 0.04, 0.14, 0.017)
        + craterRelief(x, y, 0.19, -0.17, 0.075, 0.01);
    case 'cratered-highlands':
      return craterRelief(x, y, -0.17, -0.1, 0.13, 0.018)
        + craterRelief(x, y, 0.08, 0.13, 0.105, 0.016)
        + craterRelief(x, y, 0.24, -0.13, 0.06, 0.011)
        + craterRelief(x, y, -0.03, 0.28, 0.055, 0.009);
    case 'ejecta-blanket': {
      const distance = Math.hypot(x + 0.04, y - 0.02);
      return craterRelief(x, y, -0.04, 0.02, 0.12, 0.016)
        + radialRidge(distance, 0.21, 0.014, 0.008)
        + craterRelief(x, y, 0.2, -0.2, 0.055, 0.008);
    }
    case 'impact-basin': {
      const distance = Math.hypot(x - 0.02, y + 0.01);
      return craterRelief(x, y, 0.02, -0.01, 0.2, 0.02)
        + radialRidge(distance, 0.29, 0.016, 0.009)
        + radialRidge(distance, 0.37, 0.018, 0.007);
    }
    case 'concentric-massif': {
      const distance = Math.hypot(x + 0.02, y - 0.01);
      return radialRidge(distance, 0.2, 0.026, 0.01)
        + radialRidge(distance, 0.32, 0.024, 0.011)
        - radialRidge(distance, 0.26, 0.014, 0.008);
    }
    case 'shadowed-crater':
      return craterRelief(x, y, 0.03, -0.04, 0.2, 0.026);
  }
}

function gaussianBump(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  widthX: number,
  widthY: number,
  height: number,
): number {
  const dx = (x - centerX) / widthX;
  const dy = (y - centerY) / widthY;
  return height * Math.exp(-0.5 * (dx * dx + dy * dy));
}

function craterRelief(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radius: number,
  height: number,
): number {
  const distance = Math.hypot(x - centerX, y - centerY);
  const rimDistance = (distance - radius) / (radius * 0.17);
  const bowlDistance = distance / (radius * 0.72);
  return height * Math.exp(-0.5 * rimDistance * rimDistance)
    - height * 0.44 * Math.exp(-Math.pow(bowlDistance, 4));
}

function ridgeRelief(
  x: number,
  y: number,
  offset: number,
  height: number,
  width: number,
  slope = 0,
): number {
  const ridgeY = offset + slope * x + Math.sin(x * 9 + offset * 12) * 0.025;
  const distance = (y - ridgeY) / width;
  return height * Math.exp(-0.5 * distance * distance);
}

function rilleRelief(x: number, y: number): number {
  const channelY = 0.03 + Math.sin(x * 5 + 0.4) * 0.13;
  const distance = y - channelY;
  const channel = Math.exp(-0.5 * Math.pow(distance / 0.018, 2));
  const nearBank = Math.exp(-0.5 * Math.pow((Math.abs(distance) - 0.043) / 0.018, 2));
  return -0.018 * channel + 0.009 * nearBank;
}

function radialRidge(distance: number, radius: number, width: number, height: number): number {
  const offset = (distance - radius) / width;
  return height * Math.exp(-0.5 * offset * offset);
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function warpTerrainPoint(point: THREE.Vector3): void {
  const { x, y, z } = point;
  point
    .set(
      x + 0.12 * Math.sin(y * 4.8 + z * 3.5) + 0.045 * Math.sin(z * 9.1 - x * 5.4),
      y + 0.12 * Math.sin(z * 4.4 + x * 3.8) + 0.045 * Math.sin(x * 8.6 - y * 5.7),
      z + 0.12 * Math.sin(x * 5.2 + y * 4.1) + 0.045 * Math.sin(y * 9.3 - z * 5.1),
    )
    .normalize();
}
