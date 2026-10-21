"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { Sparkles } from "lucide-react";

interface DofGoldLogo3DProps {
  className?: string;
  size?: number;
}

export function DofGoldLogo3D({
  className = "",
  size = 180,
}: DofGoldLogo3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = size;
    const height = size;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = null;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
    camera.position.set(0, 0, 250);

    // 3. Renderer with high performance & tone mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Technique 2: High-Contrast Studio Environment for Dynamic Rotating Reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x020306);

    // High-contrast vertical softbox strips (studio lighting panels)
    const whiteSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 160),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    whiteSoftbox.position.set(0, 0, 75);
    envScene.add(whiteSoftbox);

    const goldSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 160),
      new THREE.MeshBasicMaterial({ color: 0xffd268, side: THREE.DoubleSide })
    );
    goldSoftbox.position.set(65, 0, 20);
    goldSoftbox.rotation.y = -Math.PI / 4;
    envScene.add(goldSoftbox);

    const rimSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 150),
      new THREE.MeshBasicMaterial({ color: 0x90d5ff, side: THREE.DoubleSide })
    );
    rimSoftbox.position.set(-65, 0, -20);
    rimSoftbox.rotation.y = Math.PI / 4;
    envScene.add(rimSoftbox);

    const topSoftbox = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 28),
      new THREE.MeshBasicMaterial({ color: 0xfffaee, side: THREE.DoubleSide })
    );
    topSoftbox.position.set(0, 65, 0);
    topSoftbox.rotation.x = Math.PI / 2;
    envScene.add(topSoftbox);

    const envTexture = pmremGenerator.fromScene(envScene).texture;
    pmremGenerator.dispose();
    scene.environment = envTexture;

    // 5. Lighting Setup
    // 5.1 Base Ambient Light (keeps #19429C backing plate rich & uniform)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // 5.2 Stationary Front Fill Light (ensures gold text remains legible from all angles)
    const frontFillLight = new THREE.DirectionalLight(0xfff6ea, 1.1);
    frontFillLight.position.set(0, 25, 230);
    scene.add(frontFillLight);

    // 5.3 Technique 1: Light Sweep (กวาดแสงผ่านพื้นผิวแบบ Motion Graphic)
    const sweepLight = new THREE.SpotLight(0xfff6dc, 0, 500, Math.PI / 5, 0.75, 1.2);
    sweepLight.position.set(-200, 30, 135);
    const sweepTarget = new THREE.Object3D();
    sweepTarget.position.set(-200, 0, 0);
    scene.add(sweepTarget);
    sweepLight.target = sweepTarget;
    scene.add(sweepLight);

    // 5.4 Technique 3: Orbiting Rim Light (ไฟตัดขอบวิ่งวนรอบวงกลมอย่างเด่นชัด)
    const rimOrbitLight = new THREE.DirectionalLight(0x80c8ff, 4.2);
    rimOrbitLight.position.set(160, 0, 55);
    scene.add(rimOrbitLight);

    // 6. Materials
    // 6.1 24K Royal Gold Material with Specular Spread (Roughness 0.22)
    const goldMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffcf48,
      metalness: 0.94,
      roughness: 0.22, // Sweet spot 0.15 - 0.3 for soft specular spread & 3D bevel sheen
      clearcoat: 0.65,
      clearcoatRoughness: 0.14,
      reflectivity: 0.95,
      side: THREE.DoubleSide,
    });

    // 6.2 Matte Non-Reflective Royal Blue Disc Material (#19429C)
    const blueMaterial = new THREE.MeshStandardMaterial({
      color: 0x19429c,
      roughness: 1.0, // 100% matte non-reflective
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    // 7. Load & Extrude SVG Model
    const loader = new SVGLoader();
    loader.load(
      "/vector.svg",
      (data) => {
        const group = new THREE.Group();
        const paths = ((data as any).paths || []) as any[];

        const discPath = paths.find((p: any) => {
          const id = p.userData?.node?.getAttribute?.("id");
          return id === "path33947";
        });
        const goldPaths = paths.filter((p: any) => {
          const id = p.userData?.node?.getAttribute?.("id");
          return id !== "path33947";
        });

        // 7.1 Extrude Matte Blue Backing Disc (#19429C)
        if (discPath) {
          const discShapes = discPath.toShapes(true);
          const discExtrudeSettings: THREE.ExtrudeGeometryOptions = {
            depth: 4,
            bevelEnabled: false,
            curveSegments: 64,
          };
          discShapes.forEach((shape: THREE.Shape) => {
            try {
              const geometry = new THREE.ExtrudeGeometry(shape, discExtrudeSettings);
              geometry.computeVertexNormals();
              const discMesh = new THREE.Mesh(geometry, blueMaterial);
              discMesh.position.z = -4; // Front face at z = 0
              group.add(discMesh);
            } catch (e) {
              console.error("Error creating blue disc geometry:", e);
            }
          });
        }

        // 7.2 Extrude 24K Gold Relief with Generous Curved Bevels
        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
          depth: 10,
          bevelEnabled: true,
          bevelSegments: 5,     // 5 segments for smooth rounded bevel highlight catching
          steps: 1,
          bevelSize: 1.4,       // Generous bevel catches the light sweep
          bevelThickness: 1.4,
          curveSegments: 16,
        };

        goldPaths.forEach((path: any) => {
          const shapes = path.toShapes(true);
          shapes.forEach((shape: THREE.Shape) => {
            try {
              const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
              geometry.computeVertexNormals();
              const mesh = new THREE.Mesh(geometry, goldMaterial);
              mesh.position.z = 0.2;
              group.add(mesh);
            } catch (e) {
              // skip zero-area geometry safely
            }
          });
        });

        group.scale.set(1, -1, 1);
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const sizeBox = box.getSize(new THREE.Vector3());

        group.position.x = -center.x;
        group.position.y = -center.y;
        group.position.z = -center.z;

        const pivot = new THREE.Group();
        pivot.add(group);

        const maxDim = Math.max(sizeBox.x, sizeBox.y);
        if (maxDim > 0) {
          const targetSize = 180;
          const scale = targetSize / maxDim;
          pivot.scale.set(scale, scale, scale);
        }

        scene.add(pivot);
        modelGroupRef.current = pivot;
        setIsLoaded(true);
      },
      undefined,
      (err) => console.error("Error loading vector.svg in 3D Logo:", err)
    );

    // 8. Animation Loop
    let lastTime = performance.now();
    let sweepTimer = 0;
    const SWEEP_CYCLE = 4.8; // 4.8s total cycle (2.4s sweep + 2.4s pause)
    const SWEEP_DURATION = 2.4;

    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // --- Technique 2: Rotating HDRI Environment Map ---
      // Continuously rotates reflections across gold curves without moving model
      scene.environmentRotation.y += delta * 0.32;
      scene.environmentRotation.z += delta * 0.16;

      // --- Technique 1: Light Sweep across Bevels ---
      sweepTimer = (sweepTimer + delta) % SWEEP_CYCLE;
      if (sweepTimer < SWEEP_DURATION) {
        const p = sweepTimer / SWEEP_DURATION; // 0 to 1
        const smoothP = p * p * (3 - 2 * p); // smoothstep
        const sweepX = -210 + smoothP * 420; // travels from -210 to +210
        const sweepY = 30 - smoothP * 30;    // slight diagonal incline
        sweepLight.position.set(sweepX, sweepY + 45, 135);
        sweepTarget.position.set(sweepX, sweepY, 0);

        // Bell curve intensity: smooth fade in & fade out
        const fade = Math.sin(p * Math.PI);
        sweepLight.intensity = fade * 7.5;
      } else {
        sweepLight.intensity = 0;
      }

      // --- Technique 3: Orbiting Rim Light (Silhouette & Extrusion thickness) ---
      const rimAngle = time * 0.0014; // smooth continuous 360-degree orbit
      const rRim = 160;
      rimOrbitLight.position.x = Math.cos(rimAngle) * rRim;
      rimOrbitLight.position.y = Math.sin(rimAngle) * rRim;
      rimOrbitLight.position.z = 55 + Math.sin(rimAngle * 2) * 20;
      rimOrbitLight.lookAt(0, 0, 0);

      // Keep logo calm, stationary facing straight forward
      if (modelGroupRef.current) {
        modelGroupRef.current.rotation.set(0, 0, 0);
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
      goldMaterial.dispose();
      blueMaterial.dispose();
      envTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        ref={containerRef}
        className={`w-full h-full pointer-events-none transition-opacity duration-700 ${
          isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        title="ตราสัญลักษณ์กรมประมง 3D (Dynamic Light Sweep & Gold Reflections)"
      />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-16 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse flex items-center justify-center">
            <Sparkles className="size-6 text-amber-400 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
}

export default DofGoldLogo3D;
