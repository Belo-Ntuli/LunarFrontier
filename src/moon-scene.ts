import * as THREE from 'three';
import { SECTORS, type ColonySave } from './game';

const MOON_RADIUS = 3;
const COLORS = {
  available: '#55d6c5',
  selected: '#f5cb78',
  hovered: '#fff0bd',
};
const SURFACE_COLORS = {
  available: new THREE.Color(COLORS.available),
  selected: new THREE.Color(COLORS.selected),
  hovered: new THREE.Color(COLORS.hovered),
};
const SURFACE_WIDTH = 1024;
const SURFACE_HEIGHT = 512;
const SECTOR_TINTS = [
  '#d1c5af', '#b9bcb7', '#c5c1b6', '#c4b9a7', '#b7b9b5',
  '#c6bba9', '#b7b8b5', '#c9c0af', '#bdbdb7', '#cfc2ac',
  '#b8bab6', '#c7bca9', '#b9b9b5', '#c9c1b2', '#b5b8b6',
];
const SECTOR_COLORS = SECTOR_TINTS.map((color) => new THREE.Color(color));

interface LunarSurface {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  baseCanvas: HTMLCanvasElement;
  sectorIds: Uint8Array;
  boundaryWeights: Uint8Array;
}

export class MoonScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly globe = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly onSelect: (sectorId: number) => void;
  private readonly onHover: (sectorId: number | null) => void;
  private readonly surface: LunarSurface;
  private readonly moon: THREE.Mesh;
  private colony: ColonySave | null;
  private hoveredId: number | null = null;
  private selectedId: number | null = null;
  private pointerDown: THREE.Vector2 | null = null;
  private dragged = false;
  private animationFrame = 0;
  private disposed = false;

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
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'moon-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D Moon. Drag to rotate and select a sector.');
    this.renderer.domElement.setAttribute('role', 'img');
    mount.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0.4, 10.1);
    this.scene.add(this.globe);
    this.globe.rotation.x = -0.08;
    this.surface = createLunarTexture();
    const moonGeometry = new THREE.SphereGeometry(MOON_RADIUS, 96, 72);
    this.moon = new THREE.Mesh(
      moonGeometry,
      new THREE.MeshStandardMaterial({
        map: this.surface.texture,
        color: '#ffffff',
        roughness: 1,
        metalness: 0,
      }),
    );
    this.globe.add(this.moon);
    this.addLighting();
    this.addStars();
    this.updateSurfaceTexture();

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.resize();
    this.animate();
  }

  update(colony: ColonySave | null, selectedId: number | null): void {
    this.colony = colony;
    this.selectedId = selectedId;
    this.updateSurfaceTexture();
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
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.Material) material.dispose();
        });
      }
    });
    this.renderer.dispose();
    canvas.remove();
  }

  private addLighting(): void {
    this.scene.add(new THREE.AmbientLight('#bac9df', 1.45));
    const key = new THREE.DirectionalLight('#fff0d6', 3.2);
    key.position.set(-5, 5, 7);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#5c9dcb', 1.3);
    rim.position.set(5, -2, -5);
    this.scene.add(rim);
  }

  private addStars(): void {
    const positions = new Float32Array(500 * 3);
    for (let index = 0; index < 500; index += 1) {
      const radius = 12 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const ring = Math.sqrt(1 - z * z);
      positions[index * 3] = radius * ring * Math.cos(theta);
      positions[index * 3 + 1] = radius * z;
      positions[index * 3 + 2] = radius * ring * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ color: '#bbd2f3', size: 0.035, transparent: true, opacity: 0.78 }),
      ),
    );
  }

  private updateSurfaceTexture(): void {
    const context = this.surface.canvas.getContext('2d');
    if (!context) throw new Error('Unable to update the lunar surface texture.');

    context.drawImage(this.surface.baseCanvas, 0, 0);
    const image = context.getImageData(0, 0, SURFACE_WIDTH, SURFACE_HEIGHT);
    const unlockedSectors = new Set(this.colony?.unlockedSectors ?? []);

    for (let pixel = 0; pixel < this.surface.sectorIds.length; pixel += 1) {
      const sectorId = this.surface.sectorIds[pixel];
      const tint = SECTOR_COLORS[sectorId];
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
            : 0.1 * (0.4 + 0.6 * weight);
      const highlight = isHovered
        ? SURFACE_COLORS.hovered
        : isSelected
          ? SURFACE_COLORS.selected
          : isUnlocked
            ? SURFACE_COLORS.available
            : tint;
      const offset = pixel * 4;
      image.data[offset] = Math.round(image.data[offset] * (1 - opacity) + highlight.r * 255 * opacity);
      image.data[offset + 1] = Math.round(image.data[offset + 1] * (1 - opacity) + highlight.g * 255 * opacity);
      image.data[offset + 2] = Math.round(image.data[offset + 2] * (1 - opacity) + highlight.b * 255 * opacity);
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

  private animate = (): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  };

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
    this.onHover(id);
  }

  private handlePointerDown = (event: PointerEvent): void => {
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
      const edgeDistance = THREE.MathUtils.clamp((bestScore - secondScore) / 0.035, 0, 1);
      boundaryWeights[pixel] = Math.round(edgeDistance * edgeDistance * (3 - 2 * edgeDistance) * 255);
    }
  }
  return { sectorIds, boundaryWeights };
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
