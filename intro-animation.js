// Проверяем доступность GSAP
if (!window.gsap) {
    console.error('GSAP not found');
}

// Массив изображений для интро-анимации
const INTRO_IMAGES = [
    'assets/comimg-1-v.jpg',
    'assets/comimg-2-v.jpg',
    'assets/img4.jpg',
    'assets/img1.jpg',
    'assets/img5.jpg'
];

// Создаем свой загрузчик изображений
const introImageLoader = {
    cache: new Map(),
    
    async load(url) {
        console.log('Loading image:', url);
        if (this.cache.has(url)) {
            console.log('Image found in cache');
            return this.cache.get(url);
        }
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                console.log('Image loaded successfully:', url, 'size:', img.width, 'x', img.height);
                this.cache.set(url, img);
                resolve(img);
            };
            img.onerror = (error) => {
                console.error('Failed to load image:', url, error);
                reject(error);
            };
            img.src = url;
        });
    }
};

// Копируем шейдеры из основного скрипта
const INTRO_VERTEX_SHADER = `
attribute vec4 aPosition;
attribute vec2 aTexCoord;
varying vec2 vUv;
varying vec2 vScreenPosition;

void main() {
    gl_Position = aPosition;
    vUv = aTexCoord;
    vScreenPosition = aPosition.xy;
}`;

const INTRO_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uTexture;
uniform sampler2D uTextureNext;
uniform float uTransition;
uniform vec2 uMousePosition;
uniform float uDirection;
varying vec2 vUv;
varying vec2 vScreenPosition;

#define PI 3.1415926535897932384626433832795

vec3 getFishEye(vec2 uv, float level) {
    float len = length(uv);
    float a = len * level;
    return vec3(uv / len * sin(a), -cos(a));
}

vec3 getColor(vec3 ray, sampler2D tex) {
    vec2 baseUV = ray.xy;
    baseUV = (baseUV + 1.0) * 0.5;
    
    float containerAspect = uResolution.x / uResolution.y;
    float scale = 1.0;
    
    if (containerAspect < 1.0) {
        scale = containerAspect;
        baseUV.x = baseUV.x * scale + (1.0 - scale) * 0.5;
    } else {
        scale = 1.0 / containerAspect;
        baseUV.y = baseUV.y * scale + (1.0 - scale) * 0.5;
    }
    
    baseUV.y = 1.0 - baseUV.y;
    vec3 baseColor = texture2D(tex, baseUV).xyz;
    return baseColor;
}

