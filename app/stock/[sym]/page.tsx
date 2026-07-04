import StockDetail from "../../_components/StockDetail";

interface PageProps {
  params: Promise<{ sym: string }>;
}

export default async function StockPage({ params }: PageProps) {
  const { sym } = await params;
  return <StockDetail symbol={sym.toUpperCase()} />;
}
