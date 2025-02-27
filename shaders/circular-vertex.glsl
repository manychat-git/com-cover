attribute vec4 aPosition;
attribute vec2 aTexCoord;
varying vec2 vUv;
varying vec2 vScreenPosition;

void main() {
    gl_Position = aPosition;
    vUv = aTexCoord;
    vScreenPosition = aPosition.xy;
} 