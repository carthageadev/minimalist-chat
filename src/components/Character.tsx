"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

interface CharacterViewerProps {
  modelPath: string;
  animationPath?: string;
  onLoadComplete?: () => void;
}

const manager = new THREE.LoadingManager();

let camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  loader: FBXLoader,
  guiMorphsFolder: any,
  stats: any,
  object: THREE.Group<THREE.Object3DEventMap>;

let mixer: THREE.AnimationMixer | null = null;

const clock = new THREE.Clock();
const PI90 = Math.PI / 2;

let floor: THREE.Mesh | null = null;
const controls = {
  key: [0, 0],
  ease: new THREE.Vector3(),
  position: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
  rotate: new THREE.Quaternion(),
  current: "Idle",
  fadeDuration: 0.5,
  runVelocity: 5,
  walkVelocity: 1.8,
  rotateSpeed: 0.05,
  floorDecale: 0,
};

const params = {
  character: "vanguard",
  animation: "walking",
};

const characters = ["vanguard", "x-bot", "y-bot"];
const animations = [
  "walking",
  "sneak-walk",
  "robot-hip-hop-dance",
  "tut-hip-hop-dance",
  "waving",
];

export default function Character(props: CharacterViewerProps) {
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      const container = document.createElement("div");
      root.appendChild(container);

      camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        2000
      );
      camera.position.set(100, 200, 300);

      scene = new THREE.Scene();

      // loadEnvironment();

      scene.background = new THREE.Color(0xa0a0a0);
      scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
      hemiLight.position.set(0, 200, 0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 5);
      dirLight.position.set(0, 200, 100);
      dirLight.castShadow = true;
      dirLight.shadow.camera.top = 180;
      dirLight.shadow.camera.bottom = -100;
      dirLight.shadow.camera.left = -120;
      dirLight.shadow.camera.right = 120;
      scene.add(dirLight);

      // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );

      // ground
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
      grid.material.opacity = 0.2;
      grid.material.transparent = true;
      scene.add(grid);

      loader = new FBXLoader(manager);
      loadCharacter(params.character);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setAnimationLoop(animate);
      // renderer.shadowMap.enabled = true;

      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.5;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 100, 0);
      controls.update();

      window.addEventListener("resize", onWindowResize);

      // stats
      // stats = new Stats();
      // container.appendChild(stats.dom);

      const gui = new GUI();
      // gui.add(params, "asset", assets).onChange(function (value) {
      //   loadAsset(value);
      // });

      gui.add(params, "character", characters).onChange(function (value) {
        loadCharacter(value);
      });

      gui.add(params, "animation", animations).onChange(function (value) {
        loadAnimation(value);
      });

      // guiMorphsFolder = gui.addFolder("Morphs").hide();
    }
  }, []);

  function loadEnvironment() {
    new RGBELoader()
      .setPath("textures/")
      .load("forest.hdr", function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;

        scene.background = texture;
        scene.environment = texture;

        render();
      });
  }

  function loadCharacter(asset: string) {
    loader.load("/models/" + asset + ".fbx", function (group) {
      object = group;

      if (object) {
        scene.remove(
          scene.children.find((child) => child instanceof THREE.Group)!
        );
        scene.add(object);
      }

      loadAnimation(params.animation);
    });
  }

  function loadAnimation(asset: string) {
    loader.load("/animations/" + asset + ".fbx", function (animationGroup) {
      if (
        object &&
        animationGroup.animations &&
        animationGroup.animations.length > 0
      ) {
        // Create mixer on the character object
        mixer = new THREE.AnimationMixer(object);

        // Get the animation clip from the animation file
        const clip = animationGroup.animations[0]!;

        // Apply the animation to the character
        const action = mixer.clipAction(clip);
        action.play();

        console.log("Animation applied successfully:", clip.name);
      } else {
        console.warn("No animations found or character not loaded");
        mixer = null;
      }

      // Set up shadows and other properties
      object.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if ((child as THREE.Mesh).morphTargetDictionary) {
            // Handle morph targets if needed
            // guiMorphsFolder.show();
            // ... existing morph target code ...
          }
        }
      });
    });
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    const delta = clock.getDelta();

    if (mixer) mixer.update(delta);

    renderer.render(scene, camera);

    // stats.update();
  }

  function render() {
    renderer.render(scene, camera);
  }

  return (
    <div
      id="root"
      style={{ position: "relative", width: "100%", height: "100%" }}
    ></div>
  );
}
