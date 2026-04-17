import { useEffect, useRef } from "react";
import * as THREE from "three";

const auraColors = {
  0: 0x5eead4,
  1: 0xfacc15,
  2: 0x38bdf8,
  3: 0xf472b6
};

export default function Arena({ players, status }) {
  const hostRef = useRef(null);
  const refs = useRef({ meshes: new Map() });

  useEffect(() => {
    const host = hostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101113);
    const camera = new THREE.PerspectiveCamera(52, host.clientWidth / host.clientHeight, 0.1, 120);
    camera.position.set(0, 28, 32);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(10, 22, 8);
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(19.5, 72),
      new THREE.MeshStandardMaterial({ color: 0x202327, roughness: 0.88, metalness: 0.02 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(19.5, 0.08, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xd6f35f })
    );
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    let frame = 0;
    const clock = new THREE.Clock();
    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener("resize", resize);
    function animate() {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      for (const group of refs.current.meshes.values()) {
        group.rotation.y += 0.01;
        const aura = group.children.find((child) => child.name === "aura");
        if (aura) {
          aura.scale.setScalar(1 + Math.sin(t * 5) * 0.04);
          aura.material.opacity = 0.16 + Math.sin(t * 4) * 0.04;
        }
      }
      renderer.render(scene, camera);
    }
    refs.current.scene = scene;
    refs.current.renderer = renderer;
    animate();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const { scene, meshes } = refs.current;
    if (!scene) return;
    const activeIds = new Set(players.map((player) => player.id));
    for (const [id, group] of meshes) {
      if (!activeIds.has(id)) {
        scene.remove(group);
        disposeGroup(group);
        meshes.delete(id);
      }
    }
    for (const player of players) {
      let group = meshes.get(player.id);
      if (!group) {
        group = createPlayerGroup(player);
        meshes.set(player.id, group);
        scene.add(group);
      }
      group.userData.targetX = player.x;
      group.userData.targetZ = player.z;
      group.position.x += (player.x - group.position.x) * 0.22;
      group.position.z += (player.z - group.position.z) * 0.22;
      group.scale.setScalar(player.scale);
      const aura = group.children.find((child) => child.name === "aura");
      aura.visible = player.aura > 0;
      aura.material.color.setHex(auraColors[player.aura] ?? auraColors[0]);
    }
  }, [players]);

  return (
    <div className="arena" ref={hostRef}>
      <div className="arena-status">{status}</div>
    </div>
  );
}

function createPlayerGroup(player) {
  const group = new THREE.Group();
  group.position.set(player.x, 0, player.z);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.76, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0xe6f2ff, roughness: 0.55 })
  );
  body.position.y = 0.9;
  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.38, 1),
    new THREE.MeshStandardMaterial({ color: 0x9ae6b4, roughness: 0.6 })
  );
  head.position.y = 1.62;
  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.045, 8, 28),
    new THREE.MeshBasicMaterial({ color: auraColors[player.aura], transparent: true, opacity: 0.18 })
  );
  aura.name = "aura";
  aura.position.y = 0.1;
  aura.rotation.x = Math.PI / 2;
  aura.visible = player.aura > 0;
  group.add(body, head, aura);
  return group;
}

function disposeGroup(group) {
  group.traverse((child) => {
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  });
}
