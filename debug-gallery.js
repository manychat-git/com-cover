/**
 * Debug script for Circular Gallery
 * Add this script to your Webflow site after the main gallery script
 */

(function() {
    // Create debug panel
    function createDebugPanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            max-width: 400px;
            max-height: 300px;
            overflow: auto;
        `;
        
        const title = document.createElement('div');
        title.textContent = 'Gallery Debug';
        title.style.cssText = `
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 14px;
        `;
        
        const log = document.createElement('div');
        log.id = 'gallery-debug-log';
        
        const controls = document.createElement('div');
        controls.style.marginTop = '10px';
        
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Force Update Gallery';
        updateButton.style.cssText = `
            background: #4285f4;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        `;
        
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.cssText = `
            background: #ea4335;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
        `;
        
        updateButton.addEventListener('click', function() {
            const images = document.querySelectorAll('[data-gallery="image"]');
            if (images.length > 0) {
                const activeSlideIndex = window.swiperInstance ? window.swiperInstance.activeIndex : 0;
                const img = window.swiperInstance ? 
                    window.swiperInstance.slides[activeSlideIndex].querySelector('[data-gallery="image"]') : 
                    images[0];
                
                if (img && img.src) {
                    debugLog(`Manually updating gallery with image: ${img.src}`);
                    if (typeof window.updateCircularGallery === 'function') {
                        window.updateCircularGallery(img.src);
                    } else {
                        debugLog('Error: updateCircularGallery function not found');
                    }
                } else {
                    debugLog('Error: No image found in active slide');
                }
            } else {
                debugLog('Error: No gallery images found');
            }
        });
        
        closeButton.addEventListener('click', function() {
            document.body.removeChild(panel);
        });
        
        controls.appendChild(updateButton);
        controls.appendChild(closeButton);
        panel.appendChild(title);
        panel.appendChild(log);
        panel.appendChild(controls);
        
        document.body.appendChild(panel);
    }
    
    // Debug log function
    function debugLog(message) {
        console.log('[Gallery Debug]', message);
        const log = document.getElementById('gallery-debug-log');
        if (log) {
            const entry = document.createElement('div');
            entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
            entry.style.marginBottom = '5px';
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    }
    
    // Initialize debug tools
    function init() {
        console.log('Initializing gallery debug tools');
        
        // Check if gallery script is loaded
        if (typeof window.circularGalleries === 'undefined') {
            console.warn('Gallery script not loaded or initialized yet');
            setTimeout(init, 1000);
            return;
        }
        
        createDebugPanel();
        
        // Log gallery status
        debugLog(`Found ${window.circularGalleries.length} gallery instances`);
        
        const canvas = document.querySelector('canvas[data-gallery="container"]');
        if (canvas) {
            debugLog(`Canvas found with data-default-image: ${canvas.getAttribute('data-default-image')}`);
        } else {
            debugLog('No canvas element found');
        }
        
        const images = document.querySelectorAll('[data-gallery="image"]');
        debugLog(`Found ${images.length} gallery images`);
        
        if (typeof window.swiperInstance !== 'undefined') {
            debugLog('Swiper instance found');
        } else {
            debugLog('No Swiper instance found');
        }
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 1000);
        });
    } else {
        setTimeout(init, 1000);
    }
})();
