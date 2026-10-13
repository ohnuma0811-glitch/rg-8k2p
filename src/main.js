// M1 Task 1: 空と地面だけを描く（Task 5 で置き換える）
import * as THREE from 'three';
import { startLoop } from './loop.js';

const canvas = document.getElementById('game');
const rotate = document.getElementById('rotate');
const renderer = new THREE.WebGLRenderer({ canvas });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.add(new THREE.HemisphereLight(0xffffff, 0x557744, 2));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x5fae4b }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 2000);
camera.position.set(0, 3.5, 8);
camera.lookAt(0, 1, 0);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  rotate.classList.toggle('show', h > w);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
startLoop({ update() {}, render() { renderer.render(scene, camera); } });
