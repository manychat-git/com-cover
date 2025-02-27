# Chromatic Aberration Gallery

An interactive WebGL-based image viewer with chromatic aberration and distortion effects. Upload your images and see them transformed with a unique visual style.

## Features

- WebGL-powered image processing
- Drag & drop image upload
- Chromatic aberration effect
- Interactive UI controls
- Responsive design
- Swiper.js integration for gallery functionality

## Webflow Integration

### Quick Start

1. Add a container element in Webflow with your desired dimensions
2. Add a Canvas element inside the container
3. Add the attribute `data-gallery="container"` to the Canvas element
4. Add a custom attribute `data-default-image` with the URL of your default image
5. Optionally add a custom attribute `data-show-controls="true"` if you want to show the control panel (hidden by default)
6. Add an Embed element at the end of your page with this script:

```html
<script src="https://cdn.jsdelivr.net/gh/manychat-git/com-cover@v1.2.0/webflow-circular-gallery.js"></script>
```

### Example

```html
<div class="gallery-container" style="width: 100%; height: 500px;">
  <canvas data-gallery="container" data-default-image="https://example.com/your-image.jpg" data-show-controls="false"></canvas>
</div>
```

### Swiper Integration

To use with Swiper.js for a gallery:

1. Add Swiper CSS and JS to your site:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css" />
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
```

2. Create a gallery structure with your custom classes:
```html
<div class="gallery-container" style="width: 100%; height: 500px; position: relative;">
  <!-- Swiper с кастомными классами -->
  <div class="swiper-cover" data-gallery="swiper">
    <div class="swiper-cover_wrapper">
      <!-- Слайды -->
      <div class="swiper-cover_slide">
        <img src="path/to/image1.jpg" data-gallery="image" style="display: none;">
      </div>
      <div class="swiper-cover_slide">
        <img src="path/to/image2.jpg" data-gallery="image" style="display: none;">
      </div>
      <!-- Добавьте больше слайдов по необходимости -->
    </div>
    
    <!-- Навигация -->
    <div class="swiper-button-prev"></div>
    <div class="swiper-button-next"></div>
    <div class="swiper-pagination"></div>
  </div>
  
  <!-- Canvas для WebGL эффектов -->
  <canvas data-gallery="container" data-show-controls="false"></canvas>
</div>
```

3. The script will automatically initialize Swiper with your custom classes and connect it to the WebGL gallery.

## Local Development

### Standard Method

1. Clone the repository
2. Open the project directory
3. Start a local server (e.g., using `python -m http.server 8081` or any other static file server)
4. Open `http://localhost:8081/test-local.html` in your browser

### Development with Auto-Reload (Recommended)

This method allows you to see changes immediately without manually refreshing the page:

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```
4. Open `http://localhost:8081/test-local.html` in your browser
5. Edit `webflow-circular-gallery.js` or `test-local.html` - the page will automatically reload when you save changes

## Technologies Used

- WebGL
- GLSL Shaders
- JavaScript
- HTML5
- CSS3
- Swiper.js (optional) 