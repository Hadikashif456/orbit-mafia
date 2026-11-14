export interface ChartPoint {
  day: number;
  value: number | null;
}

export interface ChartSeries {
  key: string;
  label: string;
  points: ChartPoint[];
  emphasis?: boolean;
  colorVar: string;
  defaultVisible: boolean;
}
