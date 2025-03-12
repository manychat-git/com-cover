// Debug logger для галереи
class GalleryDebugger {
    constructor() {
        this.lastTransitionTime = 0;
        this.transitionCount = 0;
        this.textureBindCount = 0;
        this.lastTextureTime = 0;
        this.isTransitioning = false;
        this.lastStackTrace = '';
        this.bindingsPerStack = new Map();
        this.init();
    }

    init() {
        // Ждем загрузки DOM
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[Gallery Debug] Initializing debugger...');
            this.setupDebugListeners();
            
            // Отслеживаем requestAnimationFrame
            this.interceptRAF();
        });
    }

    interceptRAF() {
        const originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = (callback) => {
            return originalRAF.call(window, (timestamp) => {
                if (!this.isTransitioning) {
                    console.log('[Gallery Debug] Animation frame requested while idle');
                }
                callback(timestamp);
            });
        };
    }

    getStackTrace() {
        try {
            throw new Error();
        } catch (e) {
            return e.stack
                .split('\n')
                .slice(2) // Пропускаем первые две строки (Error и getStackTrace)
                .map(line => line.trim())
                .join(' -> ');
        }
    }

    setupDebugListeners() {
        // Находим элементы галереи
        const galleryContainer = document.querySelector('[data-gallery="container"]');
        const swiperElement = document.querySelector('[data-gallery="swiper"]');
        
        if (!galleryContainer || !swiperElement) {
            console.error('[Gallery Debug] Gallery elements not found!');
            return;
        }

        // Отслеживаем изменения в WebGL контексте
        const canvas = galleryContainer;
        const gl = canvas.getContext('webgl');
        
        if (!gl) {
            console.error('[Gallery Debug] WebGL context not available!');
            return;
        }

        // Перехватываем вызовы WebGL
        this.interceptWebGLCalls(gl);

        // Отслеживаем события Swiper
        if (window.Swiper) {
            const swiper = document.querySelector('.swiper-cover').swiper;
            if (swiper) {
                swiper.on('slideChange', () => {
                    this.isTransitioning = true;
                    this.bindingsPerStack.clear();
                    console.log('[Gallery Debug] Slide change - cleared texture binding stats');
                });

                swiper.on('transitionEnd', () => {
                    this.isTransitioning = false;
                    console.log('[Gallery Debug] Texture binding stats:', 
                        Object.fromEntries(this.bindingsPerStack.entries()));
                });
            }
        }

        // Отслеживаем GSAP анимации
        if (window.gsap) {
            const originalTo = gsap.to;
            gsap.to = (...args) => {
                if (!this.isTransitioning) {
                    const stack = this.getStackTrace();
                    console.log('[Gallery Debug] GSAP animation while idle:', {
                        stack: stack
                    });
                }
                return originalTo.apply(gsap, args);
            };
        }
    }

    interceptWebGLCalls(gl) {
        // Перехватываем bindTexture
        const originalBindTexture = gl.bindTexture.bind(gl);
        gl.bindTexture = (target, texture) => {
            if (!this.isTransitioning) {
                const stack = this.getStackTrace();
                
                // Если стек отличается от предыдущего, логируем
                if (stack !== this.lastStackTrace) {
                    this.lastStackTrace = stack;
                    
                    // Увеличиваем счетчик для этого стека
                    const count = (this.bindingsPerStack.get(stack) || 0) + 1;
                    this.bindingsPerStack.set(stack, count);
                    
                    console.log('[Gallery Debug] Texture bind while idle:', {
                        bindCount: count,
                        stack: stack.split(' -> ').slice(0, 3).join(' -> ') // Показываем только первые 3 вызова
                    });
                }
            }
            
            originalBindTexture(target, texture);
        };

        // Перехватываем drawArrays
        const originalDrawArrays = gl.drawArrays.bind(gl);
        gl.drawArrays = (mode, first, count) => {
            if (!this.isTransitioning) {
                const stack = this.getStackTrace();
                if (stack !== this.lastStackTrace) {
                    console.log('[Gallery Debug] Draw call while idle:', {
                        stack: stack.split(' -> ')[0] // Показываем только непосредственного вызывающего
                    });
                    this.lastStackTrace = stack;
                }
            }
            originalDrawArrays(mode, first, count);
        };
    }
}

// Создаем экземпляр отладчика
const galleryDebugger = new GalleryDebugger(); 