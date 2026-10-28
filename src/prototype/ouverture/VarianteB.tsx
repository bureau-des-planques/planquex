/* PROTOTYPE JETABLE (#283) — variante B : un shader WebGL2. Le relief et le reflet se calculent par pixel. */
import { useEffect, useRef, useState } from 'react';
import type { Pression } from './pression';
import { HAUTEUR, LARGEUR, preparerTexture } from './base';

interface Props {
  pression: Pression;
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
uniform vec4 u_m1;
uniform vec4 u_m2;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float hauteur(vec2 uv) {
  vec2 d = (uv - u_p) * vec2(u_aspect, 1.0);
  // Le creux n'est pas rond : tourné d'un angle tiré à l'appui et étiré d'un rapport tiré aussi.
  float a0 = u_m2.z * 6.28318;
  vec2 dr = vec2(cos(a0) * d.x + sin(a0) * d.y, -sin(a0) * d.x + cos(a0) * d.y);
  dr.x *= mix(1.0, 0.7 + 0.6 * u_m2.w, u_radial);
  float r = length(dr);
  float s = mix(0.17, 0.046 + 0.022 * u_m2.w, u_radial);
  float profondeur = mix(1.0, 0.75 + 0.5 * u_m1.x, u_radial);
  float creux = -u_c * mix(0.075, 0.135, u_radial) * profondeur * exp(-r * r / (2.0 * s * s));
  float anneaux = (1.0 - u_radial) * u_c * 0.0035 * sin(r * 95.0) * exp(-r * r / (2.0 * s * s * 1.4));
  // Les plis : un bruit pris sur le cercle (sans couture). Peu de branches, et chaque appui a
  // sa fréquence, sa phase, son ampleur et sa portée — deux appuis ne se ressemblent pas.
  vec2 u = dr / max(r, 0.0001);
  float lobes = bruit(u * (1.4 + 0.9 * u_m1.y) + u_m1.xy * 17.0) * 2.0 - 1.0;
  float fins = bruit(u * (3.0 + 3.0 * u_m1.z) + vec2(u_m1.w, u_m2.x) * 23.0) * 2.0 - 1.0;
  float menus = bruit(u * 8.0 + u_m2.xy * 31.0) * 2.0 - 1.0;
  float pli = 0.55 * lobes + 0.3 * fins + 0.1 * menus;
  float portee = s * (0.55 + 1.0 * bruit(u * 1.3 + u_m2.zw * 13.0));
  // Le second creux, ailleurs, casse la symétrie de l'étoile.
  vec2 d2 = d - (u_m2.xy - 0.5) * 0.22;
  float r2 = length(d2);
  float pince = -u_c * 0.02 * (0.4 + 0.6 * u_m2.z) * exp(-r2 * r2 / (2.0 * 0.035 * 0.035));
  float etoile = u_radial * u_c * 0.0038 * pli * smoothstep(0.0, 0.04, r) * exp(-r * r / (2.0 * portee * portee * 2.4));
  float plis = anneaux + etoile;
  float froisse = 0.0008 * (bruit(uv * vec2(7.0, 11.0)) + 0.5 * bruit(uv * vec2(19.0, 27.0)));
  return creux + pince + plis + froisse;
}
void main() {
  vec2 e = vec2(1.0 / 315.0, 1.0 / 560.0);
  float hx = hauteur(v_uv + vec2(e.x, 0.0)) - hauteur(v_uv - vec2(e.x, 0.0));
  float hy = hauteur(v_uv + vec2(0.0, e.y)) - hauteur(v_uv - vec2(0.0, e.y));
  // L'axe vertical de l'écran va vers le BAS : la lumière vient d'en haut, donc L.y est négatif.
  // Avant ce correctif, la lumière venait d'en bas et le creux se lisait comme une bosse.
  vec3 n = normalize(vec3(-hx / (2.0 * e.x) * 2.2, -hy / (2.0 * e.y) * 2.2, 1.0));
  vec3 L = normalize(vec3(-0.5, -0.62, 0.62));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 90.0);
  float diff = dot(n, L);
  // Le film est clair : on assombrit peu à la lumière, et le creux s'assombrit de lui-même.
  vec3 base = texture(u_tex, v_uv + n.xy * 0.010).rgb;
  float env = smoothstep(-0.4, 0.7, -n.y * 1.0 - n.x * 0.35);
  vec3 col = base * (0.92 + 0.14 * diff);
  // L'occlusion : au fond du creux la lumière manque. C'est ce qui fait lire « trou » et non « bosse ».
  vec2 d0 = (v_uv - u_p) * vec2(u_aspect, 1.0);
  float r0 = length(d0);
  float s0 = mix(0.17, 0.046 + 0.022 * u_m2.w, u_radial);
  float ao = exp(-r0 * r0 / (2.0 * (s0 * 0.95) * (s0 * 0.95)));
  col *= 1.0 - 0.62 * ao * clamp(u_c, 0.0, 1.0);
  col *= 1.0 - 0.22 * clamp(-diff, 0.0, 1.0);
  col += mix(vec3(0.34, 0.40, 0.52), vec3(1.0), env) * (1.0 - n.z) * 0.30;
  col += spec * vec3(0.92, 0.97, 1.0) * (0.14 + 0.42 * clamp(u_c, 0.0, 1.0)) * mix(1.0, 0.50, u_radial);
  // L'anneau clair du bord : c'est lui qui donne l'épaisseur du creux sur l'image E.
  float anneau = exp(-pow((r0 - s0 * 1.15) / (s0 * 0.42), 2.0));
  col += anneau * u_c * mix(0.0, 0.30, u_radial) * vec3(0.95, 0.97, 1.0);
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

export function VarianteB({ pression }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [texture, setTexture] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let vivant = true;
    preparerTexture()
      .then((c) => {
        if (vivant) setTexture(c);
      })
      .catch((e: unknown) => {
        if (vivant) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !texture) return undefined;
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

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const uP = gl.getUniformLocation(prog, 'u_p');
      const uC = gl.getUniformLocation(prog, 'u_c');
      const uR = gl.getUniformLocation(prog, 'u_radial');
      const uM1 = gl.getUniformLocation(prog, 'u_m1');
      const uM2 = gl.getUniformLocation(prog, 'u_m2');
      gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_aspect'), LARGEUR / HAUTEUR);
      gl.viewport(0, 0, canvas.width, canvas.height);

      const desabonner = pression.surveiller((e) => {
        gl.uniform2f(uP, e.px, e.py);
        gl.uniform1f(uC, e.creux);
        gl.uniform1f(uR, pression.options.radial ? 1 : 0);
        const m = pression.motif;
        gl.uniform4f(uM1, m[0], m[1], m[2], m[3]);
        gl.uniform4f(uM2, m[4], m[5], m[6], m[7]);
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
  }, [pression, texture]);

  if (erreur) return <p className="proto-ouv__erreur">{erreur}</p>;
  return <canvas ref={ref} className="vb" />;
}
