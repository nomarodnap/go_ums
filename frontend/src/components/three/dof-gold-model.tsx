"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  Camera,
  Layers,
  Palette,
  Sun,
  RotateCw,
  Pause,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type GoldPreset = "24k" | "champagne" | "rose" | "antique";
export type MotionMode = "light" | "model" | "both" | "static";

interface GoldMaterialConfig {
  color: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

const GOLD_PRESETS: Record<GoldPreset, GoldMaterialConfig> = {
  "24k": {
    color: 0xffc83b,
    metalness: 0.95,
    roughness: 0.16,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  },
  champagne: {
    color: 0xf3e5ab,
    metalness: 0.9,
    roughness: 0.22,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
  },
  rose: {
    color: 0xe8a598,
    metalness: 0.92,
    roughness: 0.18,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
  },
  antique: {
    color: 0xd4af37,
    metalness: 0.85,
    roughness: 0.35,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
  },
};

export function DofGoldModel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const mouseLightRef = useRef<THREE.PointLight | null>(null);
  const baseDiscMeshRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Orbiting lights & indicators refs
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const orbitGlintLightRef = useRef<THREE.PointLight | null>(null);
  const lightOrbMeshRef = useRef<THREE.Group | null>(null);
  const lightAngleRef = useRef<number>(0);

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [motionMode, setMotionMode] = useState<MotionMode>("light");
  const [lightSpeed, setLightSpeed] = useState<number>(1.0);
  const [showLightOrb, setShowLightOrb] = useState<boolean>(false);
  const [goldPreset, setGoldPreset] = useState<GoldPreset>("24k");
  const [extrusionDepth, setExtrusionDepth] = useState(12);
  const [roughness, setRoughness] = useState(0.18);
  const [metalness, setMetalness] = useState(0.95);
  const [baseDiscMode, setBaseDiscMode] = useState<"none" | "glass" | "navy">("none");
  const [showWireframe, setShowWireframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState({ pathCount: 0, meshCount: 0, vertices: 0 });

  // Refs for access in animation loop without recreation
  const motionModeRef = useRef<MotionMode>("light");
  const lightSpeedRef = useRef<number>(1.0);

  useEffect(() => {
    motionModeRef.current = motionMode;
    if (lightOrbMeshRef.current) {
      lightOrbMeshRef.current.visible =
        showLightOrb && (motionMode === "light" || motionMode === "both");
    }
  }, [motionMode, showLightOrb]);

  useEffect(() => {
    lightSpeedRef.current = lightSpeed;
  }, [lightSpeed]);

  // Material instance that updates reactively
  const goldMaterialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);

  // Create environment map / reflections for metallic surfaces
  const createStudioEnvironment = useCallback((renderer: THREE.WebGLRenderer) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Procedural Studio HDRI Room
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0a0c14);