void main() {
    vec2 uv = vScreenPosition.xy;
    float aspect = uResolution.x / uResolution.y;
    uv.x *= aspect;
    
    vec3 dir = getFishEye(uv, 0.8);
    
    float transitionRotation = uTransition * PI * 2.0 * uDirection;
    
    mat2 transitionRotationMatrix = mat2(
        cos(transitionRotation), -sin(transitionRotation),
        sin(transitionRotation), cos(transitionRotation)
    );
    
    dir.xz = transitionRotationMatrix * dir.xz;
    
    vec3 currentColor = getColor(dir, uTexture);
    vec3 nextColor = getColor(dir, uTextureNext);
    
    float transitionAngle = mod(abs(transitionRotation), PI * 2.0);
    float mixFactor = smoothstep(0.0, PI * 2.0, transitionAngle);
    
    vec3 color = mix(currentColor, nextColor, mixFactor);
    
    float fish_eye = smoothstep(2.0, 1.6, length(uv)) * 0.15 + 0.85;
    gl_FragColor = vec4(color * fish_eye, 1.0);
}`;

// Класс для вступительной анимации
class IntroAnimation {
    constructor() {
        console.log('Initializing IntroAnimation');
        // Создаем временный canvas
        this.canvas = document.createElement('canvas');
        
        // Получаем размеры контейнера галереи
        const galleryContainer = document.querySelector('.gallery-container');
        const containerWidth = galleryContainer ? galleryContainer.offsetWidth : window.innerWidth;
        const containerHeight = galleryContainer ? galleryContainer.offsetHeight : window.innerHeight;
        
        // Устанавливаем размеры canvas
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;
        
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: ${containerWidth}px;
            height: ${containerHeight}px;
            z-index: 10;
            background: black;
            pointer-events: none;
            opacity: 1;
            display: block;
            transform-origin: center center;
        `;
        
        // Инициализируем WebGL
        this.gl = this.canvas.getContext('webgl');
        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        // Копируем шейдеры из основного скрипта
        this.vertexShader = INTRO_VERTEX_SHADER;
        this.fragmentShader = INTRO_FRAGMENT_SHADER;
        
        // Флаг для отслеживания состояния
        this.isRunning = false;
    }

    async initialize() {
        try {
            console.log('Starting initialization');
            // Загружаем изображения для интро
            this.images = await Promise.all(
                INTRO_IMAGES.map(url => introImageLoader.load(url))
            );

            console.log('Images loaded:', this.images.length);

            // Проверяем, что все изображения загрузились
            if (this.images.some(img => !img)) {
                console.error('Some intro images failed to load');
                return false;
            }

            // Инициализируем WebGL
            this.initWebGL();
            console.log('WebGL initialized');
            
            return true;
        } catch (error) {
            console.error('Intro animation initialization error:', error);
            return false;
        }
    }

    async start() {
        console.log('Starting animation');
        if (this.isRunning) return;
        
        // Получаем контейнер галереи
        const galleryContainer = document.querySelector('.gallery-container');
        if (!galleryContainer) {
            console.error('Gallery container not found');
            return;
        }
        
        // Добавляем canvas в контейнер галереи
        galleryContainer.appendChild(this.canvas);
        
        // Устанавливаем размеры canvas
        this.canvas.width = galleryContainer.clientWidth;
        this.canvas.height = galleryContainer.clientHeight;

        // Скрываем основной слайдер
        const mainCanvas = galleryContainer.querySelector('canvas[data-gallery="container"]');
        if (mainCanvas) {
            mainCanvas.style.opacity = '0';
            mainCanvas.style.transition = 'opacity 0.5s';
        }

        this.isRunning = true;
        this.render();
        
        try {
            // Короткая пауза для первого изображения
            await new Promise(resolve => setTimeout(resolve, 300));

            // Создаем непрерывную анимацию
            this.params.transition = 0;
            
            // Быстрая анимация через все изображения
            const fastDuration = 2.5; // 2.5 секунды на все изображения
            
            // Запускаем анимацию
            await new Promise(resolve => {
                const timeline = window.gsap.timeline({
                    onComplete: resolve
                });

                // Быстрое прохождение через все изображения
                timeline.to(this.params, {
                    transition: this.images.length - 1,
                    duration: fastDuration,
                    ease: "power1.inOut",
                    onUpdate: () => {
                        const currentIndex = Math.floor(this.params.transition);
                        const nextIndex = (currentIndex + 1) % this.images.length;
                        
                        this.gl.activeTexture(this.gl.TEXTURE0);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.images[currentIndex]);
                        
                        this.gl.activeTexture(this.gl.TEXTURE1);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextTexture);
                        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.images[nextIndex]);
                    }
                });

                // Плавное возвращение к первому изображению
                timeline.to(this.params, {
                    transition: this.images.length,
                    duration: 0.8,
                    ease: "power2.inOut",
                    onUpdate: () => {
                        const lastIndex = this.images.length - 1;
                        
                        this.gl.activeTexture(this.gl.TEXTURE0);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.images[lastIndex]);
                        
                        this.gl.activeTexture(this.gl.TEXTURE1);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextTexture);
                        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.images[0]);
                    }
                });
            });

            // Показываем основной слайдер
            if (mainCanvas) {
                mainCanvas.style.opacity = '1';
            }

            // Сразу запускаем исчезновение
            await this.fadeOut();

        } catch (error) {
            console.error('Animation error:', error);
        } finally {
            // Удаляем временный canvas
            this.canvas.remove();
            this.isRunning = false;
        }
    }

    initWebGL() {
        const gl = this.gl;

        // Создаем шейдеры
        const vertexShader = this.createShader(gl.VERTEX_SHADER, this.vertexShader);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, this.fragmentShader);

        if (!vertexShader || !fragmentShader) {
            console.error('Failed to create shaders');
            return false;
        }

        // Создаем программу
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(this.program));
            return false;
        }

        gl.validateProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.VALIDATE_STATUS)) {
            console.error('Program validation error:', gl.getProgramInfoLog(this.program));
            return false;
        }

        // Проверяем, что программа успешно создана
        if (!this.program) {
            console.error('Failed to create WebGL program');
            return false;
        }

        // Используем программу
        gl.useProgram(this.program);

        // Создаем буферы
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

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        // Получаем локации атрибутов и униформ
        this.positionLocation = gl.getAttribLocation(this.program, 'aPosition');
        this.texCoordLocation = gl.getAttribLocation(this.program, 'aTexCoord');
        this.timeLocation = gl.getUniformLocation(this.program, 'uTime');
        this.resolutionLocation = gl.getUniformLocation(this.program, 'uResolution');
        this.mousePositionLocation = gl.getUniformLocation(this.program, 'uMousePosition');
        this.transitionLocation = gl.getUniformLocation(this.program, 'uTransition');
        this.textureNextLocation = gl.getUniformLocation(this.program, 'uTextureNext');
        this.directionLocation = gl.getUniformLocation(this.program, 'uDirection');

        // Создаем и настраиваем текстуры
        this.texture = gl.createTexture();
        this.nextTexture = gl.createTexture();

        [this.texture, this.nextTexture].forEach(texture => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            
            // Создаем пустую текстуру нужного размера
            const pixels = new Uint8Array([0, 0, 0, 255]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        });

        // Инициализируем параметры
        this.currentIndex = 0;
        this.params = {
            transition: 0,
            direction: 1
        };

        // Устанавливаем первое изображение
        if (!this.images || !this.images[0]) {
            console.error('No images available for texture');
            return;
        }
        console.log('Setting initial texture with image:', this.images[0].width, 'x', this.images[0].height);
        
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.images[0]);

        // Запоминаем время начала, но НЕ запускаем рендеринг здесь
        this.startTime = performance.now();
        return true;
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            const typeStr = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
            console.error(`${typeStr} shader compile error:`, error);
            console.error('Shader source:', source);
            gl.deleteShader(shader);
            return null;
        }

        // Проверяем, что шейдер действительно создан
        if (!shader) {
            console.error('Failed to create shader');
            return null;
        }

        return shader;
    }

    render = () => {
        if (!this.isRunning) {
            console.log('Render stopped - animation not running');
            return;
        }

        const gl = this.gl;
        if (!gl) {
            console.error('No WebGL context');
            return;
        }

        const time = performance.now() - this.startTime;

        // Получаем актуальные размеры контейнера
        const galleryContainer = document.querySelector('.gallery-container');
        const displayWidth = galleryContainer ? galleryContainer.offsetWidth : window.innerWidth;
        const displayHeight = galleryContainer ? galleryContainer.offsetHeight : window.innerHeight;
        
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.canvas.style.width = `${displayWidth}px`;
            this.canvas.style.height = `${displayHeight}px`;
            gl.viewport(0, 0, displayWidth, displayHeight);
        }

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        // Устанавливаем униформы
        gl.uniform1f(this.timeLocation, time * 0.001);
        gl.uniform2f(this.resolutionLocation, displayWidth, displayHeight);
        gl.uniform2f(this.mousePositionLocation, 0.5, 0.5);
        
        // Модифицируем transition для создания более плавного эффекта
        const normalizedTransition = this.params.transition % 1;
        gl.uniform1f(this.transitionLocation, normalizedTransition);
        gl.uniform1f(this.directionLocation, 1);

        // Активируем и привязываем текстуры
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.uniform1i(this.textureNextLocation, 1);

        // Устанавливаем атрибуты и рисуем
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(this.texCoordLocation);
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        if (this.isRunning) {
            requestAnimationFrame(this.render);
        }
    }

    async fadeOut() {
        await new Promise(resolve => {
            window.gsap.to(this.canvas, {
                opacity: 0,
                duration: 0.5,
                ease: "power2.inOut",
                onComplete: resolve
            });
        });
    }
}

// Запускаем анимацию после загрузки страницы
window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    const shouldShowAnimation = true;

    if (shouldShowAnimation) {
        console.log('Creating intro animation');
        const intro = new IntroAnimation();
        if (await intro.initialize()) {
            console.log('Initialization successful');
            // Уменьшаем таймаут безопасности до 10 секунд
            const timeout = setTimeout(() => {
                if (intro.isRunning) {
                    console.log('Safety timeout triggered');
                    intro.canvas.remove();
                    const gallery = document.querySelector('.gallery-container');
                    if (gallery) {
                        const mainCanvas = gallery.querySelector('canvas[data-gallery="container"]');
                        if (mainCanvas) {
                            mainCanvas.style.transition = 'opacity 0.5s';
                            mainCanvas.style.opacity = '1';
                        }
                    }
                }
            }, 10000);

            await intro.start();
            clearTimeout(timeout);
        } else {
            console.error('Failed to initialize intro animation');
            const gallery = document.querySelector('.gallery-container');
            if (gallery) {
                const mainCanvas = gallery.querySelector('canvas[data-gallery="container"]');
                if (mainCanvas) {
                    mainCanvas.style.opacity = '1';
                }
            }
        }
    }
}); 