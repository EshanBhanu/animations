import React, { useRef, useEffect } from "react";

interface LightningProps {
  hue?: number;
  xOffset?: number;
  speed?: number;
  intensity?: number;
  size?: number;
}

const Lightning: React.FC<LightningProps> = ({
  hue = 230,
  xOffset = 0,
  speed = 1,
  intensity = 1,
  size = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const vertexShaderSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uHue;
      uniform float uXOffset;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform float uSize;
      
      #define OCTAVE_COUNT 10

      vec3 hsv2rgb(vec3 c) {
          vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float hash11(float p) {
          p = fract(p * .1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
      }

      float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * .1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      mat2 rotate2d(float theta) {
          float c = cos(theta);
          float s = sin(theta);
          return mat2(c, -s, s, c);
      }

      float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 fp = fract(p);
          float a = hash12(ip);
          float b = hash12(ip + vec2(1.0, 0.0));
          float c = hash12(ip + vec2(0.0, 1.0));
          float d = hash12(ip + vec2(1.0, 1.0));
          
          vec2 t = smoothstep(0.0, 1.0, fp);
          return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
      }

      float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < OCTAVE_COUNT; ++i) {
              value += amplitude * noise(p);
              p *= rotate2d(0.45);
              p *= 2.0;
              amplitude *= 0.5;
          }
          return value;
      }

      float lightningBranch(vec2 uv, float offset, float scale, float angleOffset) {
          vec2 branchUv = uv;
          branchUv.x += offset;
          branchUv = branchUv * scale;
          
          // Add some angular deviation for branches
          float angle = angleOffset + sin(iTime * uSpeed * 2.0 + offset * 10.0) * 0.3;
          mat2 rot = rotate2d(angle);
          branchUv = rot * branchUv;
          
          branchUv += 2.0 * fbm(branchUv * uSize * 0.8 + 0.6 * iTime * uSpeed + offset * 5.0) - 1.0;
          
          float dist = abs(branchUv.x);
          return 1.0 / (1.0 + dist * 20.0);
      }

      void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
          vec2 uv = fragCoord / iResolution.xy;
          uv = 2.0 * uv - 1.0;
          uv.x *= iResolution.x / iResolution.y;
          uv.x += uXOffset;
          
          // Main lightning bolt
          vec2 mainUv = uv;
          mainUv += 2.0 * fbm(mainUv * uSize + 0.8 * iTime * uSpeed) - 1.0;
          float mainDist = abs(mainUv.x);
          float mainLightning = pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / mainDist, 1.0);
          
          // Add scattering lightning branches
          float branches = 0.0;
          
          // Branch 1 - Upper right
          branches += lightningBranch(uv, 0.3, 1.2, 0.4) * 0.6;
          
          // Branch 2 - Lower left
          branches += lightningBranch(uv, -0.2, 1.1, -0.3) * 0.5;
          
          // Branch 3 - Upper left
          branches += lightningBranch(uv, -0.4, 0.9, 0.6) * 0.4;
          
          // Branch 4 - Lower right
          branches += lightningBranch(uv, 0.1, 1.0, -0.5) * 0.7;
          
          // Branch 5 - Center scatter
          branches += lightningBranch(uv, 0.05, 1.3, sin(iTime * uSpeed * 3.0) * 0.2) * 0.3;
          
          // Additional micro-branches for more detail
          for(int i = 0; i < 3; i++) {
              float fi = float(i);
              float offset = sin(iTime * uSpeed + fi * 2.1) * 0.3;
              float scale = 0.8 + sin(iTime * uSpeed * 1.5 + fi * 1.7) * 0.2;
              float angle = cos(iTime * uSpeed * 2.0 + fi * 3.14) * 0.4;
              branches += lightningBranch(uv, offset, scale, angle) * (0.2 + 0.1 * sin(iTime * uSpeed + fi));
          }
          
          // Combine main lightning with branches
          float totalLightning = mainLightning + branches * 0.8;
          
          vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
          vec3 col = baseColor * totalLightning * uIntensity;
          
          // Add some glow effect
          float glow = exp(-mainDist * 3.0) * 0.3;
          col += baseColor * glow * uIntensity * 0.5;
          
          col = pow(col, vec3(1.0));
          fragColor = vec4(col, 1.0);
      }

      void main() {
          mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

    const compileShader = (
      source: string,
      type: number
    ): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(
      fragmentShaderSource,
      gl.FRAGMENT_SHADER
    );
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const uHueLocation = gl.getUniformLocation(program, "uHue");
    const uXOffsetLocation = gl.getUniformLocation(program, "uXOffset");
    const uSpeedLocation = gl.getUniformLocation(program, "uSpeed");
    const uIntensityLocation = gl.getUniformLocation(program, "uIntensity");
    const uSizeLocation = gl.getUniformLocation(program, "uSize");

    const startTime = performance.now();
    const render = () => {
      resizeCanvas();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
      const currentTime = performance.now();
      gl.uniform1f(iTimeLocation, (currentTime - startTime) / 1000.0);
      gl.uniform1f(uHueLocation, hue);
      gl.uniform1f(uXOffsetLocation, xOffset);
      gl.uniform1f(uSpeedLocation, speed);
      gl.uniform1f(uIntensityLocation, intensity);
      gl.uniform1f(uSizeLocation, size);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [hue, xOffset, speed, intensity, size]);

  return <canvas ref={canvasRef} className="w-full h-full relative" />;
};

export default Lightning;
