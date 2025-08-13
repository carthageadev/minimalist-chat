import React, { useEffect, useRef } from "react";

interface FuzzyTextProps {
  children: React.ReactNode;
  fontSize?: number | string;
  fontWeight?: string | number;
  fontFamily?: string;
  color?: string;
  enableHover?: boolean;
  baseIntensity?: number;
  hoverIntensity?: number;
  containerWidth?: number; // New prop for container width
}

const FuzzyText: React.FC<FuzzyTextProps> = ({
  children,
  fontSize = "16px",
  fontWeight = 100,
  fontFamily = "inherit",
  color = "#00ff00",
  enableHover = true,
  baseIntensity = 0.18,
  hoverIntensity = 0.5,
  containerWidth = 406,
}) => {
  const canvasRef = useRef<
    HTMLCanvasElement & { cleanupFuzzyText?: () => void }
  >(null);

  useEffect(() => {
    let animationFrameId: number;
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const init = async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      if (isCancelled) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const computedFontFamily =
        fontFamily === "inherit"
          ? window.getComputedStyle(canvas).fontFamily || "sans-serif"
          : fontFamily;

      const fontSizeStr =
        typeof fontSize === "number" ? `${fontSize}px` : fontSize;
      let numericFontSize: number;
      if (typeof fontSize === "number") {
        numericFontSize = fontSize;
      } else {
        const temp = document.createElement("span");
        temp.style.fontSize = fontSize;
        document.body.appendChild(temp);
        const computedSize = window.getComputedStyle(temp).fontSize;
        numericFontSize = parseFloat(computedSize);
        document.body.removeChild(temp);
      }

      const text = React.Children.toArray(children).join("");

      // Create a temporary div to measure text with proper wrapping
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.visibility = "hidden";
      tempDiv.style.whiteSpace = "pre-wrap";
      tempDiv.style.wordWrap = "break-word";
      tempDiv.style.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      tempDiv.style.color = color;
      tempDiv.style.width = `${containerWidth}px`;
      tempDiv.style.maxWidth = `${containerWidth}px`;
      tempDiv.textContent = text;
      document.body.appendChild(tempDiv);

      const textWidth = Math.min(tempDiv.scrollWidth, containerWidth);
      const textHeight = tempDiv.offsetHeight;
      document.body.removeChild(tempDiv);

      // Calculate exact height needed based on actual text rendering
      const lineHeight = numericFontSize * 1.2;
      const words = text.split(" ");
      let currentLine = "";
      let lineCount = 0;

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;

        // Create temporary canvas to measure text width
        const measureCanvas = document.createElement("canvas");
        const measureCtx = measureCanvas.getContext("2d");
        if (!measureCtx) continue;

        measureCtx.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
        const testWidth = measureCtx.measureText(testLine).width;

        if (testWidth > containerWidth - 5 && currentLine !== "") {
          lineCount++;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      // Count the last line
      if (currentLine) {
        lineCount++;
      }

      // Calculate exact height needed
      const exactHeight = lineCount * lineHeight;

      canvas.width = textWidth;
      canvas.height = exactHeight;
      ctx.translate(0, 0);

      // Create offscreen canvas with proper dimensions
      const offscreen = document.createElement("canvas");
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;

      offscreen.width = textWidth;
      offscreen.height = exactHeight;

      offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      offCtx.textBaseline = "top";
      offCtx.fillStyle = color;

      // Render text with exact positioning
      let y = 0;
      currentLine = "";

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const testWidth = offCtx.measureText(testLine).width;

        if (testWidth > containerWidth - 5 && currentLine !== "") {
          // Draw current line and start new line
          offCtx.fillText(currentLine, 0, y);
          y += lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      // Draw the last line
      if (currentLine) {
        offCtx.fillText(currentLine, 0, y);
      }

      const interactiveLeft = 0;
      const interactiveTop = 0;
      const interactiveRight = textWidth;
      const interactiveBottom = exactHeight;

      let isHovering = false;
      const fuzzRange = 10;

      const run = () => {
        if (isCancelled) return;
        ctx.clearRect(
          -fuzzRange,
          -fuzzRange,
          textWidth + 2 * fuzzRange,
          exactHeight + 2 * fuzzRange
        );
        const intensity = isHovering ? hoverIntensity : baseIntensity;
        for (let j = 0; j < exactHeight; j++) {
          const dx = Math.floor(intensity * (Math.random() - 0.5) * fuzzRange);
          ctx.drawImage(offscreen, 0, j, textWidth, 1, dx, j, textWidth, 1);
        }
        animationFrameId = window.requestAnimationFrame(run);
      };

      run();

      const isInsideTextArea = (x: number, y: number) =>
        x >= interactiveLeft &&
        x <= interactiveRight &&
        y >= interactiveTop &&
        y <= interactiveBottom;

      const handleMouseMove = (e: MouseEvent) => {
        if (!enableHover) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        isHovering = isInsideTextArea(x, y);
      };

      const handleMouseLeave = () => {
        isHovering = false;
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!enableHover) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = (touch?.clientX ?? 0) - rect.left;
        const y = (touch?.clientY ?? 0) - rect.top;
        isHovering = isInsideTextArea(x, y);
      };

      const handleTouchEnd = () => {
        isHovering = false;
      };

      if (enableHover) {
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseleave", handleMouseLeave);
        canvas.addEventListener("touchmove", handleTouchMove, {
          passive: false,
        });
        canvas.addEventListener("touchend", handleTouchEnd);
      }

      const cleanup = () => {
        window.cancelAnimationFrame(animationFrameId);
        if (enableHover) {
          canvas.removeEventListener("mousemove", handleMouseMove);
          canvas.removeEventListener("mouseleave", handleMouseLeave);
          canvas.removeEventListener("touchmove", handleTouchMove);
          canvas.removeEventListener("touchend", handleTouchEnd);
        }
      };

      canvas.cleanupFuzzyText = cleanup;
    };

    init();

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      if (canvas && canvas.cleanupFuzzyText) {
        canvas.cleanupFuzzyText();
      }
    };
  }, [
    children,
    fontSize,
    fontWeight,
    fontFamily,
    color,
    enableHover,
    baseIntensity,
    hoverIntensity,
    containerWidth,
  ]);

  return <canvas ref={canvasRef} />;
};

export default FuzzyText;
