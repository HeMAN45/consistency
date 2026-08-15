"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { fontSize: 10, fontFamily: "var(--font-jetbrains-mono)", fill: "#7e8891" };

const tooltipStyle = {
  background: "#0e1113",
  border: "1px solid #2b3339",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-jetbrains-mono)",
};

export function WeeklyTrendChart({ data }: { data: { label: string; pct: number }[] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="#1e2429" vertical={false} />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#14181b" }} formatter={(v) => `${v}%`} />
          <Bar dataKey="pct" fill="#ffb020" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StepsChart({ data, goal }: { data: { date: string; steps: number }[]; goal: number }) {
  if (data.length < 2) {
    return <p className="py-8 text-center text-sm text-muted">Log steps for a few days to see a trend.</p>;
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="stepsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb020" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ffb020" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e2429" vertical={false} />
          <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis tick={axis} axisLine={false} tickLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={goal} stroke="#7e8891" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="steps"
            stroke="#ffb020"
            strokeWidth={2}
            fill="url(#stepsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WakeChart({ data }: { data: { date: string; minutes: number }[] }) {
  if (data.length < 2) {
    return <p className="py-8 text-center text-sm text-muted">Log wake times to see a trend.</p>;
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#1e2429" vertical={false} />
          <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis
            tick={axis}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(m: number) =>
              `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(m: number) =>
              `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
            }
          />
          <Line type="monotone" dataKey="minutes" stroke="#24b8c4" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
