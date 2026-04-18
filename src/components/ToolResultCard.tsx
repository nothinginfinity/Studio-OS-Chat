interface Props {
  name: string;
  data: unknown;
}

export function ToolResultCard({ name, data }: Props) {
  return (
    <div className="tool-card">
      <strong>{name}</strong>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
