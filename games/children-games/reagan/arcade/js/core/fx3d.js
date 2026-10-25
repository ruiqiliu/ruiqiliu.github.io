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
    layer,          // DOM 飘字层；视图可往里挂自己的常驻提示条（随舞台一起拆除）
    /** 与 fx.js 同签名；kind='stud' 时粒子用小圆柱（乐高金粒的样子） */
    burst(x, y, colors, n = 12, s = 1, kind) {
      if (parts.length > 160) return;
      const cols = Array.isArray(colors) ? colors : [colors];
      for (let i = 0; i < n; i++) {
        const geo = kind === 'stud'
          ? new T.CylinderGeometry(5 * s, 5 * s, 8 * s, 10)
          : new T.BoxGeometry(7 * s, 7 * s, 7 * s);
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
    text(x, y, str, color = '#ffffff', size = 20, dur = 1000) {
      const [wx, wy, wz] = toWorld(x, y, 0);
      // 用相机把 3D 点投到屏幕：正面视角和平躺棋盘（还带旋转）都落在正确的位置
      const v = new T.Vector3(wx, wy, wz).project(stage.camera);
      const sp = document.createElement('span');
      sp.textContent = str;
      sp.style.cssText =
        `left:${((v.x * 0.5 + 0.5) * 100).toFixed(1)}%;top:${((-v.y * 0.5 + 0.5) * 100).toFixed(1)}%;` +
        `color:${color};font-size:${size}px;transform:translate(-50%,-50%);`;
      layer.appendChild(sp);
      setTimeout(() => sp.remove(), dur);
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

/** 3D 舞台被拆除时调用：把当前 fx3d 置空，逻辑层的 FX 调用回落到 2D 特效 */
export function disposeCurrent3DFX() {
  if (fx) fx.dispose();
}
