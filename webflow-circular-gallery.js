// Добавляем GSAP для анимаций
const gsap = window.gsap || {
    utils: {
        clamp: (min, max, value) => Math.min(Math.max(value, min), max)
    }
};

// Создаем общий загрузчик изображений
const imageLoader = {
    cache: new Map(),
    
    async load(url) {
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }
        
        return new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.cache.set(url, img);
                resolve(img);
            };
            img.onerror = () => {
                console.error('Failed to load image:', url);
                resolve(null);
            };
            img.src = url;
        });
    }
};

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
uniform sampler2D uTextureNext;
uniform float uTransition;
uniform vec2 uMousePosition;
uniform float uDirection;
varying vec2 vUv;
varying vec2 vScreenPosition;

#define PI 3.1415926535897932384626433832795

vec3 obj_pos = vec3(0.0, 0.0, -10.0);
float obj_size = 5.0;

vec3 getFishEye(vec2 uv, float level) {
    float len = length(uv);
    float a = len * level;
    return vec3(uv / len * sin(a), -cos(a));
}

vec3 textureAVG(sampler2D tex, vec2 tc) {
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
    vec3 color;
    
    float mouseX = 1.0 - uMousePosition.x;
    float mouseInfluence = 1.0;
    float mouseRotation = mouseX * mouseInfluence * PI * 0.25;
    
    float transitionRotation = uTransition * PI * 2.0 * uDirection;
    
    mat2 mouseRotationMatrix = mat2(
        cos(mouseRotation), -sin(mouseRotation),
        sin(mouseRotation), cos(mouseRotation)
    );
    
    mat2 transitionRotationMatrix = mat2(
        cos(transitionRotation), -sin(transitionRotation),
        sin(transitionRotation), cos(transitionRotation)
    );
    
    dir.xz = mouseRotationMatrix * dir.xz;
    dir.xz = transitionRotationMatrix * dir.xz;
    
    // Плавное смешивание текстур
    vec3 currentColor = getColor(dir, uTexture);
    vec3 nextColor = getColor(dir, uTextureNext);
    
    // Используем модуль угла для создания цикличного перехода
    float transitionAngle = mod(abs(transitionRotation), PI * 2.0);
    // Создаем более плавный переход в середине анимации
    float mixFactor = smoothstep(0.0, PI * 2.0, transitionAngle);
    mixFactor = smoothstep(0.1, 0.9, mixFactor);
    
    // Смешиваем текстуры
    color = mix(currentColor, nextColor, mixFactor);
    
    float fish_eye = smoothstep(2.0, 1.6, length(uv)) * 0.15 + 0.85;
    gl_FragColor = vec4(color * fish_eye, 1.0);
}`;

class CircularGallery {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        // Добавляем класс preload к canvas для предотвращения анимации
        this.canvas.classList.add('preload');

        this.currentImage = null;
        this.startTime = performance.now();
        this.isInitialized = false;
        
        // Инициализация переменных для отслеживания позиции мыши
        this.mousePosition = { x: 0.5, y: 0.5 };
        this.targetMousePosition = { x: 0.5, y: 0.5 };
        this.isHovering = false;
        
        // Добавляем параметры для перехода
        this.params = {
            distortionStrength: 0,
            transition: 0,
            animationSpeed: 0,
            direction: 1 // 1 для вправо, -1 для влево
        };
        
        this.nextTexture = null;
        this.isTransitioning = false;
        
        // Флаг для отслеживания анимации
        this.isTransitioning = false;
        
        // Добавляем стили для предотвращения анимации при загрузке
        const style = document.createElement('style');
        style.textContent = `
            canvas[data-gallery="container"].preload {
                animation: none !important;
                transition: none !important;
            }
            canvas[data-gallery="container"].preload * {
                animation: none !important;
                transition: none !important;
            }
        `;
        document.head.appendChild(style);
        
        // Инициализация WebGL
        this.initWebGL();
        
        // Добавляем обработчики событий мыши только для десктопов
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
            this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.canvas.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
            this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        }

        // Немедленно загружаем первое изображение
        this.loadImage();
    }
    
    // Обработчик движения мыши
    handleMouseMove(event) {
        if (!this.isHovering) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX / window.innerWidth;
        const y = 1 - event.clientY / window.innerHeight;
        
        this.targetMousePosition = {
            x: gsap.utils.clamp(0, 1, x),
            y: gsap.utils.clamp(0, 1, y)
        };
    }
    
    handleMouseEnter() {
        this.isHovering = true;
    }
    
    handleMouseLeave() {
        this.isHovering = false;
        this.targetMousePosition = { x: 0.5, y: 0.5 };
    }

    async updateImage(newImage, skipAnimation = false) {
        console.log('[DEBUG] updateImage() called', {
            isInitialized: this.isInitialized,
            hasCurrentImage: !!this.currentImage,
            skipAnimation,
            isTransitioning: this.isTransitioning,
            currentImageSrc: this.currentImage?.src,
            newImageSrc: newImage?.src,
            direction: this.params.direction
        });

        if (!this.gl || !newImage) {
            console.warn('GL context or image not available');
            return;
        }

        // Если это первое изображение или контекст не инициализирован
        if (!this.isInitialized || !this.currentImage) {
            console.log('[DEBUG] First image or not initialized, setting directly');
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, newImage);
            this.currentImage = newImage;
            this.isInitialized = true;
            this.startTime = performance.now();
            this.animate(this.startTime);
            return;
        }

        if (this.currentImage && this.currentImage.src === newImage.src) {
            console.log('[DEBUG] Skipping updateImage: same image');
            return;
        }

        if (this.isTransitioning) {
            console.log('[DEBUG] Skipping updateImage: transition in progress');
            return;
        }

        this.isTransitioning = true;

        // Используем программу перед установкой униформ
        this.gl.useProgram(this.program);

        // Всегда загружаем новое изображение в следующую текстуру
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, newImage);
        this.gl.uniform1i(this.textureNextLocation, 1);

        if (skipAnimation) {
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, newImage);
            this.currentImage = newImage;
            this.isTransitioning = false;
            return;
        }

        // Анимируем переход
        gsap.timeline()
            .to(this.params, {
                transition: 1,
                duration: 1.2,
                ease: "power2.inOut",
                onUpdate: () => {
                    this.gl.useProgram(this.program);
                    console.log('[DEBUG] Animation update:', {
                        transition: this.params.transition,
                        direction: this.params.direction
                    });
                    this.gl.uniform1f(this.transitionLocation, this.params.transition);
                    this.gl.uniform1f(this.directionLocation, this.params.direction);
                },
                onComplete: () => {
                    // По завершении анимации обновляем текущую текстуру
                    this.gl.activeTexture(this.gl.TEXTURE0);
                    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, newImage);
                    this.currentImage = newImage;
                    this.params.transition = 0;
                    this.isTransitioning = false;
                    
                    // Очищаем следующую текстуру
                    this.gl.activeTexture(this.gl.TEXTURE1);
                    this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextTexture);
                    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
                }
            });
    }

    async loadImage() {
        console.log('[DEBUG] loadImage() called');
        // Получаем все изображения галереи
        const galleryImages = document.querySelectorAll('[data-gallery="image"]');
        if (galleryImages.length === 0) {
            console.error('[DEBUG] No images found in gallery');
            return;
        }

        // Находим первое реальное изображение (не плейсхолдер)
        let firstRealImage = null;
        for (let i = 0; i < galleryImages.length; i++) {
            const img = galleryImages[i];
            // Проверяем, что это не плейсхолдер
            if (img.src && !img.src.includes('placeholder')) {
                firstRealImage = img;
                break;
            }
        }

        // Если не нашли реальное изображение, используем первое доступное
        if (!firstRealImage && galleryImages.length > 0) {
            firstRealImage = galleryImages[0];
        }

        if (!firstRealImage) {
            console.error('[DEBUG] No valid images found in gallery');
            return;
        }

        try {
            console.log('[DEBUG] Loading first real image:', firstRealImage.src);
            const img = await imageLoader.load(firstRealImage.src);
            
            if (img) {
                console.log('[DEBUG] First image loaded successfully');
                this.currentImage = img;
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);
                this.isInitialized = true;

                this.startTime = performance.now();
                this.animate(this.startTime);
            } else {
                console.warn('[DEBUG] Failed to load first image, but continuing initialization');
                this.isInitialized = true;
            }
        } catch (error) {
            console.error('[DEBUG] Error during image loading:', error);
            // Продолжаем работу даже при ошибке
            this.isInitialized = true;
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
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, VERTEX_SHADER);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(this.program));
            return;
        }

        // Создаем и инициализируем буферы
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

        // Получаем локации атрибутов и униформ
        this.positionLocation = this.gl.getAttribLocation(this.program, 'aPosition');
        this.texCoordLocation = this.gl.getAttribLocation(this.program, 'aTexCoord');
        this.timeLocation = this.gl.getUniformLocation(this.program, 'uTime');
        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'uResolution');
        this.mousePositionLocation = this.gl.getUniformLocation(this.program, 'uMousePosition');

        // Создаем и настраиваем текстуру
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        
        // Устанавливаем параметры текстуры
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        
        // Создаем пустую текстуру нужного размера
        const width = 1;
        const height = 1;
        const pixels = new Uint8Array([0, 0, 0, 255]);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

        // Создаем текстуру для следующего изображения
        this.nextTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextTexture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        
        // Создаем пустую текстуру
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

        // Получаем локации униформ для перехода
        this.transitionLocation = this.gl.getUniformLocation(this.program, 'uTransition');
        this.textureNextLocation = this.gl.getUniformLocation(this.program, 'uTextureNext');
        this.directionLocation = this.gl.getUniformLocation(this.program, 'uDirection');
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

        const interpolationFactor = 0.1;
        this.mousePosition.x += (this.targetMousePosition.x - this.mousePosition.x) * interpolationFactor;
        this.mousePosition.y += (this.targetMousePosition.y - this.mousePosition.y) * interpolationFactor;

        this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        if (!this.currentImage) return;

        this.gl.useProgram(this.program);

        // Устанавливаем униформы
        this.gl.uniform1f(this.timeLocation, (time - this.startTime) / 1000);
        this.gl.uniform2f(this.resolutionLocation, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.uniform2f(this.mousePositionLocation, this.mousePosition.x, this.mousePosition.y);
        this.gl.uniform1f(this.transitionLocation, this.params.transition);
        this.gl.uniform1f(this.directionLocation, this.params.direction);

        // Активируем и привязываем текстуры
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'uTexture'), 0);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.nextTexture);
        this.gl.uniform1i(this.textureNextLocation, 1);

        // Устанавливаем атрибуты и рисуем
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    animate(time) {
        this.render(time);
        requestAnimationFrame(this.animate.bind(this));
    }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    window.circularGalleries = [];
    
    function initializeGallery() {
        console.log('Initializing circular gallery...');
        
        const canvases = document.querySelectorAll('canvas[data-gallery="container"]');
        const galleryImages = document.querySelectorAll('[data-gallery="image"]');
        
        if (canvases.length === 0) {
            console.log('No gallery canvases found yet.');
            return false;
        }
        
        console.log('Found gallery images:', galleryImages.length);
        
        canvases.forEach(canvas => {
            if (canvas.hasAttribute('data-gallery-initialized')) {
                return;
            }
            
            const gallery = new CircularGallery(canvas);
            canvas.setAttribute('data-gallery-initialized', 'true');
            window.circularGalleries.push(gallery);
            
            canvas.addEventListener('galleryImageChange', async (event) => {
                if (event.detail && event.detail.imageUrl) {
                    try {
                        const img = await imageLoader.load(event.detail.imageUrl);
                        gallery.updateImage(img);
                    } catch (error) {
                        console.error('Failed to load image:', error);
                    }
                }
            });
        });
        
        return true;
    }
    
    // Пытаемся инициализировать сразу
    let initialized = initializeGallery();
    
    if (!initialized) {
        // Если не удалось, пробуем еще раз после короткой задержки
        requestAnimationFrame(() => {
            initialized = initializeGallery();
        });
    }
    
    // Инициализируем Swiper с задержкой
    setTimeout(initializeSwiperGallery, 500);
});

function initializeSwiperGallery() {
    console.log('[DEBUG] Swiper Image Debugger Initialized');

    if (typeof Swiper === 'undefined') {
        console.error('Swiper is not loaded. Please include Swiper.js in your project.');
        return;
    }

    const swiperElement = document.querySelector('[data-gallery="swiper"]');
    if (!swiperElement) {
        console.log('No Swiper element found with [data-gallery="swiper"] attribute.');
        return;
    }

    try {
        const swiper = new Swiper('[data-gallery="swiper"]', {
            wrapperClass: 'swiper-cover_wrapper',
            slideClass: 'swiper-cover_slide',
            
            slidesPerView: 1,
            spaceBetween: 0,
            loop: true,
            
            // Добавляем observer для корректной работы с динамическим контентом
            observer: true,
            observeParents: true,
            
            navigation: {
                nextEl: '[data-gallery="next"]',
                prevEl: '[data-gallery="prev"]'
            },
            
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            
            on: {
                init: function() {
                    console.log('[DEBUG] Swiper initialized');
                },

                navigationNext: function() {
                    console.log('[DEBUG] Navigation Next clicked');
                    if (window.circularGalleries && window.circularGalleries[0]) {
                        window.circularGalleries[0].params.direction = 1;
                        console.log('[DEBUG] Direction set to:', window.circularGalleries[0].params.direction);
                    }
                },

                navigationPrev: function() {
                    console.log('[DEBUG] Navigation Prev clicked');
                    if (window.circularGalleries && window.circularGalleries[0]) {
                        window.circularGalleries[0].params.direction = -1;
                        console.log('[DEBUG] Direction set to:', window.circularGalleries[0].params.direction);
                    }
                },

                touchStart: function() {
                    const startX = this.touches.startX;
                    console.log('[DEBUG] Touch Start:', startX);
                    
                    this.on('touchMove', () => {
                        if (window.circularGalleries && window.circularGalleries[0]) {
                            const direction = this.touches.currentX - startX > 0 ? -1 : 1;
                            window.circularGalleries[0].params.direction = direction;
                            console.log('[DEBUG] Touch Move - Direction set to:', direction);
                        }
                    });
                },

                slideChange: function() {
                    console.log('[DEBUG] Swiper slideChange event fired');
                    const canvas = document.querySelector('[data-gallery="container"]');
                    
                    // Получаем все слайды
                    const slides = Array.from(this.slides);
                    const totalSlides = slides.length;
                    const activeSlide = slides[this.activeIndex];
                    const img = activeSlide.querySelector('[data-gallery="image"]');

                    if (canvas && img) {
                        // Пропускаем плейсхолдер
                        if (img.src && img.src.includes('placeholder')) {
                            console.log('[DEBUG] Skipping placeholder image in slideChange');
                            return;
                        }
                        
                        console.log('[DEBUG] Slide changed, updating image:', {
                            imageUrl: img.src,
                            realIndex: this.realIndex,
                            slideIndex: this.activeIndex,
                            totalSlides: totalSlides,
                            direction: window.circularGalleries[0]?.params.direction,
                            isBeginning: this.isBeginning,
                            isEnd: this.isEnd
                        });
                        
                        const event = new CustomEvent('galleryImageChange', {
                            detail: { 
                                imageUrl: img.src,
                                direction: window.circularGalleries[0]?.params.direction
                            }
                        });
                        canvas.dispatchEvent(event);
                    }
                }
            }
        });
        
        console.log('Swiper initialized successfully');
        window.gallerySwiper = swiper;
    } catch (error) {
        console.error('Error initializing Swiper:', error);
    }
}

// Добавляем стиль для скрытия плейсхолдера
(function() {
    // Создаем стиль для скрытия плейсхолдера
    const style = document.createElement('style');
    style.textContent = `
        img[src*="placeholder.60f9b1840c.svg"] {
            opacity: 0 !important;
            visibility: hidden !important;
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
        }
    `;
    document.head.appendChild(style);
    
    // Добавляем обработчик ошибок для всех изображений
    window.addEventListener('DOMContentLoaded', () => {
        const images = document.querySelectorAll('[data-gallery="image"]');
        images.forEach(img => {
            img.onerror = function() {
                // Если это плейсхолдер, игнорируем ошибку
                if (this.src && this.src.includes('placeholder')) {
                    console.log('[DEBUG] Ignoring placeholder image error');
                    return true;
                }
            };
        });
    });
})();