# Chromatic Aberration Gallery

An interactive WebGL-based image viewer with chromatic aberration and distortion effects. Upload your images and see them transformed with a unique visual style.

## Features

- WebGL-powered image processing
- Drag & drop image upload
- Chromatic aberration effect
- Interactive UI controls
- Responsive design

## Webflow Integration

### Quick Start

1. Add a container element in Webflow with your desired dimensions
2. Add a Canvas element inside the container
3. Add the attribute `data-gallery="container"` to the Canvas element
4. Add a custom attribute `data-default-image` with the URL of your default image
5. Optionally add a custom attribute `data-show-controls="true"` if you want to show the control panel (hidden by default)
6. Add an Embed element at the end of your page with this script:

```html
<script src="https://cdn.jsdelivr.net/gh/manychat-git/com-cover@v1.1.0/webflow-circular-gallery.js"></script>
```

### Example

```html
<div class="gallery-container" style="width: 100%; height: 500px;">
  <canvas data-gallery="container" data-default-image="https://example.com/your-image.jpg" data-show-controls="false"></canvas>
</div>
```

## Local Development

1. Clone the repository
2. Open the project directory
3. Start a local server (e.g., using `python -m http.server 8081` or any other static file server)
4. Open `http://localhost:8081/test-local.html` in your browser

## Technologies Used

- WebGL
- GLSL Shaders
- JavaScript
- HTML5
- CSS3 