"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useLightEvents } from "~/lib/light-events";

let camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  group: THREE.Group<THREE.Object3DEventMap>,
  followGroup: THREE.Group<THREE.Object3DEventMap>,
  orbitControls: OrbitControls,
  model: THREE.Group<THREE.Object3DEventMap>,
  actions: {
    Idle: THREE.AnimationAction;
    Walk: THREE.AnimationAction;
    Run: THREE.AnimationAction;
  };

let mixer: THREE.AnimationMixer | null = null;

const clock = new THREE.Clock();

const PI = Math.PI;
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

// Add these variables at the top with other global variables
let yellowLight: THREE.PointLight,
  redLights: THREE.PointLight[] = [],
  bulbLight: THREE.PointLight;

export default function Character() {
  // Set up light event listeners
  useLightEvents({
    onToggleYellowLight: () => {
      if (yellowLight) {
        yellowLight.intensity = yellowLight.intensity > 0 ? 0 : 30;
      }
    },
    onToggleRedLights: () => {
      redLights.forEach((light) => {
        light.intensity = light.intensity > 0 ? 0 : 1;
      });
    },
    onToggleBulbLight: () => {
      if (bulbLight) {
        bulbLight.intensity = bulbLight.intensity > 0 ? 0 : 10;
      }
    },
    onTurnOnYellowLight: () => {
      if (yellowLight) yellowLight.intensity = 30;
    },
    onTurnOffYellowLight: () => {
      if (yellowLight) yellowLight.intensity = 0;
    },
    onTurnOnRedLights: () => {
      redLights.forEach((light) => (light.intensity = 1));
    },
    onTurnOffRedLights: () => {
      redLights.forEach((light) => (light.intensity = 0));
    },
    onTurnOnBulbLight: () => {
      if (bulbLight) bulbLight.intensity = 10;
    },
    onTurnOffBulbLight: () => {
      if (bulbLight) bulbLight.intensity = 0;
    },
    onTurnOnAllLights: () => {
      if (yellowLight) yellowLight.intensity = 30;
      redLights.forEach((light) => (light.intensity = 1));
      if (bulbLight) bulbLight.intensity = 10;
    },
    onTurnOffAllLights: () => {
      if (yellowLight) yellowLight.intensity = 0;
      redLights.forEach((light) => (light.intensity = 0));
      if (bulbLight) bulbLight.intensity = 0;
    },
    onSetYellowLightIntensity: (intensity: number) => {
      if (yellowLight) yellowLight.intensity = intensity;
    },
    onSetRedLightsIntensity: (intensity: number) => {
      redLights.forEach((light) => (light.intensity = intensity));
    },
    onSetBulbLightIntensity: (intensity: number) => {
      if (bulbLight) bulbLight.intensity = intensity;
    },
    onSetAllLightsIntensity: (intensity: number) => {
      if (yellowLight) yellowLight.intensity = intensity;
      redLights.forEach((light) => (light.intensity = intensity));
      if (bulbLight) bulbLight.intensity = intensity;
    },
  });

  useEffect(() => {
    init();

    return () => {
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function init() {
    const container = document.getElementById("root");

    if (!container) return;

    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0.33, 1.71, -1.76);

    scene = new THREE.Scene();

    group = new THREE.Group();
    scene.add(group);

    followGroup = new THREE.Group();
    scene.add(followGroup);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(0, 1, 0);
    orbitControls.enableDamping = true;
    // orbitControls.enablePan = false;
    orbitControls.maxPolarAngle = PI90 - 0.05;
    orbitControls.update();

    // To disable orbit controls completely, uncomment the line below:
    // orbitControls.enabled = false;

    window.addEventListener("resize", onWindowResize);
    // document.addEventListener("keydown", onKeyDown);
    // document.addEventListener("keyup", onKeyUp);

    loadModel();
    loadBuilding2();
    addLight();
  }

  function addLight() {
    yellowLight = new THREE.PointLight(0xffff66, 30, 0);
    yellowLight.position.set(0, 2, -3); // чуть выше и ближе к входу
    scene.add(yellowLight);

    // const yellowHelper = new THREE.PointLightHelper(yellowLight, 0.5); // размер 0.5
    // scene.add(yellowHelper);

    for (let i = 0; i < 10; i++) {
      const redLight = new THREE.PointLight(0xff3300, 1, 0);
      // const redLight = new THREE.PointLight(0x00ff00, 1, 0);
      redLight.position.set(0, 2.0, -(i * 0.4)); // чуть выше и ближе к входу
      scene.add(redLight);
      redLights.push(redLight);

      // const redHelper = new THREE.PointLightHelper(redLight, 0.5); // размер 0.5
      // scene.add(redHelper);
    }

    bulbLight = new THREE.PointLight(0xffee88, 10, 10000, 1);
    bulbLight.position.set(1, 0.1, -3);
    bulbLight.castShadow = true;
    scene.add(bulbLight);
  }

  // Add these new functions for controlling lights
  function toggleYellowLight() {
    if (yellowLight) {
      yellowLight.intensity = yellowLight.intensity > 0 ? 0 : 30;
    }
  }

  function toggleRedLights() {
    redLights.forEach((light) => {
      light.intensity = light.intensity > 0 ? 0 : 1;
    });
  }

  function toggleBulbLight() {
    if (bulbLight) {
      bulbLight.intensity = bulbLight.intensity > 0 ? 0 : 10;
    }
  }

  function turnOnAllLights() {
    if (yellowLight) yellowLight.intensity = 30;
    redLights.forEach((light) => (light.intensity = 1));
    if (bulbLight) bulbLight.intensity = 10;
  }

  function turnOffAllLights() {
    if (yellowLight) yellowLight.intensity = 0;
    redLights.forEach((light) => (light.intensity = 0));
    if (bulbLight) bulbLight.intensity = 0;
  }

  function loadModel() {
    const loader = new GLTFLoader();
    loader.load("models/Soldier.glb", function (gltf) {
      model = gltf.scene;
      group.add(model);
      model.rotation.y = PI;
      group.rotation.y = PI;

      model.traverse(function (object) {
        if (object instanceof THREE.Mesh) {
          if (object.name == "vanguard_Mesh") {
            object.castShadow = true;
            object.receiveShadow = true;
            //object.material.envMapIntensity = 0.5;
            object.material.metalness = 1.0;
            object.material.roughness = 0.2;
            object.material.color.set(1, 1, 1);
            object.material.metalnessMap = object.material.map;
          } else {
            object.material.metalness = 1;
            object.material.roughness = 0;
            object.material.transparent = true;
            object.material.opacity = 0.8;
            object.material.color.set(1, 1, 1);
          }
        }
      });

      const animations = gltf.animations;

      mixer = new THREE.AnimationMixer(model);

      actions = {
        Idle: mixer.clipAction(animations[0]!),
        Walk: mixer.clipAction(animations[3]!),
        Run: mixer.clipAction(animations[1]!),
      };

      for (const m in actions) {
        actions[m as keyof typeof actions].enabled = true;
        actions[m as keyof typeof actions].setEffectiveTimeScale(1);
        if (m !== "Idle")
          actions[m as keyof typeof actions].setEffectiveWeight(0);
      }

      actions.Idle.play();

      animate();
    });
  }

  function loadBuilding2() {
    const loader = new GLTFLoader();
    loader.load("models/rusted-scifi-hallway.glb", function (gltf) {
      const building = gltf.scene;

      building.rotation.y = Math.PI; // Rotate 180 degrees around Y axis

      building.position.y = 0.5; // Lift the building up slightly

      // building.position.set(0, 0, 0); // Adjust as needed
      // building.scale.setScalar(30); // Adjust scale if needed

      building.traverse(function (object) {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          object.material.envMapIntensity = 0.5;
          object.material.metalness = 1.0;
          object.material.roughness = 0.2;
          object.material.color.set(1, 1, 1);
          object.material.metalnessMap = object.material.map;
        }
      });

      scene.add(building);
    });
  }

  function updateCharacter(delta: number) {
    const fade = controls.fadeDuration;
    const key = controls.key;
    const up = controls.up;
    const ease = controls.ease;
    const rotate = controls.rotate;
    const position = controls.position;
    const azimuth = orbitControls.getAzimuthalAngle();

    const active = key[0] === 0 && key[1] === 0 ? false : true;
    const play = active ? (key[2] ? "Run" : "Walk") : "Idle";

    // change animation

    if (controls.current != play) {
      const current = actions[play as keyof typeof actions];
      const old = actions[controls.current as keyof typeof actions];
      controls.current = play;

      current.reset();
      current.weight = 1.0;
      current.stopFading();
      old.stopFading();
      // synchro if not idle
      if (play !== "Idle")
        current.time =
          old.time * (current.getClip().duration / old.getClip().duration);
      old._scheduleFading(fade, old.getEffectiveWeight(), 0);
      current._scheduleFading(fade, current.getEffectiveWeight(), 1);
      current.play();
    }

    // move object

    if (controls.current !== "Idle") {
      // run/walk velocity
      const velocity =
        controls.current == "Run"
          ? controls.runVelocity
          : controls.walkVelocity;

      // direction with key
      ease.set(key[1]!, 0, key[0]!).multiplyScalar(velocity * delta);

      // calculate camera direction
      const angle = unwrapRad(Math.atan2(ease.x, ease.z) + azimuth);
      rotate.setFromAxisAngle(up, angle);

      // apply camera angle on ease
      controls.ease.applyAxisAngle(up, azimuth);

      position.add(ease);
      camera.position.add(ease);

      group.position.copy(position);
      group.quaternion.rotateTowards(rotate, controls.rotateSpeed);

      orbitControls.target.copy(position).add({ x: 0, y: 1, z: 0 });
      followGroup.position.copy(position);

      // Move the floor without any limit
      if (floor) {
        const dx = position.x - floor.position.x;
        const dz = position.z - floor.position.z;
        if (Math.abs(dx) > controls.floorDecale) floor.position.x += dx;
        if (Math.abs(dz) > controls.floorDecale) floor.position.z += dz;
      }
    }

    if (mixer) mixer.update(delta);

    orbitControls.update();
  }

  function unwrapRad(r: number) {
    return Math.atan2(Math.sin(r), Math.cos(r));
  }

  function onKeyDown(event: KeyboardEvent) {
    const key = controls.key;
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
      case "KeyZ":
        key[0] = -1;
        break;
      case "ArrowDown":
      case "KeyS":
        key[0] = 1;
        break;
      case "ArrowLeft":
      case "KeyA":
      case "KeyQ":
        key[1] = -1;
        break;
      case "ArrowRight":
      case "KeyD":
        key[1] = 1;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        key[2] = 1;
        break;
      // Add light controls
      case "KeyL":
        toggleYellowLight();
        break;
      case "KeyR":
        toggleRedLights();
        break;
      case "KeyB":
        toggleBulbLight();
        break;
      case "KeyO":
        turnOnAllLights();
        break;
      case "KeyP":
        turnOffAllLights();
        break;
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    const key = controls.key;
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
      case "KeyZ":
        key[0] = key[0]! < 0 ? 0 : key[0]!;
        break;
      case "ArrowDown":
      case "KeyS":
        key[0] = key[0]! > 0 ? 0 : key[0]!;
        break;
      case "ArrowLeft":
      case "KeyA":
      case "KeyQ":
        key[1] = key[1]! < 0 ? 0 : key[1]!;
        break;
      case "ArrowRight":
      case "KeyD":
        key[1] = key[1]! > 0 ? 0 : key[1]!;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        key[2] = 0;
        break;
    }
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    const delta = clock.getDelta();

    updateCharacter(delta);

    renderer.render(scene, camera);
  }

  return (
    <div
      id="root"
      style={{ position: "relative", width: "100%", height: "100%" }}
    ></div>
  );
}
