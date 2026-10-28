/*
 * **Le creux du sachet, en WebGL2** (#283) — le seul rendu qui déforme vraiment un film photographié.
 *
 * Trois rendus ont été comparés dans le prototype : des dégradés CSS (plats), des filtres SVG
 * (surexposés, et calculés sur le processeur par WebKit — bugs 287982, 263848) et ce shader. C'est
 * lui qui est retenu, et il est **facultatif** : `creerCreux` rend `null` quand WebGL2 manque, et
 * l'écran se passe alors du creux plutôt que de casser.
 *
 * Ce fichier ne connaît ni React ni le DOM de l'écran : un canevas, une texture, un dessin. C'est
 * ce qui permet de le remplacer par un repli sans toucher à la machine d'états.
 */

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
uniform sampler2D u_masque;
uniform vec2 u_p;
uniform float u_c;
uniform float u_aspect;
uniform vec4 u_m1;
uniform vec4 u_m2;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float hauteur(vec2 uv) {
  vec2 d = (uv - u_p) * vec2(u_aspect, 1.0);
  float a0 = u_m2.z * 6.28318;
  vec2 dr = vec2(cos(a0) * d.x + sin(a0) * d.y, -sin(a0) * d.x + cos(a0) * d.y);
  dr.x *= 0.7 + 0.6 * u_m2.w;
  float r = length(dr);
  float s = 0.046 + 0.022 * u_m2.w;
  float profondeur = 0.75 + 0.5 * u_m1.x;
  float creux = -u_c * 0.16 * profondeur * exp(-r * r / (2.0 * s * s));
  // Les plis : un bruit pris sur le cercle (sans couture), à fréquence et phase tirées à l'appui.
  vec2 u = dr / max(r, 0.0001);
  float lobes = bruit(u * (1.4 + 0.9 * u_m1.y) + u_m1.xy * 17.0) * 2.0 - 1.0;
  float fins = bruit(u * (3.0 + 3.0 * u_m1.z) + vec2(u_m1.w, u_m2.x) * 23.0) * 2.0 - 1.0;
  float menus = bruit(u * 8.0 + u_m2.xy * 31.0) * 2.0 - 1.0;
  float pli = 0.55 * lobes + 0.3 * fins + 0.1 * menus;
  float portee = s * (0.55 + 1.0 * bruit(u * 1.3 + u_m2.zw * 13.0));
  float etoile = u_c * 0.0038 * pli * smoothstep(0.0, 0.04, r) * exp(-r * r / (2.0 * portee * portee * 2.4));
  // Le sachet seul : hors de son contour, rien ne bouge. Et près des soudures, le film travaille plus.
  float masque = texture(u_masque, uv).r;
  float bord = 1.0 - smoothstep(0.0, 0.55, texture(u_masque, uv).g);
  return (creux + etoile) * masque * (0.55 + 1.15 * bord);
}

