precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uTexture;
varying vec2 vUv;
varying vec2 vScreenPosition;

#define PI 3.1415926535897932384626433832795

vec3 obj_pos = vec3(0.0, 0.0, -10.0);
float obj_size = 5.0; // если выбираете способ 1, параметры сферы могут остаться как есть

float sphere(vec3 dir, vec3 center, float radius) {
    vec3 rp = -center;
    float b = dot(rp, dir);
    float dist = b * b - (dot(rp, rp) - radius * radius);
    if(dist <= 0.0) return -1.0;
    return -b - sqrt(dist);
}

float somestep(float t) {
    return pow(t, 4.0);
}

vec3 getFishEye(vec2 uv, float level) {
    float len = length(uv);
    float a = len * level;
    return vec3(uv / len * sin(a), -cos(a));
}

vec3 textureAVG(sampler2D tex, vec3 tc) {
    const float diff0 = 0.35;
    const float diff1 = 0.12;
    vec2 flippedCoord = vec2(tc.x, 1.0 - tc.y);
    vec3 s0 = texture2D(tex, flippedCoord).xyz;
    vec3 s1 = texture2D(tex, (vec2(flippedCoord.x + diff0, flippedCoord.y))).xyz;
    vec3 s2 = texture2D(tex, (vec2(flippedCoord.x - diff0, flippedCoord.y))).xyz;
    vec3 s3 = texture2D(tex, (vec2(flippedCoord.x - diff0, flippedCoord.y + diff0))).xyz;
    vec3 s4 = texture2D(tex, (vec2(flippedCoord.x + diff0, flippedCoord.y - diff0))).xyz;
    
    vec3 s5 = texture2D(tex, (vec2(flippedCoord.x + diff1, flippedCoord.y))).xyz;
    vec3 s6 = texture2D(tex, (vec2(flippedCoord.x - diff1, flippedCoord.y))).xyz;
    vec3 s7 = texture2D(tex, (vec2(flippedCoord.x - diff1, flippedCoord.y + diff1))).xyz;
    vec3 s8 = texture2D(tex, (vec2(flippedCoord.x + diff1, flippedCoord.y - diff1))).xyz;
    
    return (s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8) * 0.111111111;
}

vec3 textureBlured(sampler2D tex, vec3 tc) {
    vec3 r = textureAVG(tex, vec3(1.0, 0.0, 0.0));
    vec3 t = textureAVG(tex, vec3(0.0, 1.0, 0.0));
    vec3 f = textureAVG(tex, vec3(0.0, 0.0, 1.0));
    vec3 l = textureAVG(tex, vec3(-1.0, 0.0, 0.0));
    vec3 b = textureAVG(tex, vec3(0.0, -1.0, 0.0));
    vec3 a = textureAVG(tex, vec3(0.0, 0.0, -1.0));
    
    float kr = dot(tc, vec3(1.0, 0.0, 0.0)) * 0.5 + 0.5;
    float kt = dot(tc, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
    float kf = dot(tc, vec3(0.0, 0.0, 1.0)) * 0.5 + 0.5;
    float kl = 1.0 - kr;
    float kb = 1.0 - kt;
    float ka = 1.0 - kf;
    
    kr = somestep(kr);
    kt = somestep(kt);
    kf = somestep(kf);
    kl = somestep(kl);
    kb = somestep(kb);
    ka = somestep(ka);
    
    float d;
    vec3 ret;
    ret = f * kf; d = kf;
    ret += a * ka; d += ka;
    ret += l * kl; d += kl;
    ret += r * kr; d += kr;
    ret += t * kt; d += kt;
    ret += b * kb; d += kb;
    
    return ret / d;
}

float phong(vec3 l, vec3 e, vec3 n, float power) {
    float nrm = (power + 8.0) / (PI * 8.0);
    return pow(max(dot(l, reflect(e, n)), 0.0), power) * nrm;
}

float G1V(float dotNV, float k) {
    return 1.0 / (dotNV * (1.0 - k) + k);
}

float GGX(vec3 N, vec3 V, vec3 L, float roughness, float F0) {
    float alpha = roughness * roughness;
    vec3 H = normalize(V + L);
    
    float dotNL = clamp(dot(N, L), 0.0, 1.0);
    float dotNV = clamp(dot(N, V), 0.0, 1.0);
    float dotNH = clamp(dot(N, H), 0.0, 1.0);
    float dotLH = clamp(dot(L, H), 0.0, 1.0);
    
    float alphaSqr = alpha * alpha;
    float denom = dotNH * dotNH * (alphaSqr - 1.0) + 1.0;
    float D = alphaSqr / (PI * denom * denom);
    
    float dotLH5 = pow(1.0 - dotLH, 5.0);
    float F = F0 + (1.0 - F0) * dotLH5;
    
    float k = alpha / 2.0;
    float vis = G1V(dotNL, k) * G1V(dotNV, k);
    
    return D * F * vis;
}

vec3 getColor(vec3 ray) {
    vec2 baseUV = ray.xy;
    baseUV = (baseUV + 1.0) * 0.5;
    baseUV.y = 1.0 - baseUV.y;
    
    vec3 baseColor = texture2D(uTexture, baseUV).xyz;
    
    // Отключаем расчёт эффектов сферы – возвращаем базовый цвет текстуры.
    return baseColor;
}

void main() {
    vec2 uv = vScreenPosition.xy;
    
    // Корректируем соотношение сторон для полного заполнения экрана
    float aspect = uResolution.x / uResolution.y;
    uv.x *= aspect;
    
    // Применяем эффект рыбьего глаза
    vec3 dir = getFishEye(uv, 0.8);
    
    float c = cos(uTime);
    float s = sin(uTime);
    dir.xz = vec2(dir.x * c - dir.z * s, dir.x * s + dir.z * c);
    obj_pos.xz = vec2(obj_pos.x * c - obj_pos.z * s, obj_pos.x * s + obj_pos.z * c);
    
    // Уменьшаем виньетирование
    float fish_eye = smoothstep(2.0, 1.6, length(uv)) * 0.15 + 0.85;
    gl_FragColor = vec4(getColor(dir) * fish_eye, 1.0);
}