"use client";

interface SparklineProps {
  data?: number[];
  color?: string;
  width?: number;
  height?: number;
}

export default function Sparkline({
  data = [12, 18, 14, 25, 20, 32, 28, 42, 38, 54],
  color = "#22d3ee",
  width = 120,
  height = 30,
}: SparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
