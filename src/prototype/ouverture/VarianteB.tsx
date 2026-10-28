/* PROTOTYPE JETABLE (#283) — variante B : un shader WebGL2. Le relief et le reflet se calculent par pixel. */
import { useEffect, useRef, useState } from 'react';
import type { Pression } from './pression';
import { HAUTEUR, LARGEUR } from './base';

interface Props {
  pression: Pression;
  base: HTMLCanvasElement;
}

const SOMMET = `#version 300 es
in vec2 a;
out vec2 v_uv;
void main() {
  v_uv = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5);
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tex;
uniform vec2 u_p;
uniform float u_c;
uniform float u_aspect;
uniform float u_radial;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float hauteur(vec2 uv) {
  vec2 d = (uv - u_p) * vec2(u_aspect, 1.0);
  float r = length(d);
  float s = mix(0.17, 0.085, u_radial);
  float creux = -u_c * mix(0.075, 0.05, u_radial) * exp(-r * r / (2.0 * s * s));
  float anneaux = (1.0 - u_radial) * u_c * 0.0035 * sin(r * 95.0) * exp(-r * r / (2.0 * s * s * 1.4));
  float ang = atan(d.y, d.x);
  float etoile = u_radial * u_c * 0.0042 * cos(ang * 9.0 + 3.0 * bruit(vec2(ang * 2.0, 4.0))) * smoothstep(0.0, 0.05, r) * exp(-r * r / (2.0 * s * s * 3.0));
  float plis = anneaux + etoile;
  float froisse = 0.004 * (bruit(uv * vec2(7.0, 11.0)) + 0.5 * bruit(uv * vec2(19.0, 27.0)));
  return creux + plis + froisse;
}
void main() {
  vec2 e = vec2(1.0 / 300.0, 1.0 / 440.0);
  float hx = hauteur(v_uv + vec2(e.x, 0.0)) - hauteur(v_uv - vec2(e.x, 0.0));
  float hy = hauteur(v_uv + vec2(0.0, e.y)) - hauteur(v_uv - vec2(0.0, e.y));
  vec3 n = normalize(vec3(-hx / (2.0 * e.x) * 2.2, -hy / (2.0 * e.y) * 2.2, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 70.0);
  float diff = dot(n, L);
  vec3 base = texture(u_tex, v_uv + n.xy * 0.02).rgb;
  float env = smoothstep(-0.5, 0.6, n.x * 0.9 + n.y * 0.6);
  vec3 col = base * (0.72 + 0.35 * diff);
  col += mix(vec3(0.30, 0.36, 0.48), vec3(0.9, 0.95, 1.0), env) * (1.0 - n.z) * 1.1;
  col += spec * vec3(0.85, 0.93, 1.0) * (0.35 + 0.65 * clamp(u_c, 0.0, 1.0));
  o = vec4(col, 1.0);
}`;

function compiler(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('createShader a échoué');
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

export function VarianteB({ pression, base }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = LARGEUR * dpr;
    canvas.height = HAUTEUR * dpr;
    const gl = canvas.getContext('webgl2', { antialias: false });
    if (!gl) {
      setErreur('WebGL2 indisponible sur cet appareil');
      return undefined;
    }
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, compiler(gl, gl.VERTEX_SHADER, SOMMET));
      gl.attachShader(prog, compiler(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
      gl.useProgram(prog);

      const tampon = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, base);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const uP = gl.getUniformLocation(prog, 'u_p');
      const uC = gl.getUniformLocation(prog, 'u_c');
      const uR = gl.getUniformLocation(prog, 'u_radial');
      gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_aspect'), LARGEUR / HAUTEUR);
      gl.viewport(0, 0, canvas.width, canvas.height);

      const desabonner = pression.surveiller((e) => {
        gl.uniform2f(uP, e.px, e.py);
        gl.uniform1f(uC, e.creux);
        gl.uniform1f(uR, pression.options.radial ? 1 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
      return () => {
        desabonner();
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  }, [pression, base]);

  if (erreur) return <p className="proto-ouv__erreur">{erreur}</p>;
  return <canvas ref={ref} className="vb" />;
}