void main() {
  vec2 e = vec2(1.0 / 315.0, 1.0 / 560.0);
  float hx = hauteur(v_uv + vec2(e.x, 0.0)) - hauteur(v_uv - vec2(e.x, 0.0));
  float hy = hauteur(v_uv + vec2(0.0, e.y)) - hauteur(v_uv - vec2(0.0, e.y));
  // L'axe vertical descend : la lumière vient d'en haut, donc L.y est négatif.
  vec3 n = normalize(vec3(-hx / (2.0 * e.x) * 2.2, -hy / (2.0 * e.y) * 2.2, 1.0));
  vec3 L = normalize(vec3(-0.5, -0.62, 0.62));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 90.0);
  float diff = dot(n, L);
  float dedans = texture(u_masque, v_uv).r;
  // Le film est tiré vers le doigt : tout le sachet glisse, pas seulement la surface.
  vec2 versLeDoigt = (u_p - v_uv) * u_c * 0.022 * dedans;
  vec3 base = texture(u_tex, v_uv + versLeDoigt + n.xy * 0.010).rgb;
  float env = smoothstep(-0.4, 0.7, -n.y * 1.0 - n.x * 0.35);
  vec3 col = base * (0.92 + 0.14 * diff);
  vec2 d0 = (v_uv - u_p) * vec2(u_aspect, 1.0);
  float r0 = length(d0);
  float s0 = 0.046 + 0.022 * u_m2.w;
  col *= 1.0 - 0.62 * exp(-r0 * r0 / (2.0 * (s0 * 0.95) * (s0 * 0.95))) * clamp(u_c, 0.0, 1.0);
  col *= 1.0 - 0.22 * clamp(-diff, 0.0, 1.0);
  col += mix(vec3(0.34, 0.40, 0.52), vec3(1.0), env) * (1.0 - n.z) * 0.30;
  col += spec * vec3(0.92, 0.97, 1.0) * (0.12 + 0.30 * clamp(u_c, 0.0, 1.0));
  // L'anneau du bord, cassé par le bruit : un cercle parfait ne ressemble à aucun pli.
  float anneau = exp(-pow((r0 - s0 * 1.25) / (s0 * 0.62), 2.0));
  float accroc = 0.45 + 0.85 * bruit(vec2(atan(d0.y, d0.x) * 1.8, u_m1.y * 11.0));
  col += anneau * accroc * u_c * 0.13 * vec3(0.95, 0.97, 1.0);
  o = vec4(col, 1.0);
}`;

export interface Motif {
  readonly valeurs: Float32Array;
  renouveler(graine: number): void;
}

export interface Creux {
  dessiner(px: number, py: number, enfoncement: number, motif: Motif): void;
  /** Le canevas suit la taille CSS de la zone, avec un DPR plafonné à 2. */
  redimensionner(largeur: number, hauteur: number): void;
  detruire(): void;
}

function compiler(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader a échoué');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
}

function charger(url: string): Promise<TexImageSource> {
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resoudre(image);
    image.onerror = () => rejeter(new Error(`image illisible : ${url}`));
    image.src = url;
  });
}

/**
 * Prépare le rendu. Rend `null` — et l'écran s'en passe — quand WebGL2 manque, quand une image
 * ne charge pas, ou quand le contexte est perdu : un creux n'est jamais une condition de lecture.
 */
export async function creerCreux(
  canvas: HTMLCanvasElement,
  textures: { film: string; masque: string }
): Promise<Creux | null> {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  try {
    const [film, masque] = await Promise.all([charger(textures.film), charger(textures.masque)]);
    const programme = gl.createProgram();
    gl.attachShader(programme, compiler(gl, gl.VERTEX_SHADER, SOMMET));
    gl.attachShader(programme, compiler(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(programme);
    if (!gl.getProgramParameter(programme, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(programme) ?? 'link');
    gl.useProgram(programme);

    const tampon = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const attribut = gl.getAttribLocation(programme, 'a');
    gl.enableVertexAttribArray(attribut);
    gl.vertexAttribPointer(attribut, 2, gl.FLOAT, false, 0, 0);

    const poser = (unite: number, source: TexImageSource): void => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unite);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    poser(0, film);
    poser(1, masque);
    gl.uniform1i(gl.getUniformLocation(programme, 'u_tex'), 0);
    gl.uniform1i(gl.getUniformLocation(programme, 'u_masque'), 1);
    gl.uniform1f(gl.getUniformLocation(programme, 'u_aspect'), 315 / 560);

    const uP = gl.getUniformLocation(programme, 'u_p');
    const uC = gl.getUniformLocation(programme, 'u_c');
    const uM1 = gl.getUniformLocation(programme, 'u_m1');
    const uM2 = gl.getUniformLocation(programme, 'u_m2');

    let detruit = false;
    const perdre = (): void => {
      detruit = true;
    };
    canvas.addEventListener('webglcontextlost', perdre);

    return {
      redimensionner(largeur: number, hauteur: number): void {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(largeur * dpr));
        canvas.height = Math.max(1, Math.round(hauteur * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      dessiner(px: number, py: number, enfoncement: number, motif: Motif): void {
        if (detruit) return;
        const m = motif.valeurs;
        gl.uniform2f(uP, px, py);
        gl.uniform1f(uC, enfoncement);
        gl.uniform4f(uM1, m[0], m[1], m[2], m[3]);
        gl.uniform4f(uM2, m[4], m[5], m[6], m[7]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      detruire(): void {
        detruit = true;
        canvas.removeEventListener('webglcontextlost', perdre);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  } catch {
    return null;
  }
}

/** Le motif d'un appui : huit nombres tirés d'une graine, pour que deux appuis ne se ressemblent pas. */
export function creerMotif(graine = Math.floor(Math.random() * 1_000_000_000)): Motif {
  const valeurs = new Float32Array(8);
  const tirer = (g: number): void => {
    let a = g >>> 0;
    for (let i = 0; i < valeurs.length; i += 1) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      valeurs[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  };
  tirer(graine);
  return {
    valeurs,
    renouveler(g: number): void {
      tirer(g);
    }
  };
}