    // Warm top softbox
    const topLight = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: 0xfffae6, side: THREE.DoubleSide })
    );
    topLight.position.set(0, 50, 0);
    topLight.rotation.x = Math.PI / 2;
    envScene.add(topLight);

    // Cyan/Blue side rim softbox
    const rimLight = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({ color: 0x88ccff, side: THREE.DoubleSide })
    );
    rimLight.position.set(-60, 20, -30);
    rimLight.rotation.y = Math.PI / 4;
    envScene.add(rimLight);

    // Warm gold fill softbox
    const goldFill = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({ color: 0xffaa22, side: THREE.DoubleSide })
    );
    goldFill.position.set(60, 20, 30);
    goldFill.rotation.y = -Math.PI / 4;
    envScene.add(goldFill);

    const renderTarget = pmremGenerator.fromScene(envScene);
    pmremGenerator.dispose();
    return renderTarget.texture;
  }, []);

  // Build the 3D SVG model
  const buildModelFromSVG = useCallback(
    (svgData: { paths: Array<{ toShapes: (isCCW: boolean) => THREE.Shape[]; userData?: { node?: Element; style?: Record<string, string> } }> }, depth: number) => {
      const group = new THREE.Group();
      let totalVertices = 0;
      let meshCount = 0;

      // Filter out path33947 (the solid white/blue background backing plate)
      const validPaths = svgData.paths.filter((p) => {
        const id = p.userData?.node?.getAttribute("id");
        return id !== "path33947";
      });

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: depth,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 1.2,
        bevelThickness: 1.2,
        curveSegments: 16,
      };

      // Create base gold material
      if (!goldMaterialRef.current) {
        goldMaterialRef.current = new THREE.MeshPhysicalMaterial({
          color: GOLD_PRESETS[goldPreset].color,
          metalness: metalness,
          roughness: roughness,
          clearcoat: 0.7,
          clearcoatRoughness: 0.1,
          reflectivity: 0.95,
          side: THREE.DoubleSide,
        });
      }

      validPaths.forEach((path) => {
        const shapes = path.toShapes(true);
        shapes.forEach((shape) => {
          try {
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.computeVertexNormals();

            totalVertices += geometry.attributes.position.count;
            meshCount++;

            const mesh = new THREE.Mesh(geometry, goldMaterialRef.current!);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
          } catch (e) {
            // Skip invalid or zero-area sub-shapes safely
          }
        });
      });

      // SVG coordinates are typically Y-down, flip Y so emblem is upright
      group.scale.set(1, -1, 1);

      // Center geometry around origin (0, 0, 0)
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      group.position.x = -center.x;
      group.position.y = -center.y;
      group.position.z = -center.z;

      // Wrap in an outer pivot group for clean rotation & scaling
      const pivot = new THREE.Group();
      pivot.add(group);

      // Scale to comfortable viewport size (approx 180 units wide)
      const maxDim = Math.max(size.x, size.y);
      if (maxDim > 0) {
        const targetSize = 180;
        const scale = targetSize / maxDim;
        pivot.scale.set(scale, scale, scale);
      }

      // Create optional Base Disc (behind model)
      const discRadius = 98;
      const discGeo = new THREE.CylinderGeometry(discRadius, discRadius, 4, 64);
      discGeo.rotateX(Math.PI / 2);

      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        roughness: 0.1,
        transmission: 0.9,
        thickness: 4,
        ior: 1.52,
      });

      const baseDisc = new THREE.Mesh(discGeo, glassMat);
      baseDisc.position.z = -8;
      baseDisc.visible = false;
      pivot.add(baseDisc);
      baseDiscMeshRef.current = baseDisc;

      setStats({
        pathCount: validPaths.length,
        meshCount,
        vertices: totalVertices,
      });

      return pivot;
    },
    [goldPreset, metalness, roughness]
  );

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x06080e);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    camera.position.set(0, 0, 320);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and tone mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Studio Environment Reflections
    const envTexture = createStudioEnvironment(renderer);
    scene.environment = envTexture;

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 80;
    controls.maxDistance = 650;
    controls.maxPolarAngle = Math.PI * 0.85;
    controlsRef.current = controls;

    // 6. Lighting Rig
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.7);
    scene.add(ambientLight);

    // Main Golden Key Light (Orbiting in 3D)
    const keyLight = new THREE.DirectionalLight(0xfffae6, 2.6);
    keyLight.position.set(120, 150, 200);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    // Cool Rim Light (Orbiting opposite side, accentuates beveled contours)
    const rimLight = new THREE.DirectionalLight(0x70b5ff, 2.2);
    rimLight.position.set(-150, -100, -150);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // Warm Bottom Fill Light (Anchor)
    const fillLight = new THREE.DirectionalLight(0xffaa33, 1.0);
    fillLight.position.set(0, -180, 100);
    scene.add(fillLight);

    // Orbiting Specular Glint Point Light (sweeps across gold bevels)
    const orbitGlintLight = new THREE.PointLight(0xffefc0, 5.5, 320, 1.2);
    orbitGlintLight.position.set(120, 40, 120);
    scene.add(orbitGlintLight);
    orbitGlintLightRef.current = orbitGlintLight;

    // Visual Light Orb (Luminous indicator showing orbiting light position)
    const orbGroup = new THREE.Group();
    const orbCore = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const orbCorona = new THREE.Mesh(
      new THREE.SphereGeometry(7.0, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffc83b,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      })
    );
    orbGroup.add(orbCore);
    orbGroup.add(orbCorona);
    orbGroup.position.copy(orbitGlintLight.position);
    orbGroup.visible = false;
    scene.add(orbGroup);
    lightOrbMeshRef.current = orbGroup;

    // 7. Ground Shadow Shadow-Catching Plane
    const shadowPlaneGeo = new THREE.PlaneGeometry(800, 800);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.position.z = -35;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // 8. Load SVG Model
    const loader = new SVGLoader();
    loader.load(
      "/vector.svg",
      (data) => {
        const model = buildModelFromSVG(data, extrusionDepth);
        modelGroupRef.current = model;
        scene.add(model);
        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        } else {
          setLoadProgress(65);
        }
      },
      (error) => {
        console.error("Error loading vector.svg:", error);
        setIsLoading(false);
      }
    );

    // 10. Animation Loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      controls.update();

      const mode = motionModeRef.current;
      const speed = lightSpeedRef.current;

      // 1. Model Rotation & Orientation Handling
      if (modelGroupRef.current) {
        if (mode === "model" || mode === "both") {
          modelGroupRef.current.rotation.y += delta * 0.45;
        } else if (mode === "light") {
          // Keep emblem facing forward with smooth spring damping
          modelGroupRef.current.rotation.y = THREE.MathUtils.damp(
            modelGroupRef.current.rotation.y,
            0,
            3.0,
            delta
          );
          modelGroupRef.current.rotation.x = THREE.MathUtils.damp(
            modelGroupRef.current.rotation.x,
            0,
            3.0,
            delta
          );
        }
      }

      // 2. Lights Orbiting Around the Emblem
      if (mode === "light" || mode === "both") {
        lightAngleRef.current += delta * 0.85 * speed;
        const a = lightAngleRef.current;

        // Primary Golden Key Light 3D Orbit
        if (keyLightRef.current) {
          const rKey = 240;
          keyLightRef.current.position.x = Math.cos(a) * rKey;
          keyLightRef.current.position.z = Math.sin(a) * rKey;
          keyLightRef.current.position.y = 120 + Math.sin(a * 2) * 50;
          keyLightRef.current.lookAt(0, 0, 0);
        }

        // Rim Light 3D Orbit (Offset by 180 degrees)
        if (rimLightRef.current) {
          const rRim = 220;
          rimLightRef.current.position.x = Math.cos(a + Math.PI) * rRim;
          rimLightRef.current.position.z = Math.sin(a + Math.PI) * rRim;
          rimLightRef.current.position.y = -80 + Math.cos(a) * 40;
          rimLightRef.current.lookAt(0, 0, 0);
        }

        // Orbiting Point Light (High-intensity specular glint running across the front gold relief)
        if (orbitGlintLightRef.current) {
          const rGlint = 150;
          const glintX = Math.cos(a * 1.25) * rGlint;
          const glintY = Math.sin(a * 1.5) * 85;
          const glintZ = 110 + Math.sin(a * 0.9) * 45;

          orbitGlintLightRef.current.position.set(glintX, glintY, glintZ);

          if (lightOrbMeshRef.current) {
            lightOrbMeshRef.current.position.set(glintX, glintY, glintZ);
          }
        }
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    // 11. Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [buildModelFromSVG, createStudioEnvironment, extrusionDepth]);

  // Update material properties dynamically without rebuilding
  useEffect(() => {
    if (!goldMaterialRef.current) return;
    const config = GOLD_PRESETS[goldPreset];

    goldMaterialRef.current.color.setHex(config.color);
    goldMaterialRef.current.metalness = metalness;
    goldMaterialRef.current.roughness = roughness;
    goldMaterialRef.current.clearcoat = config.clearcoat;
    goldMaterialRef.current.clearcoatRoughness = config.clearcoatRoughness;
    goldMaterialRef.current.wireframe = showWireframe;
    goldMaterialRef.current.needsUpdate = true;
  }, [goldPreset, metalness, roughness, showWireframe]);

  // Update base disc mode
  useEffect(() => {
    const disc = baseDiscMeshRef.current;
    if (!disc) return;

    if (baseDiscMode === "none") {
      disc.visible = false;
    } else if (baseDiscMode === "glass") {
      disc.visible = true;
      (disc.material as THREE.MeshPhysicalMaterial).color.setHex(0xffffff);
      (disc.material as THREE.MeshPhysicalMaterial).opacity = 0.25;
      (disc.material as THREE.MeshPhysicalMaterial).transmission = 0.9;
    } else if (baseDiscMode === "navy") {
      disc.visible = true;
      (disc.material as THREE.MeshPhysicalMaterial).color.setHex(0x0e2b6d);
      (disc.material as THREE.MeshPhysicalMaterial).opacity = 0.95;
      (disc.material as THREE.MeshPhysicalMaterial).transmission = 0.0;
    }
  }, [baseDiscMode]);

  // Reset Camera View
  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current || !modelGroupRef.current) return;
    controlsRef.current.reset();
    cameraRef.current.position.set(0, 0, 320);
    modelGroupRef.current.rotation.set(0, 0, 0);
  };

  // Capture High-Res Screenshot
  const handleCaptureScreenshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `dof-gold-emblem-3d-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Toggle Fullscreen Container
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-b from-[#090b13] via-[#07090e] to-[#040508] select-none text-slate-100 font-sans">
      {/* 3D Canvas Container */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing outline-none"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity">
          <div className="relative flex size-20 items-center justify-center mb-4">
            <div className="absolute -inset-3 rounded-full bg-amber-500/30 blur-xl animate-pulse" />
            <div className="absolute -inset-1 rounded-full border-2 border-transparent border-t-amber-400 border-r-amber-500/50 animate-spin" />
            <div className="size-14 rounded-2xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center shadow-inner">
              <Sparkles className="size-7 text-amber-400 animate-bounce" />
            </div>
          </div>
          <p className="text-base font-semibold text-amber-300 tracking-wide">
            กำลังสร้างโมเดล 3D จากเวกเตอร์กรมประมง...
          </p>
          <p className="text-xs text-amber-200/70 mt-1 font-mono">
            ประมวลผลเส้นเวกเตอร์ {loadProgress}% (445 paths)
          </p>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-1.5">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Badge
            variant="outline"
            className="bg-amber-950/50 border-amber-500/40 text-amber-300 font-medium px-3 py-1 shadow-lg backdrop-blur-md flex items-center gap-1.5"
          >
            <Sparkles className="size-3.5 text-amber-400" />
            Three.js 3D Emblem Model
          </Badge>
          <span className="text-xs text-muted-foreground/80 font-mono hidden sm:inline">
            445 Extruded Vectors • Cutout Transparency
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md">
          ตราสัญลักษณ์กรมประมง (Metallic Gold 3D)
        </h1>
        <p className="text-xs text-slate-300/80 max-w-md drop-shadow">
          โมเดล 3 มิติเนื้อทองคำแท้ขัดเงาสะท้อนแสง โปร่งทะลุตามโครงสร้างเวกเตอร์ดั้งเดิม
          คลิกซ้ายลากเพื่อหมุน • สกอร์ลเพื่อซูม
        </p>
      </div>

      {/* Top Right Quick Actions */}
      <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center justify-end gap-2 pointer-events-auto">
        {/* Motion Mode Segmented Switcher */}
        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10 backdrop-blur-md shadow-lg">
          {(
            [
              { id: "light", label: "แสงโคจร", icon: Sun, desc: "โลโก้อยู่กับที่ แสงโคจรรอบโลโก้" },
              { id: "model", label: "หมุนโลโก้", icon: RotateCw, desc: "หมุนเฉพาะตัวโลโก้ แสงอยู่กับที่" },
              { id: "both", label: "หมุนคู่", icon: Sparkles, desc: "ทั้งโลโก้และแสงหมุนพร้อมกัน" },
              { id: "static", label: "หยุดนิ่ง", icon: Pause, desc: "หยุดการเคลื่อนไหวทั้งหมด" },
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            const isActive = motionMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMotionMode(m.id)}
                title={m.desc}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className={`size-3.5 ${isActive ? "text-amber-400" : ""}`} />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleResetCamera}
          className="h-9 px-3 gap-1.5 bg-black/40 border-white/10 text-slate-300 hover:bg-white/10 backdrop-blur-md"
          title="รีเซ็ตมุมมองกล้องกลับมาที่จุดกึ่งกลางด้านหน้า"
        >
          <RotateCcw className="size-3.5" />
          <span className="hidden md:inline">รีเซ็ตมุมมอง</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleCaptureScreenshot}
          className="h-9 px-3 gap-1.5 bg-black/40 border-white/10 text-slate-300 hover:bg-white/10 backdrop-blur-md"
          title="บันทึกภาพหน้าจอความละเอียดสูง (PNG)"
        >
          <Camera className="size-3.5" />
          <span className="hidden md:inline">ถ่ายภาพ</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={toggleFullscreen}
          className="h-9 w-9 p-0 bg-black/40 border-white/10 text-slate-300 hover:bg-white/10 backdrop-blur-md"
          title="เปิด/ปิดการแสดงผลเต็มหน้าจอ"
        >
          {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>

      {/* Floating Studio Controls Dock at Bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-5xl pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/85 border border-white/10 backdrop-blur-xl shadow-2xl">
          {/* Gold Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Palette className="size-3.5 text-amber-400" />
              เนื้อทอง:
            </span>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              {(
                [
                  { id: "24k", label: "ทองแท้ 24K", color: "bg-amber-400" },
                  { id: "champagne", label: "แชมเปญ", color: "bg-yellow-200" },
                  { id: "rose", label: "โรสโกลด์", color: "bg-rose-300" },
                  { id: "antique", label: "ทองโบราณ", color: "bg-amber-700" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setGoldPreset(preset.id);
                    setMetalness(GOLD_PRESETS[preset.id].metalness);
                    setRoughness(GOLD_PRESETS[preset.id].roughness);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    goldPreset === preset.id
                      ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <span className={`size-2 rounded-full ${preset.color}`} />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Base Disc Mode (Transparent vs Glass vs Navy) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="size-3.5 text-cyan-400" />
              แผ่นรอง:
            </span>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              {[
                { id: "none", label: "โปร่งทะลุ (Cutout)" },
                { id: "glass", label: "กระจกใส (Glass)" },
                { id: "navy", label: "กรมท่า (Navy Blue)" },
              ].map((disc) => (
                <button
                  key={disc.id}
                  onClick={() => setBaseDiscMode(disc.id as typeof baseDiscMode)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    baseDiscMode === disc.id
                      ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  {disc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orbit Light Controls & Roughness */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Light Speed Slider (when orbit is active) */}
            {(motionMode === "light" || motionMode === "both") && (
              <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-xl border border-white/5">
                <span className="text-[11px] text-amber-300 whitespace-nowrap flex items-center gap-1">
                  <Sun className="size-3 text-amber-400" />
                  ความเร็วแสง:
                </span>
                <input
                  type="range"
                  value={Math.round(lightSpeed * 10)}
                  min={2}
                  max={25}
                  step={1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLightSpeed(Number(e.target.value) / 10)
                  }
                  className="w-16 sm:w-20 accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                  title={`${lightSpeed.toFixed(1)}x`}
                />
                <span className="text-[10px] text-amber-300 font-mono w-6">
                  {lightSpeed.toFixed(1)}x
                </span>

                {/* Light Orb Indicator Toggle */}
                <button
                  onClick={() => setShowLightOrb(!showLightOrb)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border ml-1 ${
                    showLightOrb
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-black/30 text-slate-400 border-white/5 hover:text-slate-200"
                  }`}
                  title={showLightOrb ? "คลิกเพื่อซ่อนดวงไฟ (ล่องหน)" : "คลิกเพื่อแสดงดวงไฟนำทาง"}
                >
                  {showLightOrb ? <Eye className="size-3 text-amber-400" /> : <EyeOff className="size-3" />}
                  <span className="hidden sm:inline">{showLightOrb ? "ดวงไฟ (แสดง)" : "ดวงไฟ (ล่องหน)"}</span>
                </button>
              </div>
            )}

            {/* Roughness (Shine) */}
            <div className="flex items-center gap-2 w-32 sm:w-36">
              <span className="text-[11px] text-slate-400 whitespace-nowrap">ความเงา:</span>
              <input
                type="range"
                value={Math.round((1 - roughness) * 100)}
                min={50}
                max={95}
                step={1}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setRoughness(1 - Number(e.target.value) / 100)
                }
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
              />
            </div>

            {/* Wireframe Toggle */}
            <button
              onClick={() => setShowWireframe(!showWireframe)}
              className={`p-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                showWireframe
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-black/30 text-slate-400 border-white/5 hover:text-slate-200"
              }`}
              title="สลับโหมด Wireframe"
            >
              Wireframe
            </button>
          </div>
        </div>
      </div>

      {/* Model Stats Micro Badge */}
      <div className="absolute bottom-20 left-4 z-20 pointer-events-none hidden md:flex items-center gap-3 text-[11px] text-slate-400/80 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 backdrop-blur-md">
        <span>Paths: <strong className="text-amber-400">{stats.pathCount}</strong></span>
        <span>•</span>
        <span>Meshes: <strong className="text-amber-400">{stats.meshCount}</strong></span>
        <span>•</span>
        <span>Vertices: <strong className="text-amber-400">{stats.vertices.toLocaleString()}</strong></span>
      </div>
    </div>
  );
}

export default DofGoldModel;
