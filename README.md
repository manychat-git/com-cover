# Circular Gallery

A WebGL-based circular gallery with smooth transitions and effects.

## Files

### Latest Version (v7.2.0)
- [webflow-circular-gallery-rev.min.js](https://raw.githubusercontent.com/manychat-git/com-cover/v7.2.0/webflow-circular-gallery-rev.min.js) - Gallery with reversed animation direction for navigation buttons
- [webflow-circular-gallery.min.js](https://raw.githubusercontent.com/manychat-git/com-cover/v7.2.0/webflow-circular-gallery.min.js) - Standard gallery version

### Previous Versions
- [v7.1.0](https://github.com/manychat-git/com-cover/releases/tag/v7.1.0)
- [v7.0.0](https://github.com/manychat-git/com-cover/releases/tag/v7.0.0)
- [v6.1.0](https://github.com/manychat-git/com-cover/releases/tag/v6.1.0)
- [v6.0.0](https://github.com/manychat-git/com-cover/releases/tag/v6.0.0)
- [v5.0.0](https://github.com/manychat-git/com-cover/releases/tag/v5.0.0)
- [v4.0.2](https://github.com/manychat-git/com-cover/releases/tag/v4.0.2)
- [v4.0.1](https://github.com/manychat-git/com-cover/releases/tag/v4.0.1)
- [v4.0.0](https://github.com/manychat-git/com-cover/releases/tag/v4.0.0)
- [v3.0.0](https://github.com/manychat-git/com-cover/releases/tag/v3.0.0)
- [v2.0.8](https://github.com/manychat-git/com-cover/releases/tag/v2.0.8)
- [v2.0.7](https://github.com/manychat-git/com-cover/releases/tag/v2.0.7)
- [v2.0.6](https://github.com/manychat-git/com-cover/releases/tag/v2.0.6)
- [v2.0.5](https://github.com/manychat-git/com-cover/releases/tag/v2.0.5)
- [v2.0.4](https://github.com/manychat-git/com-cover/releases/tag/v2.0.4)
- [v2.0.3](https://github.com/manychat-git/com-cover/releases/tag/v2.0.3)
- [v2.0.2](https://github.com/manychat-git/com-cover/releases/tag/v2.0.2)
- [v2.0.1](https://github.com/manychat-git/com-cover/releases/tag/v2.0.1)
- [v2.0.0](https://github.com/manychat-git/com-cover/releases/tag/v2.0.0)
- [v1.8.0](https://github.com/manychat-git/com-cover/releases/tag/v1.8.0)
- [v1.7.1](https://github.com/manychat-git/com-cover/releases/tag/v1.7.1)
- [v1.7.0](https://github.com/manychat-git/com-cover/releases/tag/v1.7.0)
- [v1.6.0](https://github.com/manychat-git/com-cover/releases/tag/v1.6.0)
- [v1.5.2](https://github.com/manychat-git/com-cover/releases/tag/v1.5.2)
- [v1.5.1](https://github.com/manychat-git/com-cover/releases/tag/v1.5.1)
- [v1.5.0](https://github.com/manychat-git/com-cover/releases/tag/v1.5.0)
- [v1.4.0](https://github.com/manychat-git/com-cover/releases/tag/v1.4.0)
- [v1.3.0](https://github.com/manychat-git/com-cover/releases/tag/v1.3.0)
- [v1.2.0](https://github.com/manychat-git/com-cover/releases/tag/v1.2.0)
- [v1.1.0](https://github.com/manychat-git/com-cover/releases/tag/v1.1.0)
- [v1.0.0](https://github.com/manychat-git/com-cover/releases/tag/v1.0.0)

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