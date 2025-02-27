// Шейдеры встроены в скрипт
const VERTEX_SHADER = `
attribute vec4 aPosition;
attribute vec2 aTexCoord;
varying vec2 vUv;
varying vec2 vScreenPosition;

void main() {
    gl_Position = aPosition;
    vUv = aTexCoord;
    vScreenPosition = aPosition.xy;
}`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uTexture;
varying vec2 vUv;
varying vec2 vScreenPosition;

#define PI 3.1415926535897932384626433832795

vec3 obj_pos = vec3(0.0, 0.0, -10.0);
float obj_size = 5.0;

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
}`;

class CircularGallery {
    constructor(canvas, defaultImageUrl) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        this.currentImage = null;
        this.defaultImageUrl = defaultImageUrl || null;
        this.initWebGL();
        this.loadImage();
    }

    updateImage(newImage) {
        this.currentImage = newImage;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, newImage);
    }

    async loadImage() {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Важно для загрузки изображений с других доменов
        
        // Используем URL изображения из параметров или из атрибута data-default-image
        const imageUrl = this.defaultImageUrl || this.canvas.getAttribute('data-default-image');
        
        if (!imageUrl) {
            console.error('No default image URL provided');
            return;
        }
        
        img.src = imageUrl;
        
        await new Promise(resolve => {
            img.onload = () => {
                this.currentImage = img;
                resolve();
            };
            img.onerror = () => {
                console.error('Failed to load image:', imageUrl);
                resolve();
            };
        });

        if (this.currentImage) {
            // Start animation once image is loaded
            this.startTime = performance.now();
            this.animate();
        }
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    initWebGL() {
        // Create shaders using the embedded shader code
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, VERTEX_SHADER);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

        // Create program
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(this.program));
            return;
        }

        // Create buffers
        const positions = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1,
        ]);

        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 0,
        ]);

        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);

        // Get attribute locations
        this.positionLocation = this.gl.getAttribLocation(this.program, 'aPosition');
        this.texCoordLocation = this.gl.getAttribLocation(this.program, 'aTexCoord');

        // Get uniform locations
        this.timeLocation = this.gl.getUniformLocation(this.program, 'uTime');
        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'uResolution');

        // Create and set up texture
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    resizeCanvas() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        }
    }

    render(time) {
        this.resizeCanvas();

        // Clear canvas
        this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (!this.currentImage) return;

        // Use shader program
        this.gl.useProgram(this.program);

        // Set uniforms
        this.gl.uniform1f(this.timeLocation, (time - this.startTime) / 1000);
        this.gl.uniform2f(this.resolutionLocation, this.gl.canvas.width, this.gl.canvas.height);

        // Set up position attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Set up texCoord attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        // Update texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.currentImage);

        // Draw
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    animate(time) {
        this.render(time);
        requestAnimationFrame(this.animate.bind(this));
    }
}

class GalleryController {
    constructor(galleryInstance) {
        this.gallery = galleryInstance;
        this.isExpanded = true;
        this.createUI();
    }

    createUI() {
        // Создаем основной контейнер
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            border-radius: 12px;
            color: #37352F;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            z-index: 1000;
            box-shadow: rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, 
                        rgba(15, 15, 15, 0.1) 0px 3px 6px, 
                        rgba(15, 15, 15, 0.2) 0px 9px 24px;
            transition: all 0.3s ease;
            min-width: 260px;
        `;

        // Создаем заголовок
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${this.isExpanded ? '15px' : '0'};
            cursor: pointer;
            user-select: none;
            transition: margin 0.3s ease;
        `;

        const title = document.createElement('div');
        title.style.cssText = `
            font-weight: 500;
            font-size: 14px;
            color: #37352F;
        `;
        title.textContent = 'Image Controls';

        const toggleButton = document.createElement('div');
        toggleButton.style.cssText = `
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            color: #37352F;
            transition: all 0.3s ease;
            font-size: 16px;
            font-weight: 400;
            line-height: 1;
        `;
        toggleButton.innerHTML = '−';

        toggleButton.addEventListener('mouseover', () => {
            toggleButton.style.background = 'rgba(55, 53, 47, 0.08)';
        });
        toggleButton.addEventListener('mouseout', () => {
            toggleButton.style.background = 'transparent';
        });

        // Контейнер для содержимого
        const content = document.createElement('div');
        content.style.cssText = `
            transition: all 0.3s ease;
            overflow: hidden;
            opacity: 1;
        `;

        // Создаем зону для дропа файлов
        const dropZone = document.createElement('div');
        dropZone.style.cssText = `
            border: 2px dashed rgba(55, 53, 47, 0.2);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin-bottom: 15px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        dropZone.innerHTML = '<div style="font-size: 24px; margin-bottom: 10px;">📁</div>Drop image here<br>or click to upload';

        // Создаем кнопку Reset
        const resetButton = document.createElement('button');
        resetButton.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: transparent;
            border: 1px solid rgba(55, 53, 47, 0.2);
            border-radius: 4px;
            color: #37352F;
            font-family: inherit;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        `;
        resetButton.innerHTML = '↺ Reset to Default';
        
        resetButton.addEventListener('mouseover', () => {
            resetButton.style.background = 'rgba(55, 53, 47, 0.08)';
        });
        resetButton.addEventListener('mouseout', () => {
            resetButton.style.background = 'transparent';
        });
        resetButton.addEventListener('click', () => {
            const defaultImg = new Image();
            defaultImg.crossOrigin = "anonymous";
            defaultImg.onload = () => {
                this.gallery.updateImage(defaultImg);
            };
            // Используем URL изображения из атрибута data-default-image
            const defaultImageUrl = this.gallery.canvas.getAttribute('data-default-image');
            if (defaultImageUrl) {
                defaultImg.src = defaultImageUrl;
            }
        });

        // Эффекты при наведении на зону дропа
        dropZone.addEventListener('mouseover', () => {
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.4)';
            dropZone.style.background = 'rgba(55, 53, 47, 0.03)';
        });
        dropZone.addEventListener('mouseout', () => {
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.2)';
            dropZone.style.background = 'transparent';
        });

        // Создаем скрытый input для файла
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        // Обработчики для drag & drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.6)';
            dropZone.style.background = 'rgba(55, 53, 47, 0.06)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.2)';
            dropZone.style.background = 'transparent';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFile(file);
            }
            dropZone.style.borderColor = 'rgba(55, 53, 47, 0.2)';
            dropZone.style.background = 'transparent';
        });

        // Обработчик клика по зоне дропа
        dropZone.addEventListener('click', () => fileInput.click());

        // Обработчик выбора файла
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFile(file);
            }
        });

        // Обработчик сворачивания/разворачивания
        header.addEventListener('click', () => {
            this.isExpanded = !this.isExpanded;
            content.style.height = this.isExpanded ? content.scrollHeight + 'px' : '0';
            content.style.opacity = this.isExpanded ? '1' : '0';
            content.style.marginTop = this.isExpanded ? '0' : '-10px';
            header.style.marginBottom = this.isExpanded ? '15px' : '0';
            toggleButton.innerHTML = this.isExpanded ? '−' : '+';
        });

        // Собираем UI
        header.appendChild(title);
        header.appendChild(toggleButton);
        content.appendChild(dropZone);
        content.appendChild(resetButton);
        content.appendChild(fileInput);
        container.appendChild(header);
        container.appendChild(content);
        document.body.appendChild(container);

        // Устанавливаем начальную высоту контента
        requestAnimationFrame(() => {
            content.style.height = content.scrollHeight + 'px';
        });
    }

    handleFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.gallery.updateImage(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    // Находим все canvas с атрибутом data-gallery="container"
    const canvases = document.querySelectorAll('canvas[data-gallery="container"]');
    
    canvases.forEach(canvas => {
        const gallery = new CircularGallery(canvas);
        
        // Проверяем, нужно ли создавать контроллер (по умолчанию скрыты)
        const showControls = canvas.getAttribute('data-show-controls') === 'true';
        if (showControls) {
            new GalleryController(gallery);
        }
    });
}); 