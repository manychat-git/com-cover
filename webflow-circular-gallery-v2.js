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
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.cache.set(url, img);
                resolve(img);
            };
            img.onerror = reject;
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
uniform sampler2D uTexture;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform float uDistortionStrength;
uniform float uAnimationSpeed;

varying vec2 vUv;

vec2 mouseDistortion(vec2 uv, vec2 mouse, float strength) {
    vec2 polarUV = uv - mouse;
    float angle = atan(polarUV.x, polarUV.y);
    float dist = length(polarUV);
    
    float k = -strength;
    dist = dist * (1.0 + k * dist * dist);
    
    return mouse + vec2(sin(angle), cos(angle)) * dist;
}

void main() {
    // Рассчитываем соотношение сторон изображения и canvas
    float imageAspect = uImageSize.x / uImageSize.y;
    float canvasAspect = uResolution.x / uResolution.y;
    
    // Корректируем UV координаты для сохранения пропорций
    vec2 uv = vUv;
    if (imageAspect > canvasAspect) {
        float scale = canvasAspect / imageAspect;
        uv.x = (uv.x - 0.5) * scale + 0.5;
    } else {
        float scale = imageAspect / canvasAspect;
        uv.y = (uv.y - 0.5) * scale + 0.5;
    }
    
    // Применяем оба искажения с плавным переходом между ними
    vec2 mouseUV = mouseDistortion(uv, uMouse, 1.0);
    
    vec2 polarUV = uv - vec2(0.5);
    float angle = atan(polarUV.x, polarUV.y);
    float dist = length(polarUV);
    float k = -uDistortionStrength * 2.0; // Сила перехода = 2
    dist = dist * (1.0 + k * dist * dist);
    vec2 transitionUV = vec2(0.5) + vec2(sin(angle), cos(angle)) * dist;
    
    // Плавно смешиваем эффекты на основе силы искажения
    float transitionFactor = smoothstep(0.0, 0.2, uDistortionStrength);
    vec2 finalUV = mix(mouseUV, transitionUV, transitionFactor);
    
    vec4 tex = texture2D(uTexture, finalUV);
    gl_FragColor = tex;
}`;

class CircularGallery {
    constructor(canvas, defaultImageUrl) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        // Добавляем класс preload к canvas для предотвращения анимации
        this.canvas.classList.add('preload');

        this.currentImage = null;
        this.defaultImageUrl = defaultImageUrl || null;
        this.startTime = performance.now();
        this.isInitialized = false;
        
        // Инициализация переменных для отслеживания позиции мыши
        this.mousePosition = { x: 0.5, y: 0.5 };
        this.targetMousePosition = { x: 0.5, y: 0.5 };
        this.isHovering = false;
        
        // Параметры эффекта
        this.params = {
            distortionStrength: 0,
            animationSpeed: 0
        };
        
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
        
        // Добавляем обработчики для кнопок навигации
        document.querySelectorAll('[data-gallery]').forEach(button => {
            button.addEventListener('click', (e) => {
                const direction = e.target.getAttribute('data-gallery');
                if (direction === 'next') {
                    this.swiper.slideNext();
                } else if (direction === 'prev') {
                    this.swiper.slidePrev();
                }
            });
        });
        
        // Добавляем обработчики событий мыши только для десктопов
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
            this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.canvas.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
            this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        }
        
        this.initWebGL();
        this.loadImage();
    }
    
    // Обработчик движения мыши
    handleMouseMove(event) {
        if (!this.isHovering) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX / window.innerWidth;
        const y = 1 - event.clientY / window.innerHeight;
        
        // Обновляем целевую позицию мыши с плавной интерполяцией
        this.targetMousePosition = {
            x: gsap.utils.clamp(0, 1, x),
            y: gsap.utils.clamp(0, 1, y)
        };
    }
    
    // Обработчик входа курсора в область canvas
    handleMouseEnter() {
        this.isHovering = true;
    }
    
    // Обработчик выхода курсора из области canvas
    handleMouseLeave() {
        this.isHovering = false;
        // Сбрасываем позицию мыши в центр при уходе курсора
        this.targetMousePosition = { x: 0.5, y: 0.5 };
    }

    updateImage(newImage, skipAnimation = false) {
        console.log('[DEBUG] updateImage() called', {
            isInitialized: this.isInitialized,
            hasCurrentImage: !!this.currentImage,
            skipAnimation,
            isTransitioning: this.isTransitioning,
            currentImageSrc: this.currentImage?.src,
            newImageSrc: newImage?.src
        });

        // Если это первое изображение и галерея уже инициализирована, пропускаем
        if (this.isInitialized && !this.currentImage) {
            console.log('[DEBUG] Skipping updateImage: gallery initialized but no current image');
            return;
        }

        // Если новое изображение то же самое, что и текущее, пропускаем анимацию
        if (this.currentImage && this.currentImage.src === newImage.src) {
            console.log('[DEBUG] Skipping updateImage: same image');
            return;
        }

        // Запускаем анимацию искажения перед сменой изображения
        if (this.isTransitioning) {
            console.log('[DEBUG] Skipping updateImage: transition in progress');
            return;
        }
        this.isTransitioning = true;

        if (skipAnimation) {
            console.log('[DEBUG] Updating image without animation');
            // Если пропускаем анимацию, просто обновляем изображение
            this.currentImage = newImage;
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, newImage);
            this.isTransitioning = false;
            return;
        }

        console.log('[DEBUG] Starting image transition animation');
        // Анимация искажения от 0 до 1
        gsap.timeline()
            .to(this.params, {
                distortionStrength: 1,
                duration: 0.3,
                ease: "power2.inOut",
                onComplete: () => {
                    console.log('[DEBUG] First part of animation complete, updating image');
                    // Меняем изображение
                    this.currentImage = newImage;
                    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, newImage);
                    
                    // Анимация искажения обратно от 1 до 0
                    gsap.to(this.params, {
                        distortionStrength: 0,
                        duration: 0.3,
                        ease: "power2.out",
                        onComplete: () => {
                            console.log('[DEBUG] Animation complete');
                            this.isTransitioning = false;
                        }
                    });
                }
            });
    }

    async loadImage() {
        console.log('[DEBUG] loadImage() called');
        const firstImage = document.querySelector('[data-gallery="image"]');
        if (!firstImage) {
            console.error('[DEBUG] No images found in gallery');
            return;
        }

        try {
            console.log('[DEBUG] Loading first image:', firstImage.src);
            const img = await imageLoader.load(firstImage.src);
            console.log('[DEBUG] First image loaded successfully');
            this.currentImage = img;
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);
            this.isInitialized = true;
            console.log('[DEBUG] Gallery initialized, isInitialized = true');

            if (this.currentImage) {
                this.startTime = performance.now();
                this.animate();
            }
        } catch (error) {
            console.error('[DEBUG] Failed to load image:', firstImage.src, error);
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

        // Create triangle geometry
        const positions = new Float32Array([
            -1, -1, 0,
            1, -1, 0,
            -1, 1, 0,
            1, -1, 0,
            1, 1, 0,
            -1, 1, 0
        ]);

        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 1,
            1, 0,
            0, 0
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
        this.mouseLocation = this.gl.getUniformLocation(this.program, 'uMouse');
        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'uResolution');
        this.imageSizeLocation = this.gl.getUniformLocation(this.program, 'uImageSize');
        this.distortionStrengthLocation = this.gl.getUniformLocation(this.program, 'uDistortionStrength');
        this.animationSpeedLocation = this.gl.getUniformLocation(this.program, 'uAnimationSpeed');

        // Create and set up texture
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        // Enable alpha blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
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

        // Clear with transparent black
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Используем шейдерную программу
        this.gl.useProgram(this.program);
        
        // Обновляем позицию мыши с плавной интерполяцией
        this.mousePosition.x += (this.targetMousePosition.x - this.mousePosition.x) * 0.1;
        this.mousePosition.y += (this.targetMousePosition.y - this.mousePosition.y) * 0.1;
        
        // Передаем uniforms в шейдер
        const currentTime = (time - this.startTime) * 0.001;
        this.gl.uniform1f(this.timeLocation, currentTime);
        this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
        this.gl.uniform2f(this.mouseLocation, this.mousePosition.x, this.mousePosition.y);
        this.gl.uniform1f(this.distortionStrengthLocation, this.params.distortionStrength);
        this.gl.uniform1f(this.animationSpeedLocation, this.params.animationSpeed);
        
        // Передаем размеры изображения
        if (this.currentImage) {
            this.gl.uniform2f(this.imageSizeLocation, this.currentImage.width, this.currentImage.height);
        }
        
        // Привязываем буферы
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(this.positionLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.positionLocation);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        
        // Обновляем текстуру
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        if (this.currentImage) {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.currentImage);
        }
        
        // Отрисовываем
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 6);
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
    // Создаем глобальный массив для хранения экземпляров галереи
    window.circularGalleries = [];
    
    // Функция инициализации галереи
    function initializeGallery() {
        console.log('Initializing circular gallery...');
        
        // Находим все canvas с атрибутом data-gallery="container"
        const canvases = document.querySelectorAll('canvas[data-gallery="container"]');
        
        if (canvases.length === 0) {
            console.log('No gallery canvases found yet.');
            return false;
        }
        
        // Проверяем наличие изображений в атрибутах data-gallery="image"
        const galleryImages = document.querySelectorAll('[data-gallery="image"]');
        console.log('Found gallery images:', galleryImages.length);
        
        canvases.forEach(canvas => {
            // Проверяем, не был ли этот canvas уже инициализирован
            if (canvas.hasAttribute('data-gallery-initialized')) {
                return;
            }
            
            // Добавляем стили для canvas
            canvas.style.cssText = `
                width: 100%;
                height: 100%;
                display: block;
                position: absolute;
                top: 0;
                left: 0;
                margin: 0;
                padding: 0;
            `;
            
            const gallery = new CircularGallery(canvas);
            
            // Отмечаем canvas как инициализированный
            canvas.setAttribute('data-gallery-initialized', 'true');
            
            // Сохраняем экземпляр в глобальный массив
            window.circularGalleries.push(gallery);
            
            // Добавляем обработчик события для смены изображения
            canvas.addEventListener('galleryImageChange', async (event) => {
                console.log('[DEBUG] galleryImageChange event received', {
                    imageUrl: event.detail.imageUrl,
                    galleryInitialized: gallery.isInitialized,
                    hasCurrentImage: !!gallery.currentImage
                });
                
                if (event.detail && event.detail.imageUrl) {
                    try {
                        const img = await imageLoader.load(event.detail.imageUrl);
                        gallery.updateImage(img, false);
                    } catch (error) {
                        console.error('[DEBUG] Failed to load image:', event.detail.imageUrl, error);
                    }
                }
            });
        });
        
        // Удаляем заголовок, если он существует
        const title = document.querySelector('h1');
        if (title && title.textContent.includes('Circular Gallery Test V2')) {
            title.remove();
        }
        
        return true;
    }
    
    // Пробуем инициализировать сразу
    let initialized = initializeGallery();
    
    // Если не удалось инициализировать сразу, используем MutationObserver
    if (!initialized) {
        console.log('Setting up MutationObserver to detect CMS elements...');
        
        // Создаем MutationObserver для отслеживания изменений в DOM
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    // Проверяем, добавлены ли интересующие нас элементы
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Только элементы (не текстовые узлы)
                            if (node.hasAttribute && 
                                (node.hasAttribute('data-gallery') || 
                                 node.querySelector('[data-gallery]'))) {
                                shouldCheck = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldCheck) {
                console.log('Detected new gallery elements, attempting initialization...');
                initialized = initializeGallery();
                
                // Если инициализация прошла успешно, отключаем observer
                if (initialized) {
                    console.log('Gallery successfully initialized, disconnecting observer.');
                    observer.disconnect();
                }
            }
        });
        
        // Запускаем наблюдение за всем документом
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Дополнительно пробуем инициализировать через некоторое время
        // на случай, если MutationObserver не сработает
        setTimeout(() => {
            if (!initialized) {
                console.log('Attempting delayed initialization...');
                initialized = initializeGallery();
                
                if (initialized) {
                    console.log('Delayed initialization successful, disconnecting observer.');
                    observer.disconnect();
                }
            }
        }, 1500);
    }
    
    // Инициализация Swiper для галереи
    function initializeSwiperGallery() {
        console.log('[DEBUG] Swiper Image Debugger Initialized');

        // Проверяем наличие Swiper
        if (typeof Swiper === 'undefined') {
            console.error('Swiper is not loaded. Please include Swiper.js in your project.');
            return;
        }

        // Проверяем наличие элемента Swiper
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
                effect: "fade",
                fadeEffect: { crossFade: true },
                
                navigation: {
                    nextEl: '[data-gallery="next"]',
                    prevEl: '[data-gallery="prev"]'
                },
                
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                
                on: {
                    slideChange: function() {
                        console.log('[DEBUG] Swiper slideChange event fired');
                        const canvas = document.querySelector('[data-gallery="container"]');
                        const activeSlide = this.slides[this.realIndex];
                        const img = activeSlide.querySelector('[data-gallery="image"]');

                        if (canvas && img) {
                            console.log('[DEBUG] Slide changed, updating image:', {
                                imageUrl: img.src,
                                realIndex: this.realIndex
                            });
                            
                            const event = new CustomEvent('galleryImageChange', {
                                detail: { 
                                    imageUrl: img.src
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
    
    // Инициализируем Swiper с небольшой задержкой после инициализации галереи
    setTimeout(initializeSwiperGallery, 500);
}); 