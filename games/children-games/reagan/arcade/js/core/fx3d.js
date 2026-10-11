/* =====================================================================
   core/fx3d.js — 3D 粒子特效 + 飘字
   与 core/fx.js 同一套 API（burst / text），给 3D 化的游戏用：
   - burst：world 组里生成小方块粒子，带速度 / 重力 / 淡出；
   - text：DOM 飘字（叠在 3D 画布上，清晰且零开销）。
   update/render 由 render3d 的渲染帧驱动。
   ===================================================================== */

let fx = null;

export function createFX3D(stage, toWorld) {
  const T = stage.T;
  const group = new T.Group();
  stage.scene.add(group);

  // DOM 飘字层
  const layer = document.createElement('div');
  layer.className = 'fx3d-text';
  stage.stageEl.appendChild(layer);
  if (!document.getElementById('fx3d-style')) {
    const st = document.createElement('style');
    st.id = 'fx3d-style';
    st.textContent =
      '.fx3d-text{position:absolute;inset:0;pointer-events:none;overflow:hidden}' +
      '.fx3d-text span{position:absolute;font-weight:800;text-shadow:0 2px 6px rgba(0,0,0,.4);' +
      'animation:fx3d-up 1s ease-out forwards;white-space:nowrap}' +
      '@keyframes fx3d-up{from{transform:translateY(0);opacity:1}to{transform:translateY(-46px);opacity:0}}';
    document.head.appendChild(st);
  }

  const parts = [];

  fx = {
    group,
    /** 与 fx.js 同签名 */
    burst(x, y, colors, n = 12, s = 1) {
      if (parts.length > 160) return;
      const cols = Array.isArray(colors) ? colors : [colors];
      for (let i = 0; i < n; i++) {
        const geo = new T.BoxGeometry(7 * s, 7 * s, 7 * s);
        const mat = new T.MeshBasicMaterial({
          color: cols[(Math.random() * cols.length) | 0], transparent: true
        });
        const mesh = new T.Mesh(geo, mat);
        const [wx, wy, wz] = toWorld(x, y, 60);
        mesh.position.set(wx, wy, wz);
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        parts.push({
          mesh,
          vx: (Math.random() - 0.5) * 460 * s,
          vy: (Math.random() * 0.7 + 0.3) * 480 * s,
          vz: (Math.random() - 0.5) * 260 * s,
          life: 0.55 + Math.random() * 0.4
        });
        group.add(mesh);
      }
    },
    text(x, y, str, color = '#ffffff', size = 20) {
      const [wx, wy] = toWorld(x, y, 0);
      const sp = document.createElement('span');
      sp.textContent = str;
      sp.style.cssText =
        `left:${((wx / stage.W) * 100).toFixed(1)}%;top:${((1 - wy / stage.H) * 100).toFixed(1)}%;` +
        `color:${color};font-size:${size}px;transform:translate(-50%,-50%);`;
      layer.appendChild(sp);
      setTimeout(() => sp.remove(), 1000);
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          group.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          parts.splice(i, 1);
          continue;
        }
        p.vy -= 900 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += 5 * dt;
        p.mesh.rotation.y += 7 * dt;
        p.mesh.material.opacity = Math.min(1, p.life * 2);
      }
    },
    dispose() {
      stage.scene.remove(group);
      layer.remove();
      fx = null;
    }
  };
  return fx;
}

export function currentFX3D() {
  return fx;
}
