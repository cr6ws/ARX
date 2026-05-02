import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type ChartProps = {
  data: any[];
  height?: number;
};

export function SecurityDonut({ data, height = 300 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={data}
          innerRadius="75%"
          outerRadius="95%"
          paddingAngle={5}
          dataKey="value"
          stroke="none"
          cx="50%"
          cy="50%"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--theme-bg)",
            borderColor: "var(--theme-border)",
            borderRadius: "12px",
            color: "var(--theme-text)",
          }}
          itemStyle={{ color: "var(--theme-text)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SecurityBarChart({ data, height = 300 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" vertical={false} />
        <XAxis 
          dataKey="name" 
          stroke="var(--theme-text-muted)" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="var(--theme-text-muted)" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--theme-glass)" }}
          contentStyle={{
            backgroundColor: "var(--theme-bg)",
            borderColor: "var(--theme-border)",
            borderRadius: "12px",
            color: "var(--theme-text)",
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || "rgb(var(--theme-accent))"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
