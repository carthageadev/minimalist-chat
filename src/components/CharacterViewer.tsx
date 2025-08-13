"use client";

import React, { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

interface CharacterViewerProps {
  modelPath: string;
  animationPath?: string;
  onLoadComplete?: () => void;
}

function Model({
  modelPath,
  animationPath,
  onLoadComplete,
  onDebugUpdate,
}: CharacterViewerProps & {
  onDebugUpdate?: (debug: {
    modelLoaded: boolean;
    animationLoaded: boolean;
    mixer: THREE.AnimationMixer | null;
    currentAction: THREE.AnimationAction | null;
  }) => void;
}) {
  return (
    <ModelLoader
      url={modelPath}
      animationPath={animationPath}
      onLoadComplete={onLoadComplete}
      onDebugUpdate={onDebugUpdate}
    />
  );
}

function ModelLoader({
  url,
  animationPath,
  onLoadComplete,
  onDebugUpdate,
}: {
  url: string;
  animationPath?: string;
  onLoadComplete?: () => void;
  onDebugUpdate?: (debug: {
    modelLoaded: boolean;
    animationLoaded: boolean;
    mixer: THREE.AnimationMixer | null;
    currentAction: THREE.AnimationAction | null;
  }) => void;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const [currentAction, setCurrentAction] =
    useState<THREE.AnimationAction | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [animationLoaded, setAnimationLoaded] = useState(false);
  const [scene, setScene] = useState<THREE.Group | null>(null);

  // Load FBX model
  useEffect(() => {
    if (!url) return;

    console.log("Loading FBX model:", url);

    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      url,
      (fbx: THREE.Group) => {
        console.log("FBX model loaded:", fbx);

        // Scale and position the model appropriately
        fbx.scale.setScalar(0.0000005); // Scale down more aggressively
        fbx.position.set(0, -1, 0); // Move down slightly

        setScene(fbx);
        setModelLoaded(true);

        if (onLoadComplete) {
          onLoadComplete();
        }

        if (onDebugUpdate) {
          onDebugUpdate({
            modelLoaded: true,
            animationLoaded,
            mixer,
            currentAction,
          });
        }
      },
      (progress) => {
        console.log(
          "Model loading progress:",
          (progress.loaded / progress.total) * 100,
          "%"
        );
      },
      (error) => {
        console.error("Error loading FBX model:", error);
      }
    );
  }, [
    url,
    onLoadComplete,
    onDebugUpdate,
    animationLoaded,
    mixer,
    currentAction,
  ]);

  // Load and apply animation
  useEffect(() => {
    if (!animationPath || !modelLoaded || !scene) return;

    console.log("Loading animation:", animationPath);

    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      animationPath,
      (fbx: THREE.Group) => {
        console.log("Animation FBX loaded, animations:", fbx.animations.length);

        if (fbx.animations.length > 0 && scene) {
          const clip = fbx.animations[0];

          if (clip) {
            try {
              // Create mixer on the scene object
              const newMixer = new THREE.AnimationMixer(scene);

              console.log(
                "Animation clip:",
                clip.name,
                "duration:",
                clip.duration,
                "tracks:",
                clip.tracks.length
              );

              // Log the track names to debug skeleton compatibility
              clip.tracks.forEach((track, index) => {
                console.log(`Track ${index}:`, track.name);
              });

              // Apply the animation clip to the model
              const action = newMixer.clipAction(clip);

              setMixer(newMixer);
              setCurrentAction(action);
              setAnimationLoaded(true);

              action.play();
              console.log("Animation applied successfully");

              if (onDebugUpdate) {
                onDebugUpdate({
                  modelLoaded: true,
                  animationLoaded: true,
                  mixer: newMixer,
                  currentAction: action,
                });
              }
            } catch (error) {
              console.error("Error applying animation:", error);
            }
          }
        } else {
          console.warn("No animations found in FBX file or scene not ready");
        }
      },
      (progress) => {
        console.log(
          "Animation loading progress:",
          (progress.loaded / progress.total) * 100,
          "%"
        );
      },
      (error) => {
        console.error("Error loading animation:", error);
      }
    );
  }, [animationPath, modelLoaded, scene, onDebugUpdate]);

  // Use React Three Fiber's animation loop
  useFrame((state, delta) => {
    if (mixer) {
      mixer.update(delta);
    }
  });

  if (!scene) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="gray" />
      </mesh>
    );
  }

  return (
    <primitive ref={meshRef} object={scene} scale={1} position={[0, 0, 0]} />
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="blue" />
    </mesh>
  );
}

// Debug component to help identify issues
function DebugInfo({
  modelLoaded,
  animationLoaded,
  mixer,
  currentAction,
}: {
  modelLoaded: boolean;
  animationLoaded: boolean;
  mixer: THREE.AnimationMixer | null;
  currentAction: THREE.AnimationAction | null;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        fontSize: "12px",
        zIndex: 1000,
      }}
    >
      <div>Model Loaded: {modelLoaded ? "✅" : "❌"}</div>
      <div>Animation Loaded: {animationLoaded ? "✅" : "❌"}</div>
      <div>Mixer: {mixer ? "✅" : "❌"}</div>
      <div>Action: {currentAction ? "✅" : "❌"}</div>
      {currentAction && (
        <div>Action Time: {currentAction.time.toFixed(2)}s</div>
      )}
    </div>
  );
}

export default function CharacterViewer(props: CharacterViewerProps) {
  const [debugInfo, setDebugInfo] = useState({
    modelLoaded: false,
    animationLoaded: false,
    mixer: null as THREE.AnimationMixer | null,
    currentAction: null as THREE.AnimationAction | null,
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 2, 8], fov: 45 }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />

        {/* Environment */}
        <Environment preset="studio" />

        {/* Model with Suspense for loading */}
        <Suspense fallback={<LoadingFallback />}>
          <Model {...props} onDebugUpdate={setDebugInfo} />
        </Suspense>

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={15}
          autoRotate={false}
          autoRotateSpeed={0.5}
        />

        {/* Grid helper for reference */}
        <gridHelper args={[10, 10, "#444444", "#222222"]} />
      </Canvas>

      {/* Debug info overlay */}
      <DebugInfo {...debugInfo} />
    </div>
  );
}
