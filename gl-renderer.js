'use strict';

// Paints the depth-sorted fighter polygons with plain WebGL into an offscreen canvas, which the
// arena then draws into its 2D canvas at the same point in the frame where the Canvas 2D painter
// would fill them. Backdrop, shadows and effects stay on Canvas 2D, so layering is unchanged.
//
// Canvas 2D fills each polygon with the nonzero winding rule. A polygon whose fan triangles from
// its first vertex all turn the same way fills exactly the same pixels as that fan, so those (all
// triangles and convex quads, nearly every face) go into one big triangle batch. Any other polygon
// (concave or self-crossing) is filled with the stencil buffer: its fan adds +1/-1 winding per
// pixel, then a cover quad paints wherever the winding is nonzero and clears the stencil again.
// GPUs keep primitive order, so painting in list order preserves the painter's sort.
const ArenaGL = (() => {
  const vertexSource = `
    attribute vec2 position;
    attribute vec4 color;
    uniform vec2 size;
    varying vec4 tint;
    void main() {
      tint = color;
      gl_Position = vec4(position.x / size.x * 2.0 - 1.0, 1.0 - position.y / size.y * 2.0, 0.0, 1.0);
    }`;
  const fragmentSource = `
    precision mediump float;
    varying vec4 tint;
    void main() { gl_FragColor = tint; }`;
  const STRIDE = 12; // x, y as float32 + rgba as uint8

  function create() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, stencil: true,
      depth: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const sizeUniform = gl.getUniformLocation(program, 'size');
    const position = gl.getAttribLocation(program, 'position');
    const color = gl.getAttribLocation(program, 'color');
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(color, 4, gl.UNSIGNED_BYTE, true, STRIDE, 8);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clearStencil(0);

    let lost = false;
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; });

    let bytes = new ArrayBuffer(STRIDE * 4096);
    let floats = new Float32Array(bytes);
    let colors = new Uint8Array(bytes);
    let used = 0; // vertices written this frame
    let capacity = 0; // vertices the GPU buffer can hold
    const runs = []; // [kind, first, count, coverFirst]

    function reserve(vertices) {
      if ((used + vertices) * STRIDE <= bytes.byteLength) return;
      const grown = new ArrayBuffer(Math.max(bytes.byteLength * 2, (used + vertices) * STRIDE));
      new Uint8Array(grown).set(new Uint8Array(bytes, 0, used * STRIDE));
      bytes = grown;
      floats = new Float32Array(bytes);
      colors = new Uint8Array(bytes);
    }

    function vertex(x, y, r, g, b) {
      const f = used * 3;
      floats[f] = x;
      floats[f + 1] = y;
      const c = f * 4 + 8;
      colors[c] = r;
      colors[c + 1] = g;
      colors[c + 2] = b;
      colors[c + 3] = 255;
      used++;
    }

    function fan(points, r, g, b) {
      const [x0, y0] = points[0];
      for (let i = 1; i < points.length - 1; i++) {
        vertex(x0, y0, r, g, b);
        vertex(points[i][0], points[i][1], r, g, b);
        vertex(points[i + 1][0], points[i + 1][1], r, g, b);
      }
    }

    // True when every fan triangle from the first vertex has the same orientation (or is empty),
    // so the fan's union is exactly the nonzero-rule fill.
    function fanMatchesFill(points) {
      if (points.length <= 3) return true;
      const [x0, y0] = points[0];
      let sign = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const cross = (points[i][0] - x0) * (points[i + 1][1] - y0) - (points[i][1] - y0) * (points[i + 1][0] - x0);
        if (cross > 1e-6) {
          if (sign < 0) return false;
          sign = 1;
        } else if (cross < -1e-6) {
          if (sign > 0) return false;
          sign = -1;
        }
      }
      return true;
    }

    function paint(faces, cssWidth, cssHeight, pixelWidth, pixelHeight) {
      if (lost || gl.isContextLost()) return false;
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      used = 0;
      runs.length = 0;
      let batchStart = 0;
      let complex = 0;
      for (const face of faces) {
        const points = face.projected;
        const n = points.length;
        if (n < 3) continue;
        const [r, g, b] = face.rgb;
        if (fanMatchesFill(points)) {
          reserve((n - 2) * 3);
          fan(points, r, g, b);
          continue;
        }
        if (used > batchStart) runs.push(0, batchStart, used - batchStart, 0);
        reserve((n - 2) * 3 + 6);
        const first = used;
        fan(points, r, g, b);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of points) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        const cover = used;
        vertex(minX, minY, r, g, b); vertex(maxX, minY, r, g, b); vertex(maxX, maxY, r, g, b);
        vertex(minX, minY, r, g, b); vertex(maxX, maxY, r, g, b); vertex(minX, maxY, r, g, b);
        runs.push(1, first, cover - first, cover);
        batchStart = used;
        complex++;
      }
      if (used > batchStart) runs.push(0, batchStart, used - batchStart, 0);

      gl.viewport(0, 0, pixelWidth, pixelHeight);
      gl.uniform2f(sizeUniform, cssWidth, cssHeight);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      if (used > capacity) {
        capacity = Math.max(used, capacity * 2);
        gl.bufferData(gl.ARRAY_BUFFER, capacity * STRIDE, gl.DYNAMIC_DRAW);
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Uint8Array(bytes, 0, used * STRIDE));
      for (let i = 0; i < runs.length; i += 4) {
        const [kind, first, count, cover] = [runs[i], runs[i + 1], runs[i + 2], runs[i + 3]];
        if (!kind) {
          gl.drawArrays(gl.TRIANGLES, first, count);
          continue;
        }
        // Winding pass: front-facing fan triangles add one, back-facing ones subtract one.
        gl.enable(gl.STENCIL_TEST);
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.ALWAYS, 0, 0xff);
        gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
        gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
        gl.drawArrays(gl.TRIANGLES, first, count);
        // Cover pass: paint where the winding is nonzero and reset the stencil there.
        gl.colorMask(true, true, true, true);
        gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
        gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
        gl.drawArrays(gl.TRIANGLES, cover, 6);
        gl.disable(gl.STENCIL_TEST);
      }
      paint.complex = complex;
      return true;
    }

    return { canvas, paint, get lost() { return lost || gl.isContextLost(); } };
  }

  return {
    create() {
      try {
        return create();
      } catch (error) {
        console.warn('WebGL renderer unavailable:', error);
        return null;
      }
    }
  };
})();
