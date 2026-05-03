'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

interface ThreeViewerProps {
  fileUrl: string;
  fileType: string; // 'stl' | 'obj'
  fileName?: string;
}

export default function ThreeViewer({ fileUrl, fileType, fileName }: ThreeViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d14);

    // Camera
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.set(0, 0, 5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7.5);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x7c3aed, 0.4);
    fillLight.position.set(-5, -5, -5);
    scene.add(fillLight);

    // Grid
    const grid = new THREE.GridHelper(10, 20, 0x1e1e2e, 0x1e1e2e);
    scene.add(grid);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;

    // Load model
    const material = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      metalness: 0.2,
      roughness: 0.5,
    });

    const fitCameraToObject = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      object.position.sub(center); // center the model

      const fov = camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
      camera.position.set(cameraZ * 0.6, cameraZ * 0.4, cameraZ);
      camera.near = maxDim / 100;
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();

      grid.position.y = -size.y / 2;
    };

    const type = fileType?.toLowerCase();

    if (type === 'stl') {
      const loader = new STLLoader();
      loader.load(
        fileUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
          fitCameraToObject(mesh);
        },
        undefined,
        (err) => console.warn('STL load error:', err)
      );
    } else if (type === 'obj') {
      const loader = new OBJLoader();
      loader.load(
        fileUrl,
        (object) => {
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              (child as THREE.Mesh).material = material;
              child.castShadow = true;
            }
          });
          scene.add(object);
          fitCameraToObject(object);
        },
        undefined,
        (err) => console.warn('OBJ load error:', err)
      );
    }

    // Animation loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [fileUrl, fileType]);

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute bottom-2 right-2 text-xs text-slate-500 pointer-events-none select-none">
        🖱 Drag to rotate · Scroll to zoom
      </div>
      {fileName && (
        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/50 text-xs text-slate-400">
          {fileName}
        </div>
      )}
    </div>
  );
}
